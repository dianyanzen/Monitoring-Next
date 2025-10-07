import { NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";

export async function GET() {
  let conn;
  try {
    conn = await getOracleConnection();
    const sql = `
      SELECT 
        A.NO_WIL,
        B.NAMA_WIL,
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
      GROUP BY A.NO_WIL, B.NAMA_WIL
      ORDER BY A.NO_WIL
    `;
    const rows = (await conn.execute(sql)).rows || [];
    return NextResponse.json({ success: true, rows });
  } catch (err) {
    console.error("❌ /geulis error:", err);
    return NextResponse.json({ success: false, rows: [] }, { status: 500 });
  } finally {
    if (conn) await conn.close();
  }
}
