// FILE: src/app/api/setting/get_group_tree_one/route.ts
import type { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { execRows } from "@/lib/db";
import { ok, err, badRequest, unauthorized } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";

/* ======================== Types ======================== */
type MenuRow = {
  MENU_ID: number | string;
  PARENT_ID: number | string | null;
  TITLE: string | null;
  ACTIVE_MENU: number | null;
  USER_LEVEL: number | null;
  MENU_LEVEL: number | null;
};

/* ======================== Utils ======================== */
const onlyDigits = (s: string) => s.replace(/[^\d]/g, "");
const toChecked = (v: number | null) => Number(v ?? 0) !== 0;

/* ======================== Builder: tolerate PARENT_ID=0/null ======================== */
function buildThreeLevelTree(rows: MenuRow[]) {
  // index by numeric parent_id (0 untuk null)
  const byParent = new Map<number, MenuRow[]>();
  for (const r of rows) {
    const parent = Number(r.PARENT_ID ?? 0);
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent)!.push(r);
  }

  // Top-level: prioritas MENU_LEVEL=1; fallback parent_id in (0,null)
  const topLevel = rows.filter(
    (r) => Number(r.MENU_LEVEL ?? 0) === 1 || Number(r.PARENT_ID ?? 0) === 0
  );

  const toNode = (r: MenuRow) => ({
    text: String(r.TITLE ?? ""),
    id: String(r.MENU_ID),
    disabled: true as const,
    checked: toChecked(r.ACTIVE_MENU),
    children: [] as ReturnType<typeof toNode>[],
  });

  const lvl2Of = (parentId: number) => byParent.get(parentId) ?? [];
  const lvl3Of = (parentId: number) => byParent.get(parentId) ?? [];

  const tree = topLevel.map((lv1) => {
    const n1 = toNode(lv1);

    const lv2Rows = lvl2Of(Number(lv1.MENU_ID));
    n1.children = lv2Rows.map((lv2) => {
      const n2 = toNode(lv2);

      const lv3Rows = lvl3Of(Number(lv2.MENU_ID));
      n2.children = lv3Rows.map((lv3) => {
        const n3 = toNode(lv3);
        n3.children = []; // stop di level-3 sesuai legacy
        return n3;
      });

      return n2;
    });

    return n1;
  });

  return tree;
}

/* ======================== Core Handler ======================== */
async function handle(userLevel: string) {
  const rows = await execRows<MenuRow>(
    `
    SELECT
      TO_NUMBER(A.MENU_ID) AS MENU_ID,
      A.PARENT_ID,
      A.TITLE,
      A.ACTIVE_MENU,
      A.USER_LEVEL,
      A.MENU_LEVEL
    FROM VW_SIAK_MENU A
    WHERE A.USER_LEVEL = :b_level AND IS_NEXT = 1
    ORDER BY A.LEVEL_HEAD, A.LEVEL_SUB, A.LEVEL_CONTENT
    `,
    { b_level: userLevel },
    {},
    ORACLE_ALIAS
  );

  const tree = buildThreeLevelTree(rows);
  // penting: kembalikan langsung array agar tidak jadi { data: { data: [] } }
  return ok(tree);
}

/* ======================== Routes ======================== */
export async function GET(req: NextRequest) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const raw = new URL(req.url).searchParams.get("user_level") ?? "";
    const userLevel = onlyDigits(raw);
    if (!userLevel) return badRequest("Parameter 'user_level' wajib diisi");

    return await handle(userLevel);
  } catch (e: any) {
    return err("Gagal memuat tree hak akses");
  }
}

export async function POST(req: NextRequest) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const body = await req.json().catch(() => ({} as any));
    const raw = String(body?.user_level ?? "").trim();
    const userLevel = onlyDigits(raw);
    if (!userLevel) return badRequest("Parameter 'user_level' wajib diisi");

    return await handle(userLevel);
  } catch (e: any) {
    return err("Gagal memuat tree hak akses");
  }
}
