import { NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";

function fmtID(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export async function GET() {
  let conn;
  try {
    conn = await getOracleConnection();
    const row = (await conn.execute(`
      SELECT SYSTEM_VALUE_TXT AS VAL
      FROM SIAK_MASTER
      WHERE SYSTEM_CODE = 'DKB_CUTOFF'
    `)).rows?.[0] as any;

    const cutoffTxt: string = row?.VAL || "01/01/2025"; // "dd/mm/yyyy"
    const [dd, mm, yyyy] = cutoffTxt.split("/");
    const cutoff = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    const today = new Date();

    const periode = `Periode ${fmtID(cutoff)} - ${fmtID(today)}`;

    return NextResponse.json({ success: true, periode });
  } catch (err) {
    console.error("❌ /period error:", err);
    return NextResponse.json({ success: false, periode: "" }, { status: 500 });
  } finally {
    if (conn) await conn.close();
  }
}
