// FILE: src/app/api/setting/userlevel/delete/route.ts
import type { NextRequest } from "next/server";
import { ok, fail, err, badRequest, unauthorized } from "@/lib/http";
import { execOne, withTransaction } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    // body boleh { user_level } atau { lvl_cd }
    let body: any = {};
    try { body = await req.json(); } catch { return badRequest("Invalid JSON"); }

    const raw = String(body?.user_level ?? body?.lvl_cd ?? "").trim();
    if (!/^\d+$/.test(raw)) return badRequest("Level Code tidak valid");
    const userLevel = Number(raw);

    // 1) Cek apakah level masih dipakai user
    const row = await execOne<{ CNT?: number }>(
      `SELECT COUNT(1) AS CNT FROM SIAK_USER_PLUS WHERE USER_LEVEL = :b_lvl`,
      { b_lvl: userLevel }
    );
    const inUse = Number(row?.CNT ?? 0);
    if (inUse > 0) {
      return fail(`Tidak dapat menghapus level karena masih ada ${inUse} user yang menggunakan level ini. Pindahkan/ubah level user terlebih dahulu.`);
    }

    // 2) Hapus dalam transaksi (akses → level)
    await withTransaction(async (conn) => {
      await conn.execute(
        `DELETE FROM SIAK_AKSES WHERE USER_LEVEL = :b_lvl`,
        { b_lvl: userLevel },
        { autoCommit: false }
      );
      await conn.execute(
        `DELETE FROM SIAK_USER_LEVEL WHERE USER_LEVEL = :b_lvl`,
        { b_lvl: userLevel },
        { autoCommit: false }
      );
    });

    return ok({ message: "Level & hak akses berhasil dihapus." });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "delete_userlevel_failed",
      at: "/api/setting/userlevel/delete",
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal menghapus level");
  }
}
