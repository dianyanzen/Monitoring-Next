import { NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";

/**
 * 🔹 Logout API untuk sistem Monitoring Futuristik
 * Fungsi ini mereplikasi behavior dologout() Laravel:
 * - Update SIAK_SESSION_PLUS: IS_ACTIVE = 0, LAST_ACTIVITY = SYSDATE
 * - Menghapus cookie session_user
 * - Redirect user ke halaman login
 */

export async function POST(req: Request) {
  let connection;

  try {
    // Koneksi ke Oracle
    connection = await getOracleConnection();

    // Ambil cookie session_user dari request
    const cookieHeader = req.headers.get("cookie");
    const match = cookieHeader?.match(/session_user=([^;]+)/);

    // Jika tidak ada session, langsung hapus cookie dan redirect
    if (!match) {
      const res = NextResponse.redirect(new URL("/login", req.url));
      res.cookies.delete("session_user");
      return res;
    }

    // Parse data session user dari cookie
    const session = JSON.parse(decodeURIComponent(match[1]));
    const user_id = session.S_USER_ID;

    // Cek apakah user punya record aktif
    const check = await connection.execute(
      `SELECT COUNT(1) AS CNT FROM SIAK_SESSION_PLUS WHERE USER_ID = :uid`,
      [user_id]
    );

    const count =
      Array.isArray(check.rows) && check.rows.length > 0
        ? (check.rows[0] as any).CNT
        : 0;

    // Jika ada record, update statusnya jadi nonaktif
    if (count > 0) {
      await connection.execute(
        `
        UPDATE SIAK_SESSION_PLUS
        SET LAST_ACTIVITY = SYSDATE,
            IS_ACTIVE = 0
        WHERE USER_ID = :uid
        `,
        [user_id],
        { autoCommit: true }
      );
    }

    // Hapus cookie session_user dan redirect ke halaman login
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete("session_user");

    return response;
  } catch (err) {
    console.error("🔴 Logout Error:", err);
    return NextResponse.json(
      { success: false, message: "Error during logout" },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.close();
  }
}

// 🔹 Boleh juga akses langsung via GET (misal klik link Logout)
export async function GET(req: Request) {
  return POST(req);
}
