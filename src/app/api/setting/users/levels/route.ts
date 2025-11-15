// FILE: src/app/api/setting/users/levels/route.ts
import type { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { ok, unauthorized, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";

type RawLevel = {
  USER_LEVEL: number | string;
  LEVEL_NAME: string;
  GROUP_LEVEL: string;
  GROUP_NAME: string;
};

export async function GET(req: NextRequest) {
  const started = Date.now();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();

    const { searchParams } = new URL(req.url);
    const group = (searchParams.get("group") || "").trim();

    let sql: string;
    const binds: Record<string, unknown> = {};

    if (group) {
      // mode: filter per LEVEL USER (1/2/3) → dipakai di form Add/Edit User
      sql = `
        SELECT
          A.USER_LEVEL,
          A.LEVEL_NAME,
          A.GROUP_LEVEL,
          B.LEVEL_NAME AS GROUP_NAME
        FROM SIAK_USER_LEVEL A
        INNER JOIN SIAK_USER_GROUP B
          ON A.GROUP_LEVEL = B.LEVEL_CODE
        WHERE A.GROUP_LEVEL = :b_group
        ORDER BY TO_NUMBER(A.USER_LEVEL)
      `;
      binds.b_group = group;
    } else {
      // fallback: behaviour lama → ambil semua level
      sql = `
        SELECT
          L.USER_LEVEL,
          L.LEVEL_NAME,
          L.GROUP_LEVEL,
          G.LEVEL_NAME AS GROUP_NAME
        FROM SIAK_USER_LEVEL L
        LEFT JOIN SIAK_USER_GROUP G
          ON G.LEVEL_CODE = L.GROUP_LEVEL
        ORDER BY TO_NUMBER(L.GROUP_LEVEL), TO_NUMBER(L.USER_LEVEL)
      `;
    }

    const rows = await execRows<RawLevel>(sql, binds, {}, ORACLE_ALIAS);

    const data = rows.map((r) => ({
      user_level: r.USER_LEVEL?.toString() ?? "",
      level_name: r.LEVEL_NAME?.trim() ?? "",
      group_level: r.GROUP_LEVEL?.toString() ?? "",
      group_name: r.GROUP_NAME?.trim() ?? "",
    }));

    await Log.info({
      scope: "API",
      msg: "setting/users/levels_ok",
      at: "/api/setting/users/levels",
      tookMs: Date.now() - started,
      extra: { count: data.length, group: group || null },
    });

    return ok(data, "OK", 60);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "setting/users/levels_err",
      at: "/api/setting/users/levels",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat daftar level user");
  }
}
