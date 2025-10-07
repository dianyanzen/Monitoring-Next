import { NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";

async function handleLogout(req: Request) {
  let connection: any;

  try {
    console.log("🔍 [Logout] Starting logout process...");
    connection = await getOracleConnection();
    console.log("✅ Oracle connection acquired.");

    const cookieHeader = req.headers.get("cookie");
    console.log("🍪 Cookie header:", cookieHeader);

    const match = cookieHeader?.match(/session_user=([^;]+)/);

    // Jika tidak ada cookie session
    if (!match) {
      console.warn("⚠️ Tidak ada cookie session_user.");
      const res = NextResponse.redirect(new URL("/login", req.url));
      res.cookies.delete("session_user");
      return res;
    }

    // Parse session_user JSON
    let user_id = "";
    try {
      const session = JSON.parse(decodeURIComponent(match[1]));
      user_id = session?.S_USER_ID ?? "";
      console.log("🧾 Parsed session:", session);
      console.log("🪪 user_id:", user_id);
    } catch (err) {
      console.error("❌ Gagal parsing session cookie:", err);
      const res = NextResponse.redirect(new URL("/login", req.url));
      res.cookies.delete("session_user");
      return res;
    }

    // Cek kalau tidak ada user_id
    if (!user_id) {
      console.warn("⚠️ Tidak ada user_id dalam session.");
      const res = NextResponse.redirect(new URL("/login", req.url));
      res.cookies.delete("session_user");
      return res;
    }

    // ✅ Update status logout di Oracle
    console.log("🟡 Menonaktifkan session untuk user:", user_id);

    await connection.execute(
      `UPDATE SIAK_SESSION_PLUS 
      SET LAST_ACTIVITY = SYSDATE, IS_ACTIVE = 0 
      WHERE USER_ID = :1`,
      [user_id], // ← pakai array, bukan object
      { autoCommit: true }
    );


    console.log("✅ Session user berhasil diupdate di Oracle.");

    // Hapus cookie dan redirect ke /login
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete("session_user");
    console.log("🚪 Logout sukses. Cookie dihapus.");

    return response;
  } catch (err) {
    console.error("🔴 Logout Error:", err);
    return NextResponse.json(
      { success: false, message: "Error during logout" },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.close();
      console.log("🔌 Oracle connection closed.");
    }
  }
}

// Route handler untuk POST dan GET
export async function POST(req: Request) {
  return handleLogout(req);
}

export async function GET(req: Request) {
  return handleLogout(req);
}
