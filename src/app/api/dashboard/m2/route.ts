// FILE: /app/api/dashboard/m2/route.ts
import { execOne } from "@/lib/db";
import { ok, err } from "@/lib/http";

export async function GET() {
  try {
    const row = await execOne<{ JML: number }>(`
      WITH LUDO AS (
        SELECT (AMBIL - RUSAK - PENGEMBALIAN) AS CETAK_LUDO
        FROM SIAK_MONEV_BLANGKO_LUDO
        WHERE TRUNC(TANGGAL) = TRUNC(SYSDATE)
        FETCH FIRST 1 ROWS ONLY
      )
      SELECT NVL(B.VAL,0) + NVL((SELECT CETAK_LUDO FROM LUDO),0) AS JML
      FROM VW_SIAK_DASHBOARD B
      WHERE UPPER(B.ID) = 'GET_PENCETAKAN_KTP'
    `);

    const val = Number(row?.JML ?? 0);
    const formatted = val.toLocaleString("id-ID");

    return ok({ pencetakan_today: formatted });
  } catch (e) {
    console.error("❌ /api/dashboard/m2 error:", e);
    return err("DB error pencetakan_today");
  }
}
