// FILE: /app/api/dashboard/m7/route.ts
import { execOne } from "@/lib/db";
import { ok, err } from "@/lib/http";

export async function GET() {
  try {
    const row = await execOne<{ JML: number }>(`
      SELECT NVL(SUM(VAL),0) AS JML
      FROM VW_SIAK_DASHBOARD
      WHERE UPPER(ID) = 'GET_DUPLICATE'
    `);

    const val = Number(row?.JML ?? 0);
    const formatted = val.toLocaleString("id-ID");

    return ok({ duplicate: formatted });
  } catch (e) {
    console.error("❌ /api/dashboard/m7 error:", e);
    return err("DB error duplicate");
  }
}
