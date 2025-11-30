import type { NextRequest } from "next/server";
import { ok, err, badRequest, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";

type MenuRow = { MENU_ID: number; TITLE: string | null };
const normalize = (val: unknown) => (val == null ? "" : String(val).trim());

export async function GET(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const { searchParams } = new URL(req.url);
    const lvlParam = searchParams.get("menu_level");
    const lvl = Number(lvlParam);
    if (!Number.isFinite(lvl) || lvl < 1) return badRequest("menu_level tidak valid");

    // Untuk level 1, parent dianggap root saja.
    if (lvl === 1) {
      return ok([{ menu_id: 0, title: "Root" }], "Parent root");
    }

    const parentLevel = lvl - 1;
    const rows = await execRows<MenuRow>(
      `SELECT MENU_ID, TITLE FROM SIAK_MENU WHERE MENU_LEVEL = :b_lvl ORDER BY TITLE`,
      { b_lvl: parentLevel },
      {},
      ORACLE_ALIAS
    );

    const data = rows.map((r) => ({ menu_id: Number(r.MENU_ID), title: normalize(r.TITLE) }));

    await Log.info({
      scope: "API",
      msg: "menuuser/parents",
      at: "/api/setting/menuuser/parents",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { level: lvl, parentLevel, count: data.length },
    });

    return ok(data, "Daftar parent menu");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "menuuser/parents_err",
      at: "/api/setting/menuuser/parents",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat parent menu");
  }
}
