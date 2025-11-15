// FILE: src/app/api/setting/users/check/route.ts
import type { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { ok, unauthorized, badRequest, err } from "@/lib/http";
import { execOne } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";
const AT = "/api/setting/users/check";

type RawCheckRow = {
  USER_ID?: string;
  NAMA_LGKP?: string;
};

export async function GET(req: NextRequest) {
  const started = Date.now();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();

    const { searchParams } = new URL(req.url);
    const raw = (searchParams.get("user_id") ?? "").trim();
    if (!raw) return badRequest("Parameter 'user_id' wajib diisi");

    const userId = raw.toUpperCase();

    const row = await execOne<RawCheckRow>(
      `
      SELECT USER_ID, NAMA_LGKP
      FROM SIAK_USER_PLUS
      WHERE UPPER(USER_ID) = :b_uid
      `,
      { b_uid: userId },
      {},
      ORACLE_ALIAS
    );

    const exists = !!row;
    const data = {
      is_exists: exists ? 1 : 0,
      nama_lgkp: row?.NAMA_LGKP?.trim() ?? null,
    };

    await Log.info({
      scope: "API",
      msg: "setting/users/check_ok",
      at: AT,
      user: sess.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { userId, exists },
    });

    return ok(data, "Cek user ID");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "setting/users/check_err",
      at: AT,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal mengecek user ID");
  }
}
