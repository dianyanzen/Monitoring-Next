// FILE: src/app/api/setting/helpdesk/[helpdeskId]/route.ts
import type { NextRequest } from "next/server";
import { ok, err, badRequest, unauthorized } from "@/lib/http";
import { execOne, execDml } from "@/lib/db";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";

type HelpdeskRow = {
  HELPDESK_ID: number;
  HELPDESK_DESCRIPTION: string | null;
};

const normalizeText = (value: unknown) => (value == null ? "" : String(value).trim());
const normalizeName = (value: unknown) => normalizeText(value).toUpperCase();

async function loadById(id: number) {
  return execOne<HelpdeskRow>(
    `
    SELECT HELPDESK_ID, HELPDESK_DESCRIPTION
    FROM SIAK_MASTER_HELPDESK
    WHERE HELPDESK_ID = :b_id
    `,
    { b_id: id },
    {},
    ORACLE_ALIAS
  );
}

export async function GET(_: NextRequest, context: { params: Promise<{ helpdeskId: string }> }) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const { helpdeskId } = await context.params;
    const id = Number(helpdeskId ?? "");
    if (!Number.isFinite(id)) return badRequest("ID tidak valid");

    const row = await loadById(id);
    if (!row) return err("Helpdesk tidak ditemukan", 404);

    const data = {
      helpdesk_id: Number(row.HELPDESK_ID),
      helpdesk_nm: normalizeText(row.HELPDESK_DESCRIPTION),
    };

    await Log.info({
      scope: "API",
      msg: "helpdesk/detail",
      at: "/api/setting/helpdesk/[id]",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { id },
    });

    return ok(data, "Detail helpdesk berhasil dimuat");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "helpdesk/detail_err",
      at: "/api/setting/helpdesk/[id]",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal memuat helpdesk");
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ helpdeskId: string }> }) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const { helpdeskId } = await context.params;
    const id = Number(helpdeskId ?? "");
    if (!Number.isFinite(id)) return badRequest("ID tidak valid");

    const body = await req.json().catch(() => ({}));
    const helpdeskNm =
      normalizeName(body.helpdesk_nm) ||
      normalizeName(body.helpdesk_name) ||
      normalizeName(body.description);

    if (!helpdeskNm) {
      return badRequest("Nama helpdesk wajib diisi", { field: "helpdesk_nm" });
    }

    const exists = await loadById(id);
    if (!exists) return err("Helpdesk tidak ditemukan", 404);

    await execDml(
      `
      UPDATE SIAK_MASTER_HELPDESK
      SET HELPDESK_DESCRIPTION = :b_nm
      WHERE HELPDESK_ID = :b_id
      `,
      { b_nm: helpdeskNm, b_id: id },
      { autoCommit: true },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "helpdesk/update",
      at: "/api/setting/helpdesk/[id]",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { id },
    });

    return ok({ helpdesk_id: id }, "Helpdesk berhasil diperbarui");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "helpdesk/update_err",
      at: "/api/setting/helpdesk/[id]",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal memperbarui helpdesk");
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ helpdeskId: string }> }) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const { helpdeskId } = await context.params;
    const id = Number(helpdeskId ?? "");
    if (!Number.isFinite(id)) return badRequest("ID tidak valid");

    const exists = await loadById(id);
    if (!exists) return err("Helpdesk tidak ditemukan", 404);

    await execDml(
      `DELETE FROM SIAK_MASTER_HELPDESK WHERE HELPDESK_ID = :b_id`,
      { b_id: id },
      { autoCommit: true },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "helpdesk/delete",
      at: "/api/setting/helpdesk/[id]",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { id },
    });

    return ok({ helpdesk_id: id }, "Helpdesk berhasil dihapus");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "helpdesk/delete_err",
      at: "/api/setting/helpdesk/[id]",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal menghapus helpdesk");
  }
}
