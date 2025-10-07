import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;
  const sessionCookie = request.cookies.get("session_user");
  let data: any = null;

  // ✅ Aman: parse cookie JSON tanpa crash
  if (sessionCookie) {
    try {
      data = JSON.parse(sessionCookie.value);
    } catch (err) {
      console.warn("⚠️ Invalid session cookie detected, deleting...");
      const res = NextResponse.redirect(new URL("/login", request.url));
      res.cookies.delete("session_user");
      return res;
    }
  }

  // 🔹 1. Belum login → arahkan ke /login (kecuali sudah di /login)
  if (!data && !pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 🔹 2. Sudah login dan akses /login → arahkan sesuai level
  if (data && pathname === "/login") {
    if (data.S_USER_LEVEL === 8) {
      return NextResponse.redirect(new URL("/laporanpindah", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 🔹 3. Sudah login dan akses root "/" → arahkan sesuai level
  if (data && pathname === "/") {
    if (data.S_USER_LEVEL === 8) {
      return NextResponse.redirect(new URL("/laporanpindah", request.url));
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 🔹 4. Jika sudah login dan akses lain → lanjut normal
  return NextResponse.next();
}

// ✅ Terapkan middleware ke semua route kecuali _next, api, dan file statis
export const config = {
  matcher: [
    "/((?!_next|api|assets|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico|woff|woff2)$).*)",
  ],
};
