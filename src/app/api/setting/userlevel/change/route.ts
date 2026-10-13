// FILE: src/app/api/setting/userlevel/change/route.ts
import { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { ok, badRequest, unauthorized, err } from "@/lib/http";
import { execDml } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const { code, levelName } = await req.json();
    const c = String(code ?? "").replace(/[^\d]/g, "");
    const name = String(levelName ?? "").trim();
    if (!c) return badRequest("Parameter 'code' wajib diisi");
    if (!name) return badRequest("Parameter 'levelName' wajib diisi");

    await execDml(
      `UPDATE SIAK_USER_LEVEL SET LEVEL_NAME = :b_level_name WHERE USER_LEVEL = :b_code`,
      { b_level_name: name, b_code: c }
    );

    return ok({ message: "Level name berhasil diperbarui." });
  } catch (e: any) {
    return err("Gagal memperbarui level name");
  }
}
