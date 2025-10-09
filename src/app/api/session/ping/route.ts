// File: app/api/session/ping/route.ts
import { cookies } from "next/headers";
import { execDml } from "@/lib/db";
import { ok, unauthorized } from "@/lib/http";

export async function POST() {
  const raw = (await cookies()).get("session_user")?.value;
  if (!raw) return unauthorized("No session");
  let s: any; try { s = JSON.parse(decodeURIComponent(raw)); } catch { return unauthorized("Bad session"); }

  if (!s?.S_USER_ID) return unauthorized("Bad session");
  await execDml(
    `UPDATE SIAK_SESSION_PLUS
        SET LAST_ACTIVITY = SYSTIMESTAMP
      WHERE USER_ID = :b_uid AND IS_ACTIVE = 1`,
    { b_uid: s.S_USER_ID },
    { autoCommit: true },
    "DB"
  );
  return ok({ pong: true });
}
