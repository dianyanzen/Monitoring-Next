import { NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";

export async function GET() {
  let conn;
  try {
    conn = await getOracleConnection();

    const sql = `
      SELECT 
        TO_CHAR(MAX(CREATED_DT),'DD-MM-YYYY') AS DASHBOARD_DATE,
        TO_CHAR(MAX(CREATED_DT),'HH24:MI:SS') AS DASHBOARD_TIME,
        ROUND( (SYSDATE - MAX(CREATED_DT)) * 24 * 60 ) AS DIFF_MINUTES
      FROM SIAK_DASHBOARD
    `;
    const row = (await conn.execute(sql)).rows?.[0] as any || {};

    const diffMin = Number(row.DIFF_MINUTES ?? 9999);
    const between = diffMin > 10 ? 0 : 1;

    return NextResponse.json({
      success: true,
      dashboard_date: row.DASHBOARD_DATE || "00-00-0000",
      dashboard_time: row.DASHBOARD_TIME || "00:00:00",
      dashboard_between: between,
      dashboard_minutes: diffMin,
    });
  } catch (err) {
    console.error("❌ /time error:", err);
    return NextResponse.json({ success: false, message: "DB error time" }, { status: 500 });
  } finally {
    if (conn) await conn.close();
  }
}
