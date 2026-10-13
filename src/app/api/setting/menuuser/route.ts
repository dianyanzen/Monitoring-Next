import type { NextRequest } from "next/server";
import { ok, err, badRequest, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";

type MenuRow = {
  MENU_ID: number;
  PARENT_ID: number | null;
  PARENT_TITLE: string | null;
  TITLE: string | null;
  MENU_LEVEL: number | null;
  LEVEL_HEAD: number | null;
  LEVEL_SUB: number | null;
};

const normalize = (val: unknown) => (val == null ? "" : String(val).trim());

export async function GET(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const { searchParams } = new URL(req.url);
    const group = searchParams.get("group_id");
    const lvl = group ? Number(group) : NaN;
    const hasFilter = Number.isFinite(lvl) && lvl > 0;

    const rows = await execRows<MenuRow>(
      `
      SELECT A.MENU_ID,
             A.PARENT_ID,
             NVL((SELECT B.TITLE FROM SIAK_MENU B WHERE B.MENU_ID = A.PARENT_ID), 'Root') AS PARENT_TITLE,
             A.TITLE,
             A.MENU_LEVEL,
             A.LEVEL_HEAD,
             A.LEVEL_SUB
      FROM SIAK_MENU A
      ${hasFilter ? "WHERE A.MENU_LEVEL = :b_lvl" : ""}
      ORDER BY A.MENU_LEVEL, A.LEVEL_HEAD, A.PARENT_ID, A.LEVEL_SUB
      `,
      hasFilter ? { b_lvl: lvl } : {},
      {},
      ORACLE_ALIAS
    );

    const data = rows.map((r) => ({
      menu_id: Number(r.MENU_ID),
      parent_id: r.PARENT_ID == null ? null : Number(r.PARENT_ID),
      parent_title: normalize(r.PARENT_TITLE) || "Root",
      title: normalize(r.TITLE),
      menu_level: Number(r.MENU_LEVEL ?? 0),
      level_head: Number(r.LEVEL_HEAD ?? 0),
      level_sub: Number(r.LEVEL_SUB ?? 0),
    }));

    await Log.info({
      scope: "API",
      msg: "menuuser/list",
      at: "/api/setting/menuuser",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { count: data.length, filter: hasFilter ? lvl : null },
    });

    return ok({ rows: data, total: data.length }, "Daftar menu user dimuat");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "menuuser/list_err",
      at: "/api/setting/menuuser",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal memuat menu user");
  }
}
