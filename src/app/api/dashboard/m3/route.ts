import { NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";

export async function GET() {
  let conn;
  try {
    conn = await getOracleConnection();
    const sql = `
      SELECT NVL(SUM(VAL),0) AS JML
      FROM VW_SIAK_DASHBOARD
      WHERE UPPER(ID) = 'GET_PRR'
    `;
    const row = (await conn.execute(sql)).rows?.[0] as any || {};
    return NextResponse.json({ success: true, sisa_prr: Number(row.JML).toLocaleString("id-ID") });
  } catch (err) {
    console.error("❌ /m3 error:", err);
    return NextResponse.json({ success: false, sisa_prr: "0" }, { status: 500 });
  } finally {
    if (conn) await conn.close();
  }
}
