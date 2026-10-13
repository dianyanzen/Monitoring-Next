import type { NextRequest } from "next/server";
import { ok, err, badRequest, unauthorized } from "@/lib/http";
import { execOne, execDml } from "@/lib/db";
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

async function loadById(id: number) {
  return execOne<MenuRow>(
    `
    SELECT A.MENU_ID,
           A.PARENT_ID,
           NVL((SELECT B.TITLE FROM SIAK_MENU B WHERE B.MENU_ID = A.PARENT_ID), 'Root') AS PARENT_TITLE,
           A.TITLE,
           A.MENU_LEVEL,
           A.LEVEL_HEAD,
           A.LEVEL_SUB
    FROM SIAK_MENU A
    WHERE A.MENU_ID = :b_id
    `,
    { b_id: id },
    {},
    ORACLE_ALIAS
  );
}

export async function GET(_: NextRequest, context: { params: Promise<{ menuId: string }> }) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const { menuId } = await context.params;
    const id = Number(menuId ?? "");
    if (!Number.isFinite(id)) return badRequest("ID tidak valid");

    const row = await loadById(id);
    if (!row) return err("Menu tidak ditemukan", 404);

    const data = {
      menu_id: Number(row.MENU_ID),
      parent_id: row.PARENT_ID == null ? null : Number(row.PARENT_ID),
      parent_title: normalize(row.PARENT_TITLE) || "Root",
      title: normalize(row.TITLE),
      menu_level: Number(row.MENU_LEVEL ?? 0),
      level_head: Number(row.LEVEL_HEAD ?? 0),
      level_sub: Number(row.LEVEL_SUB ?? 0),
    };

    await Log.info({
      scope: "API",
      msg: "menuuser/detail",
      at: "/api/setting/menuuser/[id]",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { id },
    });

    return ok(data, "Detail menu user dimuat");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "menuuser/detail_err",
      at: "/api/setting/menuuser/[id]",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal memuat menu user");
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ menuId: string }> }) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const { menuId } = await context.params;
    const id = Number(menuId ?? "");
    if (!Number.isFinite(id)) return badRequest("ID tidak valid");

    const body = await req.json().catch(() => ({}));
    const title = normalize(body.title);
    const menuLevel = Number(body.menu_level ?? body.level);
    const levelHead = Number(body.level_head ?? 0);
    const levelSub = Number(body.level_sub ?? 0);
    const parentIdRaw = body.parent_id;
    const parentId = parentIdRaw === null || parentIdRaw === undefined || parentIdRaw === "" ? null : Number(parentIdRaw);

    if (!title) return badRequest("Title wajib diisi", { field: "title" });
    if (!Number.isFinite(menuLevel) || menuLevel < 1) return badRequest("Menu level tidak valid", { field: "menu_level" });
    if (!Number.isFinite(levelHead)) return badRequest("Level head tidak valid", { field: "level_head" });
    if (!Number.isFinite(levelSub)) return badRequest("Level sub tidak valid", { field: "level_sub" });
    if (parentId !== null && !Number.isFinite(parentId)) return badRequest("Parent ID tidak valid", { field: "parent_id" });

    const exists = await loadById(id);
    if (!exists) return err("Menu tidak ditemukan", 404);

    await execDml(
      `
      UPDATE SIAK_MENU
      SET TITLE = :b_title,
          PARENT_ID = :b_parent,
          MENU_LEVEL = :b_lvl,
          LEVEL_HEAD = :b_head,
          LEVEL_SUB = :b_sub
      WHERE MENU_ID = :b_id
      `,
      {
        b_title: title,
        b_parent: parentId,
        b_lvl: menuLevel,
        b_head: levelHead,
        b_sub: levelSub,
        b_id: id,
      },
      { autoCommit: true },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "menuuser/update",
      at: "/api/setting/menuuser/[id]",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { id, menuLevel, parentId },
    });

    return ok({ menu_id: id }, "Menu berhasil diperbarui");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "menuuser/update_err",
      at: "/api/setting/menuuser/[id]",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal memperbarui menu");
  }
}
