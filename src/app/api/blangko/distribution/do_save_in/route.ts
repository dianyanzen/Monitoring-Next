import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { execOne, withTransaction } from "@/lib/db";
import oracledb from "oracledb";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_BLANGKO ?? process.env.DB_ALIAS_PRR ?? "DB222";

type MaybeNumberRow = { JUMLAH?: number; jumlah?: number; JML?: number };

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const noKec = Number(body.no_kec ?? body.noKec ?? 0);
    const tanggal = String(body.tanggal ?? "").trim(); // DD-MM-YYYY
    const jnsBarang = Number(body.jns_barang ?? body.jenis_barang ?? 0);
    const jumlah = Number(body.jumlah ?? 0);
    const penerima = String(body.penerima ?? "").trim().toUpperCase();
    const ket = String(body.ket ?? body.keterangan ?? "").trim().toUpperCase();

    // Izinkan 0 (DINAS) sebagaimana legacy; hanya tolak nilai negatif / non-numerik
    if (!Number.isFinite(noKec) || noKec < 0) return badRequest("Kecamatan wajib dipilih.");
    if (!/^\d{2}-\d{2}-\d{4}$/.test(tanggal)) return badRequest("Tanggal tidak valid (DD-MM-YYYY).");
    if (!Number.isFinite(jnsBarang) || jnsBarang <= 0) return badRequest("Jenis barang wajib dipilih.");
    if (!Number.isFinite(jumlah) || jumlah <= 0) return badRequest("Jumlah harus lebih dari 0.");
    if (!penerima) return badRequest("Penerima wajib diisi.");

    const existSql = `
      SELECT JUMLAH
      FROM SIAK_MONEV_WILAYAH
      WHERE NO_KEC = :no_kec
        AND JENIS_BARANG = :jns_barang
        AND TO_CHAR(TANGGAL,'DD-MM-YYYY') = :tgl
        AND KATEGORI = 'IN'
    `;
    const existRow = await execOne<MaybeNumberRow>(existSql, { no_kec: noKec, jns_barang: jnsBarang, tgl: tanggal }, {}, ORACLE_ALIAS);
    const oldJumlah = Number(existRow?.JUMLAH ?? existRow?.jumlah ?? existRow?.JML ?? 0);

    const mode: "insert" | "update" = existRow ? "update" : "insert";
    let newStock = 0;
    await withTransaction(
      async (conn) => {
        if (existRow) {
          // Sudah ada transaksi IN untuk tanggal yang sama -> kurangi stok lama, tambah stok baru
          const updateSql = `
            UPDATE SIAK_MONEV_WILAYAH
            SET JUMLAH = :jumlah,
                KETERANGAN = :ket,
                PENERIMA = :penerima,
                TANGGAL = TO_DATE(:tgl,'DD-MM-YYYY')
            WHERE NO_KEC = :no_kec
              AND JENIS_BARANG = :jns_barang
              AND KATEGORI = 'IN'
              AND TO_CHAR(TANGGAL,'DD-MM-YYYY') = :tgl
          `;
          await conn.execute(updateSql, { jumlah, ket, penerima, tgl: tanggal, no_kec: noKec, jns_barang: jnsBarang }, { autoCommit: false });
        } else {
          // Transaksi IN baru
          const insertSql = `
            INSERT INTO SIAK_MONEV_WILAYAH (NO_KEC, JENIS_BARANG, JUMLAH, KETERANGAN, PENERIMA, TANGGAL, DIST_WILAYAH_ID, KATEGORI)
            VALUES (:no_kec, :jns_barang, :jumlah, :ket, :penerima, TO_DATE(:tgl,'DD-MM-YYYY'), DIST_WILAYAH_ID.NEXTVAL, 'IN')
          `;
          await conn.execute(insertSql, { no_kec: noKec, jns_barang: jnsBarang, jumlah, ket, penerima, tgl: tanggal }, { autoCommit: false });
        }

        // Rehitung stok dari tabel transaksi (IN - OUT) agar akurat
        const sumSql = `
          SELECT NVL(SUM(CASE WHEN KATEGORI = 'IN' THEN JUMLAH WHEN KATEGORI = 'OUT' THEN -JUMLAH ELSE 0 END),0) AS JUMLAH
          FROM SIAK_MONEV_WILAYAH
          WHERE NO_KEC = :no_kec AND JENIS_BARANG = :jns_barang
        `;
        const sumRes = await conn.execute(sumSql, { no_kec: noKec, jns_barang: jnsBarang }, { autoCommit: false, outFormat: oracledb.OUT_FORMAT_OBJECT });
        newStock = Number((sumRes.rows?.[0] as any)?.JUMLAH ?? 0);
        if (newStock < 0) throw new Error("Stok tidak boleh negatif.");

        const updateStockSql = `
          UPDATE SIAK_MONEV_WILAYAH_STOK
          SET JUMLAH = :newstock, TANGGAL = SYSDATE
          WHERE NO_WIL = :no_kec AND JENIS_BARANG = :jns_barang
        `;
        const up = await conn.execute(updateStockSql, { newstock: newStock, no_kec: noKec, jns_barang: jnsBarang }, { autoCommit: false });
        if ((up.rowsAffected ?? 0) === 0) {
          const insertStockSql = `
            INSERT INTO SIAK_MONEV_WILAYAH_STOK (NO_WIL, NAMA_WIL, JENIS_BARANG, NAMA_BARANG, JUMLAH, TANGGAL)
            SELECT :no_kec, NAMA_WIL, :jns_barang, COALESCE(M.DESCRIP,'BARANG '||:jns_barang), :newstock, SYSDATE
            FROM SIAK_KODE_WIL K
            LEFT JOIN SIAK_MASTER_ASET M ON M.SECT = 6 AND M.NO = :jns_barang
            WHERE K.NO_WIL = :no_kec
          `;
          await conn.execute(insertStockSql, { no_kec: noKec, jns_barang: jnsBarang, newstock: newStock }, { autoCommit: false });
        }
      },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "blangko/distribution/do_save_in",
      at: "/api/blangko/distribution/do_save_in",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { noKec, tanggal, jnsBarang, jumlah, mode, stockAfter: newStock },
    });

    return ok({ mode, newStock }, mode === "update" ? "Data berhasil diperbarui." : "Data berhasil disimpan.");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "blangko/distribution/do_save_in_err",
      at: "/api/blangko/distribution/do_save_in",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal menyimpan penerimaan aset.", 500);
  }
}
