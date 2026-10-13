import { NextResponse } from "next/server";
import { execOne } from "@/lib/db";
import { ok, badRequest, err } from "@/lib/http";

/**
 * POST body:
 *   { "lvl_cd": "3" }
 * Response (200):
 *   { success:true, message:"OK", data:{ is_exists: 1|0, lvl_name: "..." } }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const lvlCdRaw = (body?.lvl_cd ?? "").toString().trim();

    if (!lvlCdRaw) {
      return badRequest("Level Code wajib diisi", { field: "lvl_cd" });
    }
    if (!/^\d{1,3}$/.test(lvlCdRaw)) {
      return badRequest("Level Code harus numerik (maks 3 digit)", { field: "lvl_cd" });
    }

    const row = await execOne<{ JML?: number; LEVEL_NAME?: string }>(
      `
      SELECT 
        COALESCE(COUNT(1),0) AS JML,
        COALESCE(MAX(CASE WHEN LEVEL_NAME IS NOT NULL THEN LEVEL_NAME ELSE '-' END), '-') AS LEVEL_NAME
      FROM SIAK_USER_LEVEL
      WHERE USER_LEVEL = :b_lvl_cd
      `,
      { b_lvl_cd: Number(lvlCdRaw) }
    );

    const isExists = (row?.JML ?? 0) > 0 ? 1 : 0;
    const lvlName = (row?.LEVEL_NAME ?? "-").toString();

    return ok({ is_exists: isExists, lvl_name: lvlName });
  } catch (e: any) {
    return err("Gagal memeriksa Level Code");
  }
}
