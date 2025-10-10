// File: app/api/logout/route.ts
import { NextResponse } from "next/server";
import { execDml } from "@/lib/db";
import { readServerSession, clearSessionCookie } from "@/lib/session";

async function deactivateSession(userId?: string, sessionId?: string) {
  if (!userId || !sessionId) return 0;
  return execDml(
    `UPDATE SIAK_SESSION_PLUS
        SET LAST_ACTIVITY = SYSTIMESTAMP,
            IS_ACTIVE = 0
      WHERE USER_ID = :b_uid
        AND SESSION_ID = :b_sid`,
    { b_uid: userId, b_sid: sessionId },
    { autoCommit: true },
    "DB"
  );
}

function redirectToLogin(url: string) {
  const res = NextResponse.redirect(new URL("/login", url), { status: 303 });
  // Cache-safety
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// ── POST: cocok untuk fetch("/api/logout", { method: "POST" }) ────────────────
export async function POST() {
  const s = await readServerSession(); // bisa null kalau cookie invalid/expired
  if (s) {
    await deactivateSession(s.S_USER_ID, s.S_SESSION_ID);
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

// ── GET: kalau user mengunjungi /api/logout langsung di address bar ──────────
export async function GET(req: Request) {
  const s = await readServerSession();
  if (s) {
    await deactivateSession(s.S_USER_ID, s.S_SESSION_ID);
  }
  await clearSessionCookie();
  return redirectToLogin(req.url);
}
