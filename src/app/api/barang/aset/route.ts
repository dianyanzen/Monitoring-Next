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
  SELECT NO, DESCRIP, SECT
  FROM SIAK_MASTER_ASET
  WHERE SECT = :sect
  ORDER BY NO
`;

const sqlDetail = `
  SELECT NO, DESCRIP, SECT
  FROM SIAK_MASTER_ASET
  WHERE NO = :no AND SECT = :sect
`;

const sqlNextId = `
  SELECT NVL(MAX(NO) + 1, 1) AS ID
  FROM SIAK_MASTER_ASET
  WHERE SECT = :sect
`;

function cleanStr(v: unknown) {
  return String(v ?? "").trim();
}

function toNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function handleList(sect: number, userId: string) {
  const t0 = Date.now();
  const rows = await execRows(sqlList, { sect }, {}, ORACLE_ALIAS);
  await Log.info({
    scope: "API",
    msg: "barang/aset/list",
    at: "/api/barang/aset",
    user: userId,
    tookMs: Date.now() - t0,
    extra: { sect, count: rows.length },
  });
  return ok(rows);
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const session = await readServerSession();
  if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

  const body = (await req.json().catch(() => ({}))) as Record<string, any>;
  const action = (body.action || "list").toLowerCase() as Action;
  const sect = toNumber(body.sect || body.kd_kategori || body.kategori);

  try {
    if (action === "list") {
      if (!sect) return badRequest("Kategori wajib dipilih.");
      return await handleList(sect, session.S_USER_ID);
    }

    if (action === "detail") {
      const no = toNumber(body.no || body.aset_no);
      if (!sect || !no) return badRequest("Kategori dan nomor wajib diisi.");
      const row = await execOne(sqlDetail, { sect, no }, {}, ORACLE_ALIAS);
      return ok(row);
    }

    if (action === "create") {
      if (!sect) return badRequest("Kategori wajib dipilih.");
      const desc = cleanStr(body.value_data || body.descrip || body.keterangan).toUpperCase();
      if (!desc) return badRequest("Deskripsi wajib diisi.");

      const next = await execOne<{ ID?: number }>(sqlNextId, { sect }, {}, ORACLE_ALIAS);
      const id = Number(next?.ID ?? 1);

      await execDml(
        `INSERT INTO SIAK_MASTER_ASET (NO, DESCRIP, SECT) VALUES (:id, :desc, :sect)`,
        { id, desc, sect },
        {},
        ORACLE_ALIAS
      );

      await Log.info({
        scope: "API",
        msg: "barang/aset/create",
        at: "/api/barang/aset",
        user: session.S_USER_ID,
        tookMs: Date.now() - started,
        extra: { id, sect },
      });
      return ok({ id, sect }, "Berhasil menambah master aset");
    }

    if (action === "update") {
      const no = toNumber(body.no || body.aset_no || body.mdl_no_data);
      const sec = sect || toNumber(body.mdl_sect_data);
      const desc = cleanStr(body.value_data || body.descrip || body.mdl_value_data || body.keterangan).toUpperCase();
      if (!no || !sec) return badRequest("Nomor dan kategori aset wajib diisi.");
      if (!desc) return badRequest("Deskripsi wajib diisi.");

      const affected = await execDml(
        `
        UPDATE SIAK_MASTER_ASET
        SET DESCRIP = :desc
        WHERE NO = :no AND SECT = :sect
      `,
        { desc, no, sect: sec },
        {},
        ORACLE_ALIAS
      );
      if (!affected) return badRequest("Data tidak ditemukan.");

      await Log.info({
        scope: "API",
        msg: "barang/aset/update",
        at: "/api/barang/aset",
        user: session.S_USER_ID,
        tookMs: Date.now() - started,
        extra: { no, sect: sec },
      });
      return ok({ no, sect: sec }, "Berhasil memperbarui master aset");
    }

    if (action === "delete") {
      const no = toNumber(body.no || body.aset_no);
      if (!sect || !no) return badRequest("Kategori dan nomor wajib diisi.");

      const affected = await execDml(
        `DELETE FROM SIAK_MASTER_ASET WHERE NO = :no AND SECT = :sect`,
        { no, sect },
        {},
        ORACLE_ALIAS
      );
      if (!affected) return badRequest("Data tidak ditemukan atau sudah dihapus.");

      await Log.info({
        scope: "API",
        msg: "barang/aset/delete",
        at: "/api/barang/aset",
        user: session.S_USER_ID,
        tookMs: Date.now() - started,
        extra: { no, sect },
      });
      return ok({ no, sect }, "Berhasil menghapus master aset");
    }

    return badRequest(`Aksi '${action}' tidak dikenali.`);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "barang/aset/error",
      at: "/api/barang/aset",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memproses master aset", 500);
  }
}
