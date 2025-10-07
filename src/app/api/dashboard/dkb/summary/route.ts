import { NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";

export async function GET() {
  let connection = null;
  try {
    connection = await getOracleConnection();

    const result = await connection.execute(`
      SELECT DKB, SUM(R1) AS R1, SUM(R2) AS R2, SUM(JUMLAH) AS JUMLAH
      FROM SIAK_STT_JK
      GROUP BY DKB
      ORDER BY DKB DESC
    `);

    return NextResponse.json({
      success: true,
      rows: result.rows || [],
    });
  } catch (err: any) {
    console.error("❌ DKB SUMMARY Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.close();
  }
}
