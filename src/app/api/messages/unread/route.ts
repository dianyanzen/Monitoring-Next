import { NextResponse } from "next/server";
import { withConnection } from "@/lib/oracle";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const sessionRaw = (await cookies()).get("session_user")?.value;
    if (!sessionRaw) {
      return NextResponse.json({ success: false, message: "Unauthorized", count: 0 }, { status: 401 });
    }

    const sessionData = JSON.parse(sessionRaw);
    const nik = Number(sessionData.S_NIK ?? 0);
    if (!nik) {
      return NextResponse.json({ success: false, message: "Invalid session", count: 0 }, { status: 401 });
    }

    const sql = `
      SELECT COUNT(DISTINCT(FROM_ID)) AS JML
      FROM MESSAGES
      WHERE TO_ID = :nik AND READ = 0
    `;

    const result = await withConnection("DB", (conn) =>
      conn.execute(sql, { nik }, {
        outFormat: (conn as any).oracledb?.OUT_FORMAT_OBJECT ?? undefined,
      })
    );

    // 🔹 Safe fallback
    const rows = (result as any)?.rows ?? [];
    const count = rows.length > 0 ? Number(rows[0]?.JML ?? 0) : 0;

    return NextResponse.json({ success: true, count });
  } catch (e) {
    console.error("Unread API error:", e);
    return NextResponse.json({ success: false, count: 0 }, { status: 500 });
  }
}
