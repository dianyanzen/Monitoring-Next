// FILE: src/app/api/setting/userlevel/head/route.ts
import type { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { ok, badRequest, unauthorized, err } from "@/lib/http";
import { execRows } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";

type RawHead = {
  USER_LEVEL: number | string;
  LEVEL_NAME: string | null;   // nama level user (A.LEVEL_NAME)
  GROUP_NAME: string | null;   // nama grup (B.LEVEL_NAME)
};

const onlyDigits = (s: string) => s.replace(/[^\d]/g, "");

export async function GET(req: NextRequest) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const url = new URL(req.url);
    const codeRaw = (url.searchParams.get("code") ?? "").trim();
    const code = onlyDigits(codeRaw);
    if (!code) return badRequest("Parameter 'code' wajib diisi");

    // Ambil head informasi sesuai tampilan legacy:
    // CODE = USER_LEVEL, GROUP NAME = A.LEVEL_NAME, GROUP LEVEL = B.LEVEL_NAME
    const rows = await execRows<RawHead>(
      `
      SELECT
        A.USER_LEVEL,
        A.LEVEL_NAME,
        B.LEVEL_NAME AS GROUP_NAME
      FROM SIAK_USER_LEVEL A
      INNER JOIN SIAK_USER_GROUP B ON A.GROUP_LEVEL = B.LEVEL_CODE
      WHERE A.USER_LEVEL = :b_code
      `,
      { b_code: code },
      {},
      ORACLE_ALIAS
    );

    const r = Array.isArray(rows) && rows.length ? rows[0] : null;
    const data = r ? {
      user_level: String(r.USER_LEVEL ?? "").trim(),
      level_name: String(r.LEVEL_NAME ?? "").trim(),
      group_name: String(r.GROUP_NAME ?? "").trim(),
    } : null;

    return ok({ data });
  } catch (e: any) {
    return err("Gagal memuat head user level");
  }
}
