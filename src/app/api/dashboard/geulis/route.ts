// FILE: /app/api/dashboard/geulis/route.ts
import { execRows } from "@/lib/db";
import { ok, err } from "@/lib/http";

export async function GET() {
  try {
    const sql = `
      SELECT 
        A.NO_WIL,
        CASE WHEN B.NAMA_WIL = 'CITYLINK' THEN 'KIWARI' ELSE B.NAMA_WIL END AS NAMA_WIL,
        SUM(REKAM) AS TOTAL_REKAM, 
        SUM(CETAK) AS TOTAL_CETAK, 
        SUM(IKD) AS TOTAL_IKD, 
        SUM(AKTE_17) AS TOTAL_AKTE_17, 
        SUM(KIA) AS TOTAL_KIA, 
        SUM(JUMLAH) AS TOTAL_JUMLAH
      FROM SIAK_MONEV_LAPORAN A
      LEFT JOIN SIAK_KODE_WIL B ON A.NO_WIL = B.NO_WIL
      WHERE TRUNC(A.TANGGAL) BETWEEN TRUNC(SYSDATE - 30) AND TRUNC(SYSDATE)
        AND B.NAMA_WIL IN ('CITYLINK', 'BTC', 'MIM', 'DPRD', 'GPP', 'MPP')
      GROUP BY A.NO_WIL, CASE WHEN B.NAMA_WIL = 'CITYLINK' THEN 'KIWARI' ELSE B.NAMA_WIL END
      ORDER BY A.NO_WIL
    `;

    const rows = await execRows<{
      NO_WIL: string;
      NAMA_WIL: string;
      TOTAL_REKAM: number;
      TOTAL_CETAK: number;
      TOTAL_IKD: number;
      TOTAL_AKTE_17: number;
      TOTAL_KIA: number;
      TOTAL_JUMLAH: number;
    }>(sql);

    return ok(rows);
  } catch (e) {
    console.error("❌ /api/dashboard/geulis error:", e);
    return err("DB error geulis");
  }
}
