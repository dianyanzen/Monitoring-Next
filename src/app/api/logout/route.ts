// File: app/api/logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { execDml } from "@/lib/db";

async function readSession() {
  const raw = (await cookies()).get("session_user")?.value;
  if (!raw) return null;
  try { return JSON.parse(decodeURIComponent(raw)); } catch { return null; }
}

async function deactivateSession(userId?: string) {
  if (!userId) return;
  await execDml(
    `UPDATE SIAK_SESSION_PLUS
        SET LAST_ACTIVITY = SYSTIMESTAMP,
            IS_ACTIVE = 0
      WHERE USER_ID = :b_uid`,
    { b_uid: userId },
    { autoCommit: true },
    "DB"
  );
}

function redirectToLogin(url: string) {
  const res = NextResponse.redirect(new URL("/login", url), { status: 303 });
  res.cookies.set("session_user", "", { httpOnly: true, path: "/", maxAge: 0, secure: true, sameSite: "lax" });
  return res;
}

export async function POST(req: Request) {
  const s = await readSession();
  await deactivateSession(s?.S_USER_ID);
  return redirectToLogin(req.url);
}
export async function GET(req: Request) {
  const s = await readSession();
  await deactivateSession(s?.S_USER_ID);
  return redirectToLogin(req.url);
}
