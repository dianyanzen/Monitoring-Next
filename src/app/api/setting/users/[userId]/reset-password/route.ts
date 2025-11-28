// FILE: src/app/api/setting/users/[userId]/reset-password/route.ts
import crypto from "crypto";
import type { NextRequest } from "next/server";
import { readServerSession, getClientInfo } from "@/lib/session";
import { ok, unauthorized, err, badRequest } from "@/lib/http";
import { execDml } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";

function toMd5(raw: string) {
  return crypto.createHash("md5").update(raw).digest("hex");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const started = Date.now();
  const { userId } = await params;
  const targetId = (userId ?? "").trim().toUpperCase();
  if (!targetId) return badRequest("User ID wajib diisi");

  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();
    const { ip, ua } = await getClientInfo();

    const body = (await req.json().catch(() => null)) as { new_password?: string } | null;
    const fallback = process.env.SETTING_USER_DEFAULT_PASS ?? "123456";
    const plainPass = (body?.new_password?.trim() || fallback).trim();
    if (!plainPass) return badRequest("Password baru tidak boleh kosong");
    if (plainPass.length < 4) return badRequest("Password minimal 4 karakter");

    const rowsAffected = await execDml(
      `UPDATE SIAK_USER_PLUS SET USER_PWD = :b_pwd WHERE UPPER(USER_ID) = :b_uid`,
      { b_pwd: toMd5(plainPass), b_uid: targetId },
      { autoCommit: true },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "setting/users/reset_password",
      at: `/api/setting/users/${targetId}/reset-password`,
      user: sess.S_USER_ID,
      extra: { rowsAffected },
      ip,
      ua,
      tookMs: Date.now() - started,
    });

    if (rowsAffected === 0) return badRequest(`User ${targetId} tidak ditemukan`);

    return ok({
      user_id: targetId,
      new_password: plainPass,
    });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "setting/users/reset_password_err",
      at: `/api/setting/users/${targetId}/reset-password`,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal me-reset password user");
  }
}
