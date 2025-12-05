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
  SELECT BARANG_ID, JENIS_BARANG, SATUAN, HARGA, KETERANGAN
  FROM SIAK_MASTER_BARANG
  ORDER BY BARANG_ID
`;

const sqlDetail = `
  SELECT BARANG_ID, JENIS_BARANG, SATUAN, HARGA, KETERANGAN, TO_CHAR(CREATED_DT,'DD-MM-YYYY') AS TANGGAL
  FROM SIAK_MASTER_BARANG
  WHERE BARANG_ID = :id
`;

const sqlNextId = `SELECT NVL(MAX(BARANG_ID) + 1, 1) AS ID FROM SIAK_MASTER_BARANG`;

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
    msg: "barang/master/list",
    at: "/api/barang/master",
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
      const id = toNumber(body.id);
      if (!id) return badRequest("Parameter id wajib diisi.");
      const row = await execOne(sqlDetail, { id }, {}, ORACLE_ALIAS);
      return ok(row);
    }

    if (action === "create") {
      const jenis = cleanStr(body.jenis_barang || body.jenis);
      const satuan = cleanStr(body.satuan);
      const harga = toNumber(body.harga ?? body.harga_satuan);
      const keterangan = cleanStr(body.keterangan);
      if (!jenis) return badRequest("Jenis barang wajib diisi.");
      if (!satuan) return badRequest("Satuan wajib diisi.");
      if (!harga) return badRequest("Harga wajib diisi.");

      const next = await execOne<{ ID?: number }>(sqlNextId, {}, {}, ORACLE_ALIAS);
      const id = Number(next?.ID ?? 1);

      await execDml(
        `
        INSERT INTO SIAK_MASTER_BARANG
          (BARANG_ID, JENIS_BARANG, SATUAN, HARGA, KETERANGAN, CREATED_BY, CREATED_DT)
        VALUES
          (:id, :jenis, :satuan, :harga, :ket, :user, SYSDATE)
      `,
        { id, jenis, satuan, harga, ket: keterangan, user: session.S_USER_ID },
        {},
        ORACLE_ALIAS
      );

      await Log.info({
        scope: "API",
        msg: "barang/master/create",
        at: "/api/barang/master",
        user: session.S_USER_ID,
        tookMs: Date.now() - started,
        extra: { id },
      });
      return ok({ id }, "Berhasil menyimpan master barang");
    }

    if (action === "update") {
      const id = toNumber(body.id || body.barang_id || body.kode_barang);
      const jenis = cleanStr(body.jenis_barang || body.jenis);
      const satuan = cleanStr(body.satuan);
      const harga = toNumber(body.harga ?? body.harga_satuan);
      const keterangan = cleanStr(body.keterangan);
      if (!id) return badRequest("ID barang wajib diisi.");
      if (!jenis) return badRequest("Jenis barang wajib diisi.");
      if (!satuan) return badRequest("Satuan wajib diisi.");
      if (!harga) return badRequest("Harga wajib diisi.");

      const affected = await execDml(
        `
        UPDATE SIAK_MASTER_BARANG
        SET JENIS_BARANG = :jenis,
            SATUAN = :satuan,
            HARGA = :harga,
            KETERANGAN = :ket,
            CHANGED_BY = :user,
            CHANGED_DT = SYSDATE
        WHERE BARANG_ID = :id
      `,
        { id, jenis, satuan, harga, ket: keterangan, user: session.S_USER_ID },
        {},
        ORACLE_ALIAS
      );
      if (!affected) return badRequest("Data tidak ditemukan.");

      await Log.info({
        scope: "API",
        msg: "barang/master/update",
        at: "/api/barang/master",
        user: session.S_USER_ID,
        tookMs: Date.now() - started,
        extra: { id },
      });
      return ok({ id }, "Berhasil memperbarui master barang");
    }

    if (action === "delete") {
      const id = toNumber(body.id || body.barang_id || body.barang);
      if (!id) return badRequest("ID barang wajib diisi.");

      await execDml(`DELETE FROM SIAK_BARANG_MASUK WHERE KODE_BARANG = :id`, { id }, {}, ORACLE_ALIAS);
      await execDml(`DELETE FROM SIAK_BARANG_KELUAR WHERE KODE_BARANG = :id`, { id }, {}, ORACLE_ALIAS);
      const affected = await execDml(`DELETE FROM SIAK_MASTER_BARANG WHERE BARANG_ID = :id`, { id }, {}, ORACLE_ALIAS);
      if (!affected) return badRequest("Data tidak ditemukan atau sudah dihapus.");

      await Log.info({
        scope: "API",
        msg: "barang/master/delete",
        at: "/api/barang/master",
        user: session.S_USER_ID,
        tookMs: Date.now() - started,
        extra: { id },
      });
      return ok({ id }, "Berhasil menghapus master barang");
    }

    return badRequest(`Aksi '${action}' tidak dikenali.`);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "barang/master/error",
      at: "/api/barang/master",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memproses permintaan master barang", 500);
  }
}
