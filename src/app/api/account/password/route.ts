// src/app/api/account/password/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import oracledb from "oracledb";
import { getOracleConnection } from "@/lib/oracle";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";

export const dynamic = "force-dynamic";

function md5(s: string) {
  return crypto.createHash("md5").update(s).digest("hex");
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const body = (await req.json().catch(() => null)) as {
    old_password?: string;
    new_password?: string;
  } | null;

  const session = await readServerSession().catch(() => null);
  const userId = session?.S_USER_ID?.trim();
  const { ip, ua } = await getClientInfo();

  // audit: attempt
  await Log.info({
    scope: "ACCOUNT",
    msg: "password/change_attempt",
    user: userId || "(no-session)",
    session: session?.S_SESSION_ID,
    ip, ua,
  });

  if (!userId) {
    await Log.warn({
      scope: "ACCOUNT",
      msg: "password/change_unauthorized",
      ip, ua,
    });
    return NextResponse.json({ message_type: 0, message: "Unauthorized" }, { status: 401 });
  }

  const old_password = (body?.old_password || "").trim();
  const new_password = (body?.new_password || "").trim();

  if (!old_password || !new_password) {
    await Log.warn({
      scope: "ACCOUNT",
      msg: "password/change_missing_fields",
      user: userId, session: session?.S_SESSION_ID, ip, ua,
    });
    return NextResponse.json({ message_type: 0, message: "Old/New password required" }, { status: 400 });
  }
  if (new_password.length < 4) {
    await Log.warn({
      scope: "ACCOUNT",
      msg: "password/change_new_too_short",
      user: userId, session: session?.S_SESSION_ID, ip, ua,
      extra: { len: new_password.length },
    });
    return NextResponse.json({ message_type: 0, message: "New password too short" }, { status: 400 });
  }

  const conn = await getOracleConnection();
  const SQL_CHECK = `SELECT 1 FROM VW_SIAK_USER WHERE USER_ID = :id AND USER_PWD = :pwd`;
  const SQL_UPDATE = `UPDATE SIAK_USER_PLUS SET USER_PWD = :newpwd WHERE USER_ID = :id`;

  try {
    // 1) verifikasi old password (VW kolom bertipe VARCHAR → bind STRING)
    const chk = await conn.execute(
      SQL_CHECK,
      {
        id:   { val: userId,          type: oracledb.STRING },
        pwd:  { val: md5(old_password), type: oracledb.STRING },
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!chk.rows?.length) {
      await Log.warn({
        scope: "ACCOUNT",
        msg: "password/change_old_mismatch",
        user: userId, session: session?.S_SESSION_ID, ip, ua,
        tookMs: Date.now() - t0,
        sql: SQL_CHECK,
        binds: { id: userId, pwd: "[md5]" },
      });
      return NextResponse.json({ message_type: 0, message: "Old password mismatch" }, { status: 400 });
    }

    // 2) update password (MD5 disamakan dengan sistem lama)
    const upd = await conn.execute(
      SQL_UPDATE,
      {
        newpwd: { val: md5(new_password), type: oracledb.STRING },
        id:     { val: userId,            type: oracledb.STRING },
      },
      { autoCommit: true }
    );

    await Log.info({
      scope: "ACCOUNT",
      msg: "password/change_success",
      user: userId, session: session?.S_SESSION_ID, ip, ua,
      tookMs: Date.now() - t0,
      extra: { rowsAffected: upd.rowsAffected || 0 },
      sql: SQL_UPDATE,
      binds: { newpwd: "[md5]", id: userId },
    });

    return NextResponse.json({ message_type: 1, message: "Password updated" });
  } catch (err: any) {
    await Log.error({
      scope: "ACCOUNT",
      msg: "password/change_exception",
      user: userId, session: session?.S_SESSION_ID, ip, ua,
      tookMs: Date.now() - t0,
      err: { name: err?.name || "Error", message: err?.message || String(err), stack: err?.stack },
      sql: err?.sql || undefined,
    });
    return NextResponse.json({ message_type: 0, message: err?.message || "DB error" }, { status: 500 });
  } finally {
    try { await conn.close(); } catch {}
  }
}
