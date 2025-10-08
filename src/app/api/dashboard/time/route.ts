// 📄 src/app/api/dashboard/time/route.ts
import { execOne } from "@/lib/db";
import { ok, err } from "@/lib/http";

/**
 * Endpoint: GET /api/dashboard/time
 * Mengecek waktu update terakhir data dashboard (dari tabel SIAK_DASHBOARD)
 */
export async function GET() {
  try {
    const row = await execOne<{
      DASHBOARD_DATE: string;
      DASHBOARD_TIME: string;
      DIFF_MINUTES: number;
    }>(
      `
      SELECT 
        TO_CHAR(MAX(CREATED_DT),'DD-MM-YYYY') AS DASHBOARD_DATE,
        TO_CHAR(MAX(CREATED_DT),'HH24:MI:SS') AS DASHBOARD_TIME,
        ROUND((SYSDATE - MAX(CREATED_DT)) * 24 * 60) AS DIFF_MINUTES
      FROM SIAK_DASHBOARD
      `
    );

    const diffMin = Number(row?.DIFF_MINUTES ?? 9999);
    const between = diffMin > 10 ? 0 : 1;

    return ok(
      {
        dashboard_date: row?.DASHBOARD_DATE || "00-00-0000",
        dashboard_time: row?.DASHBOARD_TIME || "00:00:00",
        dashboard_between: between,
        dashboard_minutes: diffMin,
      },
      15 // cache 15 detik, bisa disesuaikan
    );
  } catch (e) {
    console.error("❌ /dashboard/time error:", e);
    return err("Gagal mengambil waktu pembaruan dashboard");
  }
}
