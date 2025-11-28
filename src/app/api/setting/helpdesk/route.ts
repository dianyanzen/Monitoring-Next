// FILE: src/app/api/setting/helpdesk/route.ts
import type { NextRequest } from "next/server";
import { ok, err, badRequest, unauthorized } from "@/lib/http";
import { execRows, execOne, execDml } from "@/lib/db";
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

async function getNextId() {
  const row = await execOne<{ NEXT_ID?: number }>(
    `SELECT NVL(MAX(HELPDESK_ID), 0) + 1 AS NEXT_ID FROM SIAK_MASTER_HELPDESK`,
    {},
    {},
    ORACLE_ALIAS
  );
  return Number(row?.NEXT_ID ?? 0);
}

export async function GET(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const rows = await execRows<HelpdeskRow>(
      `
      SELECT HELPDESK_ID, HELPDESK_DESCRIPTION
      FROM SIAK_MASTER_HELPDESK
      ORDER BY HELPDESK_DESCRIPTION
      `,
      {},
      {},
      ORACLE_ALIAS
    );

    const data = rows.map((r) => ({
      helpdesk_id: Number(r.HELPDESK_ID),
      helpdesk_nm: normalizeText(r.HELPDESK_DESCRIPTION),
    }));

    await Log.info({
      scope: "API",
      msg: "helpdesk/list",
      at: "/api/setting/helpdesk",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { count: data.length },
    });

    return ok({ rows: data, total: data.length }, "Daftar helpdesk berhasil dimuat");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "helpdesk/list_err",
      at: "/api/setting/helpdesk",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat helpdesk");
  }
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const helpdeskNm =
      normalizeName(body.helpdesk_nm) ||
      normalizeName(body.helpdesk_name) ||
      normalizeName(body.description);

    if (!helpdeskNm) {
      return badRequest("Nama helpdesk wajib diisi", { field: "helpdesk_nm" });
    }

    const nextId = await getNextId();

    await execDml(
      `
      INSERT INTO SIAK_MASTER_HELPDESK (HELPDESK_ID, HELPDESK_DESCRIPTION, CREATED_DT, CREATED_BY)
      VALUES (:b_id, :b_nm, SYSDATE, :b_user)
      `,
      { b_id: nextId, b_nm: helpdeskNm, b_user: session.S_USER_ID },
      { autoCommit: true },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "helpdesk/create",
      at: "/api/setting/helpdesk",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { nextId },
    });

    return ok({ helpdesk_id: nextId }, "Helpdesk baru berhasil disimpan");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "helpdesk/create_err",
      at: "/api/setting/helpdesk",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal menyimpan helpdesk");
  }
}
