import type { NextRequest } from "next/server";
import { err, ok, unauthorized } from "@/lib/http";
import { Log } from "@/lib/log";
import { getClientInfo, readServerSession } from "@/lib/session";
import { syncAutoCompletedTracking } from "@/lib/tracking/auto-complete";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isCronAuthorized(req: NextRequest, sessionUserId?: string | null) {
  if (sessionUserId) return true;

  const configuredKey = String(process.env.TRACKING_AUTO_SYNC_KEY || "").trim();
  if (!configuredKey) return false;

  const providedKey = String(req.headers.get("x-auto-sync-key") || req.nextUrl.searchParams.get("key") || "").trim();
  return providedKey !== "" && providedKey === configuredKey;
}

export async function GET(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession().catch(() => null);
    if (!isCronAuthorized(req, session?.S_USER_ID || null)) {
      return unauthorized("Unauthorized");
    }

    const result = await syncAutoCompletedTracking();

    await Log.info({
      scope: "API",
      msg: "tracking/auto_complete_cron",
      at: "/api/cron/tracking-auto-complete",
      user: session?.S_USER_ID || "CRON",
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { updatedCount: result.updatedCount },
    });

    return ok(result, "Sinkronisasi auto-complete tracking berhasil dijalankan");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "tracking/auto_complete_cron_err",
      at: "/api/cron/tracking-auto-complete",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal menjalankan sinkronisasi auto-complete tracking");
  }
}
