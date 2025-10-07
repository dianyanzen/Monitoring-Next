import { NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";

export async function GET() {
  let conn;
  try {
    conn = await getOracleConnection();
    const sql = `
      WITH LUDO AS (
        SELECT (AMBIL - RUSAK - PENGEMBALIAN) AS CETAK_LUDO
        FROM SIAK_MONEV_BLANGKO_LUDO
        WHERE TRUNC(TANGGAL) = TRUNC(SYSDATE)
        FETCH FIRST 1 ROWS ONLY
      )
      SELECT NVL(B.VAL,0) + NVL((SELECT CETAK_LUDO FROM LUDO),0) AS JML
      FROM VW_SIAK_DASHBOARD B
      WHERE UPPER(B.ID) = 'GET_PENCETAKAN_KTP'
    `;
    const row = (await conn.execute(sql)).rows?.[0] as any || {};
    return NextResponse.json({ success: true, pencetakan_today: Number(row.JML).toLocaleString("id-ID") });
  } catch (err) {
    console.error("❌ /m2 error:", err);
    return NextResponse.json({ success: false, pencetakan_today: "0" }, { status: 500 });
  } finally {
    if (conn) await conn.close();
  }
}
