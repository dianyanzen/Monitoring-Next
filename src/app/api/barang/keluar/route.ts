import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { execDml, execOne, execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "list" | "create" | "update" | "delete" | "detail";

const ORACLE_ALIAS = process.env.DB_ALIAS_BARANG ?? process.env.DB_ALIAS_PRR ?? "DB222";

const sqlList = `
  SELECT 
    A.SEQ_ID,
    A.KODE_BARANG,
    B.JENIS_BARANG,
    A.JUMLAH,
    B.SATUAN,
    (A.JUMLAH * B.HARGA) AS HARGA,
    TO_CHAR(A.CREATED_DT,'DD-MM-YYYY') AS TANGGAL,
    A.RECEIVED,
    A.KETERANGAN
  FROM SIAK_BARANG_KELUAR A
  LEFT JOIN SIAK_MASTER_BARANG B ON A.KODE_BARANG = B.BARANG_ID
  ORDER BY A.CREATED_DT DESC, A.SEQ_ID DESC
`;

const sqlDetail = `
  SELECT 
    A.SEQ_ID,
    A.KODE_BARANG,
    B.JENIS_BARANG,
    A.JUMLAH,
    B.SATUAN,
    (A.JUMLAH * B.HARGA) AS HARGA,
    TO_CHAR(A.CREATED_DT,'DD-MM-YYYY') AS TANGGAL,
    A.RECEIVED,
    A.KETERANGAN
  FROM SIAK_BARANG_KELUAR A
  LEFT JOIN SIAK_MASTER_BARANG B ON A.KODE_BARANG = B.BARANG_ID
  WHERE A.SEQ_ID = :id
`;

const sqlNextId = `SELECT NVL(MAX(SEQ_ID) + 1, 1) AS ID FROM SIAK_BARANG_KELUAR`;

function cleanStr(v: unknown) {
  return String(v ?? "").trim();
}

function toNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function handleList(userId: string) {
  const t0 = Date.now();
  const rows = await execRows(sqlList, {}, {}, ORACLE_ALIAS);
  await Log.info({
    scope: "API",
    msg: "barang/keluar/list",
    at: "/api/barang/keluar",
    user: userId,
    tookMs: Date.now() - t0,
    extra: { count: rows.length },
  });
  return ok(rows);
}

export async function GET() {
  const session = await readServerSession();
  if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");
  return handleList(session.S_USER_ID);
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const session = await readServerSession();
  if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

  const body = (await req.json().catch(() => ({}))) as Record<string, any>;
  const action = (body.action || "list").toLowerCase() as Action;

  try {
    if (action === "list") {
      return await handleList(session.S_USER_ID);
    }

    if (action === "detail") {
      const id = toNumber(body.id || body.seq_id || body.kode_barang);
      if (!id) return badRequest("ID transaksi wajib diisi.");
      const row = await execOne(sqlDetail, { id }, {}, ORACLE_ALIAS);
      return ok(row);
    }

    if (action === "create") {
      const kode = toNumber(body.kd_brg || body.kode_barang);
      const received = cleanStr(body.received);
      const jumlah = toNumber(body.jumlah);
      const ket = cleanStr(body.keterangan);
      if (!kode) return badRequest("Pilih barang terlebih dahulu.");
      if (!jumlah) return badRequest("Jumlah wajib diisi.");
      if (!received) return badRequest("Penerima wajib diisi.");
      if (!ket) return badRequest("Keterangan wajib diisi.");

      const next = await execOne<{ ID?: number }>(sqlNextId, {}, {}, ORACLE_ALIAS);
      const id = Number(next?.ID ?? 1);

      await execDml(
        `
        INSERT INTO SIAK_BARANG_KELUAR
          (SEQ_ID, KODE_BARANG, RECEIVED, JUMLAH, KETERANGAN, CREATED_BY, CREATED_DT)
        VALUES
          (:id, :kode, :received, :jumlah, :ket, :user, SYSDATE)
      `,
        { id, kode, received, jumlah, ket, user: session.S_USER_ID },
        {},
        ORACLE_ALIAS
      );

      await Log.info({
        scope: "API",
        msg: "barang/keluar/create",
        at: "/api/barang/keluar",
        user: session.S_USER_ID,
        tookMs: Date.now() - started,
        extra: { id },
      });
      return ok({ id }, "Berhasil menyimpan barang keluar");
    }

    if (action === "update") {
      const id = toNumber(body.id || body.seq_id || body.kode_barang);
      const kode = toNumber(body.kd_brg || body.kode_barang);
      const received = cleanStr(body.received);
      const jumlah = toNumber(body.jumlah);
      const ket = cleanStr(body.keterangan);
      if (!id) return badRequest("ID transaksi wajib diisi.");
      if (!kode) return badRequest("Pilih barang terlebih dahulu.");
      if (!jumlah) return badRequest("Jumlah wajib diisi.");
      if (!received) return badRequest("Penerima wajib diisi.");
      if (!ket) return badRequest("Keterangan wajib diisi.");

      const affected = await execDml(
        `
        UPDATE SIAK_BARANG_KELUAR
        SET KODE_BARANG = :kode,
            RECEIVED = :received,
            JUMLAH = :jumlah,
            KETERANGAN = :ket,
            CREATED_BY = :user,
            CREATED_DT = SYSDATE
        WHERE SEQ_ID = :id
      `,
        { id, kode, received, jumlah, ket, user: session.S_USER_ID },
        {},
        ORACLE_ALIAS
      );
      if (!affected) return badRequest("Data tidak ditemukan.");

      await Log.info({
        scope: "API",
        msg: "barang/keluar/update",
        at: "/api/barang/keluar",
        user: session.S_USER_ID,
        tookMs: Date.now() - started,
        extra: { id },
      });
      return ok({ id }, "Berhasil memperbarui barang keluar");
    }

    if (action === "delete") {
      const id = toNumber(body.id || body.seq_id || body.barang);
      if (!id) return badRequest("ID transaksi wajib diisi.");

      const affected = await execDml(
        `DELETE FROM SIAK_BARANG_KELUAR WHERE SEQ_ID = :id`,
        { id },
        {},
        ORACLE_ALIAS
      );
      if (!affected) return badRequest("Data tidak ditemukan atau sudah dihapus.");

      await Log.info({
        scope: "API",
        msg: "barang/keluar/delete",
        at: "/api/barang/keluar",
        user: session.S_USER_ID,
        tookMs: Date.now() - started,
        extra: { id },
      });
      return ok({ id }, "Berhasil menghapus barang keluar");
    }

    return badRequest(`Aksi '${action}' tidak dikenali.`);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "barang/keluar/error",
      at: "/api/barang/keluar",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memproses barang keluar", 500);
  }
}
