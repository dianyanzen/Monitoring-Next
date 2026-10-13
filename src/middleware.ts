// File: middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyEdgeSession } from "@/lib/sessionEdge";

/** HANYA /login yang publik */
const PUBLIC_PATHS = [/^\/login$/];

/** Cek apakah path termasuk rute publik. */
function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((re) => re.test(pathname));
}

/** Redirect helper */
function redirect(url: URL, clearCookie = false) {
  const res = NextResponse.redirect(url);
  if (clearCookie) res.cookies.delete("session_user");
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Lewatkan file statis & API (sudah dicover di config.matcher, ini jaga-jaga)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    (!pathname.startsWith("/api/") &&
      /\.(svg|png|jpg|jpeg|gif|webp|css|js|ico|woff2?)$/i.test(pathname))
  ) {
    return NextResponse.next();
  }

  // Baca cookie sesi
  if (
    pathname === "/api/login" ||
    pathname === "/api/logout" ||
    pathname === "/api/cron/tracking-auto-complete"
  )
    return NextResponse.next();
  const session = await verifyEdgeSession(
    request.cookies.get("session_user")?.value,
    request.cookies.get("session_sig")?.value,
    process.env.SESSION_SECRET || "dev-secret-only-local",
  );
  if (pathname.startsWith("/api/")) {
    if (!session)
      return NextResponse.json(
        { success: false, message: "Unauthorized", data: {} },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    return NextResponse.next();
  }

  // Cookie corrupt → hapus & paksa login
  if (session === "INVALID_JSON") {
    const url = new URL("/login", request.url);
    return redirect(url, true);
  }

  // ======== KHUSUS ROOT "/" SESUAI PERMINTAAN ========
  if (pathname === "/") {
    // Belum login → ke /login
    if (!session) {
      return redirect(new URL("/login", request.url));
    }
    // Sudah login → arahkan sesuai level
    const level = Number(session.S_USER_LEVEL ?? session.USER_LEVEL ?? 0);
    if (level === 8) {
      return redirect(new URL("/laporanpindah", request.url));
    }
    return redirect(new URL("/dashboard", request.url));
  }
  // ====================================================

  // Belum login (selain halaman publik) → redirect ke /login?redirect=<path>
  if (!session) {
    if (isPublicPath(pathname)) return NextResponse.next();
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", pathname);
    return redirect(url);
  }

  // Sudah login → normalisasi level (angka)
  const level = Number(session.S_USER_LEVEL ?? session.USER_LEVEL ?? 0);

  // Akses /login → arahkan sesuai level
  if (pathname === "/login") {
    if (level === 8) {
      return redirect(new URL("/laporanpindah", request.url));
    }
    return redirect(new URL("/dashboard", request.url));
  }

  // Sudah login & bukan kasus khusus → lanjut
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next|assets|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico|woff|woff2)$).*)",
  ],
};
