// FILE: src/app/api/report/absensi/daily-options/route.ts
import { readServerSession } from "@/lib/session";
import { ok, unauthorized, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";

type DailyOptionRow = {
  ACTIVITY_ID: number | string;
  ACTIVITY: string;
  MINUTE: number | string;
};

export async function GET() {
  const started = Date.now();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();

    const userId = String(sess.S_USER_ID);

    const sql = `
      SELECT
        A.ACTIVITY_ID,
        A.ACTIVITY,
        A.MINUTE
      FROM SIAK_ACTIVITY A
      INNER JOIN SIAK_USER_PLUS B
        ON A.USER_LEVEL = B.ACTIVITY_LEVEL
      WHERE B.USER_ID = :b_user_id
      ORDER BY A.ACTIVITY_ID
    `;

    const rows = await execRows<DailyOptionRow>(
      sql,
      { b_user_id: userId },
      {},
      ORACLE_ALIAS
    );

    return ok(
      rows.map((r) => ({
        activity_id: r.ACTIVITY_ID,
        activity: r.ACTIVITY,
        minute: r.MINUTE,
      }))
    );
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "ABSENSI_DAILY_OPTIONS",
      at: "/api/report/absensi/daily-options",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal memuat daftar aktivitas harian");
  }
}
