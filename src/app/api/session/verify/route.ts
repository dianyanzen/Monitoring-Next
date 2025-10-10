// File: app/api/session/verify/route.ts
import { NextResponse } from "next/server";
import { execOne } from "@/lib/db";
import { readServerSession } from "@/lib/session";

export async function GET() {
  const s = await readServerSession();
  if (!s) return NextResponse.json({ ok: false, message: "Tidak ada sesi." }, { status: 401 });

  const row = await execOne<{ CNT?: number }>(
    `SELECT COUNT(1) AS CNT
       FROM SIAK_SESSION_PLUS
      WHERE USER_ID = :b_uid
        AND SESSION_ID = :b_sid
        AND IS_ACTIVE = 1`,
    { b_uid: s.S_USER_ID, b_sid: s.S_SESSION_ID },
    {},
    "DB"
  );

  const valid = Number(row?.CNT ?? 0) > 0;
  if (!valid) {
    return NextResponse.json(
      { ok: false, message: "Sesi tidak valid atau sudah berakhir." },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true, valid: true, user: s });
}
