// File: middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Daftar path publik (tanpa sesi) yang boleh diakses. */
const PUBLIC_PATHS = [/^\/$/, /^\/login$/];

/** Cek apakah path termasuk rute publik. */
function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((re) => re.test(pathname));
}

/** Parse cookie sesi dengan aman (support kemungkinan URI-encoded). */
function readSessionCookie(request: NextRequest) {
  const raw = request.cookies.get("session_user")?.value;
  if (!raw) return null;
  try {
    const decoded = (() => {
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    })();
    return JSON.parse(decoded) as any;
  } catch {
    return "INVALID_JSON";
  }
}

/** Redirect helper */
function redirect(url: URL, clearCookie = false) {
  const res = NextResponse.redirect(url);
  if (clearCookie) res.cookies.delete("session_user");
  return res;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Lewatkan semua file statis & API (sudah dicover di config.matcher, ini jaga-jaga)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/api") ||
    /\.(svg|png|jpg|jpeg|gif|webp|css|js|ico|woff2?)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Baca cookie sesi
  const session = readSessionCookie(request);

  // Cookie corrupt → hapus & paksa login
  if (session === "INVALID_JSON") {
    const url = new URL("/login", request.url);
    return redirect(url, true);
  }

  // Belum login
  if (!session) {
    // Boleh akses halaman publik (/, /login)
    if (isPublicPath(pathname)) return NextResponse.next();

    // Selain publik → redirect ke /login dengan parameter redirect
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

  // Akses root "/" → arahkan sesuai level
  if (pathname === "/") {
    if (level === 8) {
      return redirect(new URL("/laporanpindah", request.url));
    }
    return redirect(new URL("/dashboard", request.url));
  }

  // Sudah login & bukan kasus khusus → lanjut
  return NextResponse.next();
}

export const config = {
  // Kecualikan _next, api, assets, favicon, dan static files
  matcher: [
    "/((?!_next|api|assets|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico|woff|woff2)$).*)",
  ],
};
