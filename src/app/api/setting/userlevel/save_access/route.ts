import type { NextRequest } from "next/server";
import { ok, err, badRequest, unauthorized } from "@/lib/http";
import { withTransaction } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Body:
 * {
 *   user_level: string|number,        // numerik
 *   checkedIds: (string|number)[]     // daftar MENU_ID terpilih (boleh kosong)
 * }
 *
 * Langkah:
 * 1) Set IS_ACTIVE = 0 untuk semua baris level tsb.
 * 2) Set IS_ACTIVE = 1 untuk pilihan + parent (maks 2 tingkat) seperti legacy.
 */
export async function POST(req: NextRequest) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    // --- Parse & validasi body ---
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return badRequest("Invalid JSON");
    }

    const lvlRaw = String(body?.user_level ?? "").trim();
    if (!/^\d+$/.test(lvlRaw)) return badRequest("Missing/invalid user_level");
    const userLevel = Number(lvlRaw);

    const rawIds = Array.isArray(body?.checkedIds) ? body.checkedIds : [];
    const ids = rawIds
      .map((v: any) => String(v).trim())
      .filter((v) => /^\d+$/.test(v))
      .map((v) => Number(v));

    // Helper bikin placeholder bind IN (:b_m0,:b_m1,...)
    const bindList = (vals: number[]) => {
      const bind: Record<string, number> = {};
      const ph: string[] = [];
      vals.forEach((v, i) => {
        const k = `b_m${i}`;
        bind[k] = v;
        ph.push(`:${k}`);
      });
      return { bind, text: ph.join(",") };
    };

    await withTransaction(async (conn) => {
      // 1) Matikan semua
      await conn.execute(
        `
        UPDATE SIAK_AKSES
           SET IS_ACTIVE = 0
         WHERE USER_LEVEL = :b_lvl
        `,
        { b_lvl: userLevel },
        { autoCommit: false }
      );

      // 2) Aktifkan pilihan + parent (maks 2 tingkat)
      if (ids.length > 0) {
        const { bind, text } = bindList(ids);
        await conn.execute(
          `
          UPDATE SIAK_AKSES C
             SET IS_ACTIVE = 1
           WHERE C.USER_LEVEL = :b_lvl
             AND C.MENU_ID IN (
               /* menu terpilih */
               SELECT MENU_ID FROM SIAK_MENU WHERE MENU_ID IN (${text})
               UNION
               /* parent 1 */
               SELECT DISTINCT PARENT_ID FROM SIAK_MENU WHERE MENU_ID IN (${text})
               UNION
               /* parent 2 */
               SELECT DISTINCT PARENT_ID
                 FROM SIAK_MENU
                WHERE MENU_ID IN (
                  SELECT PARENT_ID FROM SIAK_MENU WHERE MENU_ID IN (${text})
                )
             )
          `,
          { b_lvl: userLevel, ...bind },
          { autoCommit: false }
        );
      }
    });

    return ok({ message: "Hak akses disimpan." });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "save_access_failed",
      at: "/api/setting/userlevel/save_access",
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal menyimpan hak akses");
  }
}
