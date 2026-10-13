import oracledb from "oracledb";
import { execRows, withTransaction } from "@/lib/db";
import { InventoryError, number, text, range, stockDelta } from "./validation";
export const INVENTORY_ALIAS =
  process.env.DB_ALIAS_BARANG ?? process.env.DB_ALIAS_PRR ?? "DB222";
export type DataRow = Record<string, string | number | null>;
type Conn = Parameters<Parameters<typeof withTransaction>[0]>[0];
export const STOCK_SQL = `SELECT A.BARANG_ID,A.JENIS_BARANG,A.SATUAN,A.HARGA,NVL(B.JML,0) MASUK_QTY,NVL(C.JML,0) KELUAR_QTY,NVL(B.JML,0)-NVL(C.JML,0) SALDO_QTY,NVL(B.JML,0)||' '||A.SATUAN JML_MASUK,NVL(C.JML,0)||' '||A.SATUAN JML_KELUAR,(NVL(B.JML,0)-NVL(C.JML,0))||' '||A.SATUAN SALDO,(NVL(B.JML,0)-NVL(C.JML,0))*A.HARGA HARGA_ASET FROM SIAK_MASTER_BARANG A LEFT JOIN (SELECT KODE_BARANG,SUM(JUMLAH) JML FROM SIAK_BARANG_MASUK GROUP BY KODE_BARANG) B ON A.BARANG_ID=B.KODE_BARANG LEFT JOIN (SELECT KODE_BARANG,SUM(JUMLAH) JML FROM SIAK_BARANG_KELUAR GROUP BY KODE_BARANG) C ON A.BARANG_ID=C.KODE_BARANG`;
const tables = {
  masuk: "SIAK_BARANG_MASUK",
  keluar: "SIAK_BARANG_KELUAR",
} as const;
export function listQuery(mode: string, body: Record<string, unknown>) {
  let sql = "",
    binds: Record<string, unknown> = {};
  if (mode === "master" || mode === "options")
    sql =
      "SELECT BARANG_ID,JENIS_BARANG,SATUAN,HARGA,KETERANGAN,TO_CHAR(CREATED_DT,'YYYY-MM-DD') TANGGAL FROM SIAK_MASTER_BARANG";
  else if (mode === "masuk" || mode === "keluar")
    sql = `SELECT A.SEQ_ID,A.KODE_BARANG,B.JENIS_BARANG,A.JUMLAH,B.SATUAN,A.JUMLAH*B.HARGA HARGA,TO_CHAR(A.CREATED_DT,'DD-MM-YYYY') TANGGAL,TO_CHAR(A.CREATED_DT,'YYYY-MM-DD HH24:MI:SS') SORT_DATE,A.RECEIVED,A.KETERANGAN FROM ${tables[mode]} A LEFT JOIN SIAK_MASTER_BARANG B ON A.KODE_BARANG=B.BARANG_ID`;
  else if (mode === "status") sql = STOCK_SQL;
  else if (mode === "aset") {
    const sect = number(
      body.sect ?? body.kd_kategori ?? body.kategori,
      "Kategori",
      true,
      true,
    );
    if (sect > 6) throw new InventoryError("Kategori tidak valid.");
    binds = { sect };
    sql = "SELECT NO,DESCRIP,SECT FROM SIAK_MASTER_ASET WHERE SECT=:sect";
  } else if (mode === "aset-options")
    sql = "SELECT NO ID,DESCRIP NAMA FROM SIAK_MASTER_ASET WHERE SECT=6";
  else if (mode === "cekaset")
    sql = `SELECT NO_KEC,F5_GET_REF_WILAYAH(NO_KEC) NAMA_WIL,JENIS_BARANG,F5_GET_REF_SIAK_ASET(JENIS_BARANG,6) NAMA_BARANG,SUM(CASE WHEN KATEGORI='IN' THEN JUMLAH ELSE 0 END) MASUK_QTY,SUM(CASE WHEN KATEGORI='OUT' THEN JUMLAH ELSE 0 END) KELUAR_QTY,SUM(CASE WHEN KATEGORI='IN' THEN JUMLAH WHEN KATEGORI='OUT' THEN -JUMLAH ELSE 0 END) SALDO_QTY FROM SIAK_MONEV_WILAYAH GROUP BY NO_KEC,JENIS_BARANG`;
  else if (mode === "laporan" || mode === "laporanaset") {
    const r = range(body);
    binds = { start_date: r.start, end_date: r.end };
    if (mode === "laporan") {
      sql = `SELECT * FROM (SELECT A.SEQ_ID,B.JENIS_BARANG,A.KODE_BARANG,'BARANG MASUK' KET,A.JUMLAH,B.SATUAN,A.JUMLAH||' '||B.SATUAN JUMLAH_LABEL,A.JUMLAH*B.HARGA HARGA,TO_CHAR(A.CREATED_DT,'DD-MM-YYYY') TANGGAL,A.CREATED_DT SORT_DATE,A.RECEIVED FROM SIAK_BARANG_MASUK A LEFT JOIN SIAK_MASTER_BARANG B ON A.KODE_BARANG=B.BARANG_ID UNION ALL SELECT A.SEQ_ID,B.JENIS_BARANG,A.KODE_BARANG,'BARANG KELUAR' KET,A.JUMLAH,B.SATUAN,A.JUMLAH||' '||B.SATUAN JUMLAH_LABEL,A.JUMLAH*B.HARGA HARGA,TO_CHAR(A.CREATED_DT,'DD-MM-YYYY') TANGGAL,A.CREATED_DT SORT_DATE,A.RECEIVED FROM SIAK_BARANG_KELUAR A LEFT JOIN SIAK_MASTER_BARANG B ON A.KODE_BARANG=B.BARANG_ID) WHERE SORT_DATE>=TO_DATE(:start_date,'YYYY-MM-DD') AND SORT_DATE<TO_DATE(:end_date,'YYYY-MM-DD')+1`;
      const id = body.barang ?? body.kd_brg;
      if (id && id !== "0") {
        binds.barang = number(id, "Barang", true, true);
        sql += " AND KODE_BARANG=:barang";
      }
    } else {
      sql = `SELECT NO_KEC,F5_GET_REF_WILAYAH(NO_KEC) NAMA_WIL,JENIS_BARANG,F5_GET_REF_SIAK_ASET(JENIS_BARANG,6) NAMA_BARANG,JUMLAH,TO_CHAR(TANGGAL,'DD-MM-YYYY') TANGGAL,TANGGAL SORT_DATE,PENERIMA,KATEGORI FROM SIAK_MONEV_WILAYAH WHERE TANGGAL>=TO_DATE(:start_date,'YYYY-MM-DD') AND TANGGAL<TO_DATE(:end_date,'YYYY-MM-DD')+1`;
      const id = body.jenis ?? body.jenis_barang ?? body.barang;
      if (id && id !== "0") {
        binds.jenis = number(id, "Jenis aset", true, true);
        sql += " AND JENIS_BARANG=:jenis";
      }
      const category = String(
        body.kategori ?? body.category ?? "",
      ).toUpperCase();
      if (category && category !== "ALL") {
        if (!["IN", "OUT"].includes(category))
          throw new InventoryError("Kategori tidak valid.");
        binds.kategori = category;
        sql += " AND KATEGORI=:kategori";
      }
    }
  } else throw new InventoryError("Menu tidak ditemukan.");
  return { sql, binds };
}
export async function readInventory(
  mode: string,
  body: Record<string, unknown>,
) {
  const { sql, binds } = listQuery(mode, body);
  const paged = body.page !== undefined;
  const page = paged ? number(body.page, "Halaman", true, true) : 1;
  const size = paged
    ? Math.min(number(body.pageSize ?? 25, "Ukuran halaman", true, true), 100)
    : 0;
  const sortFields =
    mode === "aset"
      ? ["NO", "DESCRIP"]
      : mode === "aset-options"
        ? ["ID", "NAMA"]
        : mode === "cekaset"
          ? ["NAMA_WIL", "NAMA_BARANG", "SALDO_QTY"]
          : mode === "laporanaset"
            ? ["NAMA_WIL", "NAMA_BARANG", "JUMLAH", "SORT_DATE"]
            : mode === "status"
              ? ["BARANG_ID", "JENIS_BARANG", "HARGA", "SALDO_QTY"]
              : mode === "master" || mode === "options"
                ? ["BARANG_ID", "JENIS_BARANG", "HARGA"]
                : ["SEQ_ID", "JENIS_BARANG", "HARGA", "JUMLAH", "SORT_DATE"];
  const sort = String(
    body.sort ??
      (mode === "aset"
        ? "NO"
        : ["masuk", "keluar", "laporan", "laporanaset"].includes(mode)
          ? "SORT_DATE"
          : mode === "cekaset"
            ? "NAMA_WIL"
            : mode === "aset-options"
              ? "ID"
              : "BARANG_ID"),
  );
  if (!sortFields.includes(sort))
    throw new InventoryError("Urutan tidak valid.");
  const direction = body.direction === "description" ? "DESC" : "ASC";
  const search = String(body.search ?? "")
    .trim()
    .slice(0, 100);
  const searchColumn =
    mode === "aset"
      ? "DESCRIP"
      : mode === "aset-options"
        ? "NAMA"
        : mode === "cekaset" || mode === "laporanaset"
          ? "NAMA_BARANG"
          : "JENIS_BARANG";
  const where = search
    ? ` WHERE INSTR(LOWER(NVL(${searchColumn},'')),LOWER(:search_value))>0`
    : "";
  const status = String(body.status ?? "");
  let condition = where;
  if (mode === "status" && status) {
    const f =
      status === "empty"
        ? "SALDO_QTY=0"
        : status === "negative"
          ? "SALDO_QTY<0"
          : status === "available"
            ? "SALDO_QTY>0"
            : null;
    if (!f) throw new InventoryError("Status tidak valid.");
    condition += (condition ? " AND " : " WHERE ") + f;
  }
  const query = `SELECT * FROM (${sql}) Q${condition}`;
  const stable =
    mode === "aset"
      ? "NO"
      : mode === "aset-options"
        ? "ID"
        : mode === "cekaset" || mode === "laporanaset"
          ? "NO_KEC,JENIS_BARANG"
          : mode === "laporan"
            ? "SEQ_ID,KET"
            : mode === "masuk" || mode === "keluar"
              ? "SEQ_ID"
              : "BARANG_ID";
  const allBinds = { ...binds, ...(search ? { search_value: search } : {}) };
  const rows = await execRows<DataRow>(
    `${query} ORDER BY ${sort} ${direction}, ${stable}${paged ? " OFFSET :row_offset ROWS FETCH NEXT :row_limit ROWS ONLY" : ""}`,
    {
      ...allBinds,
      ...(paged ? { row_offset: (page - 1) * size, row_limit: size } : {}),
    },
    {},
    INVENTORY_ALIAS,
  );
  if (!paged) return rows;
  const count = await execRows<{ TOTAL: number }>(
    `SELECT COUNT(*) TOTAL FROM (${query})`,
    allBinds,
    {},
    INVENTORY_ALIAS,
  );
  return { rows, total: count[0]?.TOTAL ?? 0, page, pageSize: size };
}
async function one(
  conn: Conn,
  sql: string,
  binds: Record<string, unknown> = {},
) {
  return ((
    await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT })
  ).rows ?? [])[0] as DataRow | undefined;
}
// Fixed lock order protects legacy MAX+1 allocation and all balance-changing writes without schema changes.
export async function mutateInventory(
  conn: Conn,
  mode: "master" | "masuk" | "keluar" | "aset",
  body: Record<string, unknown>,
  user: string,
) {
  const action = String(body.action);
  if (!["create", "update", "delete"].includes(action))
    throw new InventoryError("Aksi tidak valid.");
  for (const table of [
    "SIAK_MASTER_BARANG",
    "SIAK_BARANG_MASUK",
    "SIAK_BARANG_KELUAR",
    "SIAK_MASTER_ASET",
  ])
    await conn.execute(`LOCK TABLE ${table} IN EXCLUSIVE MODE WAIT 5`);
  const id =
    action === "create"
      ? null
      : number(
          body.id ?? body.seq_id ?? body.no ?? body.aset_no ?? body.mdl_no_data,
          "ID",
          true,
          true,
        );
  if (mode === "master") {
    const before = id
      ? await one(
          conn,
          "SELECT * FROM SIAK_MASTER_BARANG WHERE BARANG_ID=:id",
          { id },
        )
      : undefined;
    if (id && !before) throw new InventoryError("Barang tidak ditemukan.");
    if (action === "delete") {
      const used = await one(
        conn,
        "SELECT (SELECT COUNT(*) FROM SIAK_BARANG_MASUK WHERE KODE_BARANG=:id)+(SELECT COUNT(*) FROM SIAK_BARANG_KELUAR WHERE KODE_BARANG=:id) TOTAL FROM DUAL",
        { id },
      );
      if (Number(used?.TOTAL) > 0)
        throw new InventoryError(
          "Barang memiliki riwayat transaksi dan tidak dapat dihapus.",
        );
      await conn.execute("DELETE FROM SIAK_MASTER_BARANG WHERE BARANG_ID=:id", {
        id,
      });
      return { id, before };
    }
    const jenis = text(body.jenis_barang ?? body.jenis, "Jenis barang", 50),
      satuan = text(body.satuan, "Satuan", 20),
      harga = number(body.harga ?? body.harga_satuan, "Harga", false),
      ket = text(body.keterangan, "Keterangan", 200, false);
    const duplicate = await one(
      conn,
      "SELECT BARANG_ID FROM SIAK_MASTER_BARANG WHERE UPPER(TRIM(JENIS_BARANG))=UPPER(:jenis) AND BARANG_ID<>:exclude_id",
      { jenis, exclude_id: id ?? -1 },
    );
    if (duplicate)
      throw new InventoryError("Jenis barang tersebut sudah terdaftar.");
    const selected =
      id ??
      Number(
        (
          await one(
            conn,
            "SELECT NVL(MAX(BARANG_ID),0)+1 ID FROM SIAK_MASTER_BARANG",
          )
        )?.ID,
      );
    if (id)
      await conn.execute(
        "UPDATE SIAK_MASTER_BARANG SET JENIS_BARANG=:jenis,SATUAN=:satuan,HARGA=:harga,KETERANGAN=:ket,CHANGED_BY=:user_id,CHANGED_DT=SYSDATE WHERE BARANG_ID=:id",
        { id, jenis, satuan, harga, ket, user_id: user },
      );
    else
      await conn.execute(
        "INSERT INTO SIAK_MASTER_BARANG (BARANG_ID,JENIS_BARANG,SATUAN,HARGA,KETERANGAN,CREATED_BY,CREATED_DT) VALUES (:id,:jenis,:satuan,:harga,:ket,:user_id,SYSDATE)",
        { id: selected, jenis, satuan, harga, ket, user_id: user },
      );
    return { id: selected, before, after: { jenis, satuan, harga, ket } };
  }
  if (mode === "aset") {
    const sect = number(
      body.sect ?? body.kd_kategori ?? body.kategori ?? body.mdl_sect_data,
      "Kategori",
      true,
      true,
    );
    if (sect > 6) throw new InventoryError("Kategori tidak valid.");
    const before = id
      ? await one(
          conn,
          "SELECT * FROM SIAK_MASTER_ASET WHERE NO=:id AND SECT=:sect",
          { id, sect },
        )
      : undefined;
    if (id && !before)
      throw new InventoryError("Referensi aset tidak ditemukan.");
    if (action === "delete") {
      if (sect === 6) {
        await conn.execute(
          "LOCK TABLE SIAK_MONEV_WILAYAH IN EXCLUSIVE MODE WAIT 5",
        );
        await conn.execute(
          "LOCK TABLE SIAK_MONEV_WILAYAH_STOK IN EXCLUSIVE MODE WAIT 5",
        );
        const used = await one(
          conn,
          "SELECT (SELECT COUNT(*) FROM SIAK_MONEV_WILAYAH WHERE JENIS_BARANG=:id)+(SELECT COUNT(*) FROM SIAK_MONEV_WILAYAH_STOK WHERE JENIS_BARANG=:id) TOTAL FROM DUAL",
          { id },
        );
        if (Number(used?.TOTAL) > 0)
          throw new InventoryError(
            "Referensi aset dipakai oleh transaksi atau stok wilayah dan tidak dapat dihapus.",
          );
      }
      await conn.execute(
        "DELETE FROM SIAK_MASTER_ASET WHERE NO=:id AND SECT=:sect",
        { id, sect },
      );
      return { id, sect, before };
    }
    const description = text(
      body.value_data ?? body.descrip ?? body.mdl_value_data ?? body.keterangan,
      "Deskripsi",
      150,
    ).toUpperCase();
    const duplicate = await one(
      conn,
      "SELECT NO FROM SIAK_MASTER_ASET WHERE SECT=:sect AND UPPER(DESCRIP)=:description AND NO<>:id",
      { sect, description, id: id ?? -1 },
    );
    if (duplicate)
      throw new InventoryError("Deskripsi sudah terdaftar pada kategori ini.");
    const selected =
      id ??
      Number(
        (
          await one(
            conn,
            "SELECT NVL(MAX(NO),0)+1 ID FROM SIAK_MASTER_ASET WHERE SECT=:sect",
            { sect },
          )
        )?.ID,
      );
    if (id)
      await conn.execute(
        "UPDATE SIAK_MASTER_ASET SET DESCRIP=:description WHERE NO=:id AND SECT=:sect",
        { description, id, sect },
      );
    else
      await conn.execute(
        "INSERT INTO SIAK_MASTER_ASET (NO,DESCRIP,SECT) VALUES (:id,:description,:sect)",
        { id: selected, description, sect },
      );
    return { id: selected, sect, before, after: { description } };
  }
  const table = tables[mode];
  const before = id
    ? await one(conn, `SELECT * FROM ${table} WHERE SEQ_ID=:id`, { id })
    : undefined;
  if (id && !before) throw new InventoryError("Transaksi tidak ditemukan.");
  const kode =
    action === "delete"
      ? Number(before?.KODE_BARANG)
      : number(body.kd_brg ?? body.kode_barang, "Barang", true, true);
  const amount = action === "delete" ? 0 : number(body.jumlah, "Jumlah");
  const received =
    action === "delete" ? "" : text(body.received, "Penerima", 50);
  const ket =
    action === "delete" ? "" : text(body.keterangan, "Keterangan", 300, false);
  if (
    !(await one(
      conn,
      "SELECT BARANG_ID FROM SIAK_MASTER_BARANG WHERE BARANG_ID=:kode",
      { kode },
    ))
  )
    throw new InventoryError("Barang tidak terdaftar.");
  const codes = [
    ...new Set([kode, ...(before ? [Number(before.KODE_BARANG)] : [])]),
  ];
  if (action === "create") {
    const duplicate = await one(
      conn,
      `SELECT SEQ_ID FROM ${table} WHERE KODE_BARANG=:kode AND JUMLAH=:jumlah AND RECEIVED=:received AND NVL(KETERANGAN,' ')=NVL(:ket,' ') AND CREATED_BY=:user_id AND CREATED_DT>=SYSDATE-30/86400 AND ROWNUM=1`,
      { kode, jumlah: amount, received, ket, user_id: user },
    );
    if (duplicate) return { id: duplicate.SEQ_ID, duplicate: true };
  }
  for (const code of codes) {
    const balance = await one(
      conn,
      "SELECT NVL((SELECT SUM(JUMLAH) FROM SIAK_BARANG_MASUK WHERE KODE_BARANG=:code),0)-NVL((SELECT SUM(JUMLAH) FROM SIAK_BARANG_KELUAR WHERE KODE_BARANG=:code),0) BALANCE FROM DUAL",
      { code },
    );
    const old =
      before && Number(before.KODE_BARANG) === code ? Number(before.JUMLAH) : 0;
    const next = action === "delete" ? 0 : kode === code ? amount : 0;
    const delta = stockDelta(mode, action, old, next);
    if (Number(balance?.BALANCE) + delta < 0)
      throw new InventoryError(
        `Perubahan menyebabkan saldo negatif. Saldo saat ini ${balance?.BALANCE}.`,
      );
  }
  if (action === "delete") {
    await conn.execute(`DELETE FROM ${table} WHERE SEQ_ID=:id`, { id });
    return { id, before };
  }
  const selected =
    id ??
    Number(
      (await one(conn, `SELECT NVL(MAX(SEQ_ID),0)+1 ID FROM ${table}`))?.ID,
    );
  if (id)
    await conn.execute(
      `UPDATE ${table} SET KODE_BARANG=:kode,JUMLAH=:jumlah,RECEIVED=:received,KETERANGAN=:ket WHERE SEQ_ID=:id`,
      { id, kode, jumlah: amount, received, ket },
    );
  else
    await conn.execute(
      `INSERT INTO ${table} (SEQ_ID,KODE_BARANG,JUMLAH,RECEIVED,KETERANGAN,CREATED_BY,CREATED_DT) VALUES (:id,:kode,:jumlah,:received,:ket,:user_id,SYSDATE)`,
      { id: selected, kode, jumlah: amount, received, ket, user_id: user },
    );
  return { id: selected, before, after: { kode, amount, received, ket } };
}
export function saveInventory(
  mode: "master" | "masuk" | "keluar" | "aset",
  body: Record<string, unknown>,
  user: string,
) {
  return withTransaction(
    (conn) => mutateInventory(conn, mode, body, user),
    INVENTORY_ALIAS,
  );
}
