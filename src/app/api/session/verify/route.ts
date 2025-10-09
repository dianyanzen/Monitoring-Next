// File: app/api/session/verify/route.ts
import { cookies } from "next/headers";
import { execOne } from "@/lib/db";
import { ok, badRequest, unauthorized } from "@/lib/http";

export async function GET() {
  const raw = (await cookies()).get("session_user")?.value;
  if (!raw) return unauthorized("Tidak ada sesi.");

  let data: any;
  try { data = JSON.parse(decodeURIComponent(raw)); } catch { return badRequest("Cookie sesi rusak."); }

  const uid = String(data?.S_USER_ID || "");
  const sid = String(data?.S_SESSION_ID || "");
  if (!uid || !sid) return badRequest("Session user tidak lengkap.");

  const row = await execOne<{ CNT?: number }>(
    `SELECT COUNT(1) AS CNT
       FROM SIAK_SESSION_PLUS
      WHERE USER_ID = :b_uid
        AND SESSION_ID = :b_sid
        AND IS_ACTIVE = 1`,
    { b_uid: uid, b_sid: sid },
    {},
    "DB"
  );

  const valid = Number(row?.CNT ?? 0) > 0;
  if (!valid) return unauthorized("Sesi tidak valid atau sudah berakhir.");
  return ok({ valid: true, user: data });
}
