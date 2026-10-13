import type { NextRequest } from "next/server";
import { ok, err, badRequest } from "@/lib/http";
import { execDml } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_PRR ?? "DB222";

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const sql = `DELETE FROM SIAK_DASHBOARD WHERE ID = 'GET_SFE' AND TRUNC(CREATED_DT) = TRUNC(SYSDATE)`;
    const affected = await execDml(sql, {}, {}, ORACLE_ALIAS);

    await Log.info({
      scope: "API",
      msg: "dashboard/update_sfe",
      at: "/api/dashboard/update_sfe",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { affected },
    });

    return ok({ affected }, "Data Berhasil Di Hapus");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "dashboard/update_sfe_err",
      at: "/api/dashboard/update_sfe",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal menghapus data SFE", 500);
  }
}
