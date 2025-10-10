// File: app/api/session/ping/route.ts
import { NextResponse } from "next/server";
import { execDml } from "@/lib/db";
import { readServerSession, maybeRefreshSession } from "@/lib/session";

export async function POST() {
  const s = await readServerSession();
  if (!s) return NextResponse.json({ ok: false, message: "No session" }, { status: 401 });

  await execDml(
    `UPDATE SIAK_SESSION_PLUS
        SET LAST_ACTIVITY = SYSTIMESTAMP
      WHERE USER_ID = :b_uid AND SESSION_ID = :b_sid AND IS_ACTIVE = 1`,
    { b_uid: s.S_USER_ID, b_sid: s.S_SESSION_ID },
    { autoCommit: true },
    "DB"
  );

  // sliding session (perpanjang cookie jika masih valid)
  await maybeRefreshSession();

  return NextResponse.json({ ok: true, pong: true });
}
