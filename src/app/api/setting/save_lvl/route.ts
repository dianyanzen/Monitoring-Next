import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { ok, badRequest, err, requireParams } from "@/lib/http";
import { readServerSession } from "@/lib/session";

type SaveBody = {
  lvl_cd?: string | number;
  lvl_nm?: string;
  kdgroup?: string | number;
};

export async function POST(req: Request) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) {
      return NextResponse.json({ success: false, message: "Unauthorized", data: {} }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as SaveBody;
    const lvl_cd = String(body.lvl_cd ?? "").trim();
    const lvl_nm = String(body.lvl_nm ?? "").trim();
    const kdgroup = String(body.kdgroup ?? "").trim();

    // Validasi dasar
    if (!/^\d{1,3}$/.test(lvl_cd)) {
      return badRequest("Level Code harus numerik (maks 3 digit)", { field: "lvl_cd" });
    }
    if (!lvl_nm) {
      return badRequest("Level Name wajib diisi", { field: "lvl_nm" });
    }
    if (!/^\d+$/.test(kdgroup)) {
      return badRequest("Group Level tidak valid", { field: "kdgroup" });
    }

    const CREATED_BY = String(sess.S_USER_ID);

    await withTransaction(async (conn) => {
      // INSERT SIAK_USER_LEVEL
      await conn.execute(
        `
        INSERT INTO SIAK_USER_LEVEL
          (USER_LEVEL, LEVEL_NAME, GROUP_LEVEL, CREATED_DATE, CREATED_BY)
        VALUES
          (:b_lvl_cd, :b_lvl_nm, :b_kdgroup, SYSDATE, :b_created_by)
        `,
        {
          b_lvl_cd: Number(lvl_cd),
          b_lvl_nm: lvl_nm.toUpperCase(),
          b_kdgroup: Number(kdgroup),
          b_created_by: CREATED_BY,
        },
        { autoCommit: false }
      );

      // SEED SIAK_AKSES untuk semua menu yang belum ada barisnya
      await conn.execute(
        `
        INSERT INTO SIAK_AKSES (USER_LEVEL, MENU_ID, IS_ACTIVE)
        SELECT :b_lvl_cd AS USER_LEVEL, M.MENU_ID, 0 AS IS_ACTIVE
        FROM SIAK_MENU M
        LEFT JOIN SIAK_AKSES A
          ON A.MENU_ID = M.MENU_ID AND A.USER_LEVEL = :b_lvl_cd
        WHERE A.MENU_ID IS NULL
        ORDER BY M.MENU_ID
        `,
        { b_lvl_cd: Number(lvl_cd) },
        { autoCommit: false }
      );
    });

    return ok({ message: "Data Berhasil Disimpan" });
  } catch (e: any) {
    return err("Gagal menyimpan Level");
  }
}
