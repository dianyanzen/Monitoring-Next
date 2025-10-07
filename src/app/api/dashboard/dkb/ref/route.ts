import { NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";

export async function GET() {
  let connection = null;
  try {
    connection = await getOracleConnection();

    const result = await connection.execute(
      `SELECT SYSTEM_VALUE_TXT AS VAL 
       FROM SIAK_MASTER 
       WHERE SYSTEM_TYPE = 'INIT_SETING' AND SYSTEM_CODE = 'DKB'`
    );

    const val = (result.rows?.[0]?.VAL || "").toString().trim();

    return NextResponse.json({
      success: true,
      dkb: val, // langsung kirim teks aslinya
    });
  } catch (err: any) {
    console.error("❌ DKB REF Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.close();
  }
}
