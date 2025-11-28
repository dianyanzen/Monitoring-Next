// FILE: src/app/api/setting/pejabat/[pejabatId]/route.ts
import type { NextRequest } from "next/server";
import { readServerSession, getClientInfo } from "@/lib/session";
import { ok, unauthorized, err, badRequest } from "@/lib/http";
import { execOne, execDml } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";
const AT = "/api/setting/pejabat/[pejabatId]";

const normalizeNip = (value: unknown) => String(value ?? "").replace(/[^\d]/g, "");
const normalizeUpper = (value: unknown) => String(value ?? "").trim().toUpperCase();
const normalizeStruktural = (value: unknown) => {
  if (value === true || String(value).trim() === "1") return 1;
  return 0;
};

async function getPejabatRow(id: number) {
  return execOne<{
    PEJABAT_ID: number;
    NIP: string | number | null;
    NAMA: string | null;
    JABATAN: string | null;
    IS_STRUKTURAL: number | string | null;
  }>(
    `
    SELECT PEJABAT_ID, NIP, NAMA, JABATAN, IS_STRUKTURAL
    FROM SIAK_PEJABAT
    WHERE PEJABAT_ID = :b_id
    `,
    { b_id: id },
    {},
    ORACLE_ALIAS
  );
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ pejabatId: string }> }
) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const { pejabatId } = await context.params;
    const id = Number(pejabatId);
    if (!Number.isFinite(id) || id <= 0) return badRequest("ID pejabat tidak valid");

    const row = await getPejabatRow(id);
    if (!row) return err("Pejabat tidak ditemukan", 404);

    const data = {
      pejabat_id: row.PEJABAT_ID,
      nip: row.NIP == null ? "" : String(row.NIP),
      nama: row.NAMA?.trim() ?? "",
      jabatan: row.JABATAN?.trim() ?? "",
      is_struktural: Number(row.IS_STRUKTURAL ?? 0) === 1,
    };

    await Log.info({
      scope: "API",
      msg: "pejabat/detail",
      at: AT,
      user: sess.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { id },
    });

    return ok(data);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "pejabat/detail_err",
      at: AT,
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat detail pejabat");
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ pejabatId: string }> }
) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const { pejabatId } = await context.params;
    const id = Number(pejabatId);
    if (!Number.isFinite(id) || id <= 0) return badRequest("ID pejabat tidak valid");

    const body = await req.json().catch(() => ({}));
    const nip = normalizeNip(body.nip);
    const nama = normalizeUpper(body.nama);
    const jabatan = normalizeUpper(body.jabatan);
    const isStruktural = normalizeStruktural(body.is_struktural ?? body.struktural);

    if (!nip) return badRequest("NIP pejabat wajib diisi", { field: "nip" });
    if (nip.length < 8 || nip.length > 30) {
      return badRequest("Format NIP tidak valid", { field: "nip" });
    }
    if (!nama) return badRequest("Nama pejabat wajib diisi", { field: "nama" });
    if (!jabatan) return badRequest("Jabatan pejabat wajib diisi", { field: "jabatan" });

    const existed = await getPejabatRow(id);
    if (!existed) return err("Pejabat tidak ditemukan", 404);

    await execDml(
      `
      UPDATE SIAK_PEJABAT
      SET NIP = :b_nip,
          NAMA = :b_nama,
          JABATAN = :b_jabatan,
          IS_STRUKTURAL = :b_struktural
      WHERE PEJABAT_ID = :b_id
      `,
      {
        b_id: id,
        b_nip: nip,
        b_nama: nama,
        b_jabatan: jabatan,
        b_struktural: isStruktural,
      },
      { autoCommit: true },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "pejabat/update",
      at: AT,
      user: sess.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { id },
    });

    return ok({ pejabat_id: id }, "Pejabat berhasil diperbarui");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "pejabat/update_err",
      at: AT,
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memperbarui pejabat");
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ pejabatId: string }> }
) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const { pejabatId } = await context.params;
    const id = Number(pejabatId);
    if (!Number.isFinite(id) || id <= 0) return badRequest("ID pejabat tidak valid");

    const affected = await execDml(
      `DELETE FROM SIAK_PEJABAT WHERE PEJABAT_ID = :b_id`,
      { b_id: id },
      { autoCommit: true },
      ORACLE_ALIAS
    );

    if (!affected) {
      return err("Pejabat tidak ditemukan", 404);
    }

    await Log.info({
      scope: "API",
      msg: "pejabat/delete",
      at: AT,
      user: sess.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { id },
    });

    return ok({ pejabat_id: id }, "Pejabat berhasil dihapus");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "pejabat/delete_err",
      at: AT,
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal menghapus pejabat");
  }
}
