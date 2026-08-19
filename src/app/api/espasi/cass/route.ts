import type { NextRequest } from "next/server";
import { ok, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import { ESPASI_DB_ALIAS, ensureSession, getLimit } from "@/lib/espasi/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const started = Date.now();
  const auth = await ensureSession();
  if (auth.error) return auth.error;

  const limit = getLimit(req, 100, 500);

  try {
    const rows = await execRows(
      `
      SELECT * FROM (
        SELECT *
        FROM SMSDISDUK.CASS_LAHIR@SMSDISDUK
        ORDER BY TANGGAL DESC
      ) WHERE ROWNUM <= :b_limit
      `,
      { b_limit: limit },
      {},
      ESPASI_DB_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "espasi/cass",
      at: "/api/espasi/cass",
      user: auth.session?.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { limit, rows: rows.length },
    });

    return ok(rows);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "espasi/cass/error",
      at: "/api/espasi/cass",
      user: auth.session?.S_USER_ID,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat data cass", 500);
  }
}
