// FILE: src/app/api/setting/helpdesk/options/route.ts
import { ok, err, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
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

export async function GET() {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const rows = await execRows<HelpdeskRow>(
      `SELECT HELPDESK_ID, HELPDESK_DESCRIPTION FROM SIAK_MASTER_HELPDESK ORDER BY HELPDESK_DESCRIPTION`,
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
      msg: "helpdesk/options",
      at: "/api/setting/helpdesk/options",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { count: data.length },
    });

    return ok(data, "Daftar helpdesk option");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "helpdesk/options_err",
      at: "/api/setting/helpdesk/options",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat helpdesk option");
  }
}
