// 📄 src/app/api/dashboard/m1/route.ts
import { execOne } from "@/lib/db";
import { ok, err } from "@/lib/http";

export async function GET() {
  try {
    const row = await execOne<{ JML: number }>(
      `
      SELECT NVL(SUM(VAL),0) AS JML
      FROM VW_SIAK_DASHBOARD
      WHERE UPPER(ID) = 'GET_PEREKAMAN'
      `
    );

    const total = Number(row?.JML || 0);

    return ok({ perekaman_today: total.toLocaleString("id-ID") }, 30); 
  } catch (e) {
    console.error("❌ /dashboard/m1 error:", e);
    return err("Gagal mengambil data perekaman hari ini");
  }
}
