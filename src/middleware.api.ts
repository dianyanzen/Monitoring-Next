// FILE: /middleware.api.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyPayload, decodeCookie } from "@/lib/session";
import { Log } from "@/lib/log";

/**
 * Middleware ini memproteksi semua route /api/*
 * - Wajib ada cookie: session_user + session_sig
 * - Verifikasi HMAC signature (timing-safe)
 * - Decode payload aman (percent-encoded JSON)
 * - Logging audit untuk unauthorized/invalid
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Hanya intercept /api/
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  // (Opsional) Izinkan preflight CORS tanpa auth
  if (req.method === "OPTIONS") {
    return NextResponse.next();
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    "127.0.0.1";
  const ua = req.headers.get("user-agent") || "";

  const raw = req.cookies.get("session_user")?.value;
  const sig = req.cookies.get("session_sig")?.value;

  if (!raw || !sig) {
    await Log.warn({
      scope: "MIDDLEWARE",
      msg: "API unauthorized (no cookies)",
      at: pathname,
      ip,
      ua,
    });
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  // Verifikasi signature (HMAC) dulu
  const okSig = verifyPayload(raw, sig);
  if (!okSig) {
    await Log.warn({
      scope: "MIDDLEWARE",
      msg: "API invalid signature",
      at: pathname,
      ip,
      ua,
    });
    const res = NextResponse.json(
      { success: false, message: "Session invalid" },
      { status: 401 }
    );
    res.cookies.delete("session_user");
    res.cookies.delete("session_sig");
    return res;
  }

  // Decode payload aman
  const data = decodeCookie(raw);
  if (
    !data ||
    !data.S_USER_ID ||
    !data.S_SESSION_ID ||
    !String(data.S_NIK || "").trim()
  ) {
    await Log.warn({
      scope: "MIDDLEWARE",
      msg: "API invalid payload fields",
      at: pathname,
      ip,
      ua,
    });
    const res = NextResponse.json(
      { success: false, message: "Session invalid" },
      { status: 401 }
    );
    res.cookies.delete("session_user");
    res.cookies.delete("session_sig");
    return res;
  }

  // (Opsional) sliding refresh di layer route handler saja,
  // supaya tidak menulis cookie dari middleware. Di sini cukup loloskan.
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
