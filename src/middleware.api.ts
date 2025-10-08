// FILE: /middleware.api.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// middleware ini hanya untuk /api/ route
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // hanya intercept /api/
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  const cookie = req.cookies.get("session_user")?.value;
  if (!cookie) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = JSON.parse(cookie);
    if (!data?.S_USER_ID) {
      throw new Error("Invalid session payload");
    }
  } catch {
    const res = NextResponse.json({ success: false, message: "Session invalid" }, { status: 401 });
    res.cookies.delete("session_user");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
