// src/app/api/menu/route.ts
import { unstable_cache, revalidateTag } from "next/cache";
import { ok, err } from "@/lib/http";
import { execRows } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ Aturan: hardcode level=5 (bisa kamu ubah ambil dari cookie/session nanti)
const USER_LEVEL = 5;
// Tag cache khusus level (bisa granular per level)
const MENU_TAG = `menu:${USER_LEVEL}`;

// ——— Tipe Row dari VIEW-mu ———
type Row = {
  MENU_ID: number;
  PARENT_ID: number | null;
  ICON: string | null;
  TITLE: string;
  URL: string | null;
  IS_ACTIVE: number;
  USER_LEVEL: number;
  MENU_LEVEL: number;
  IS_NEXT: number;
  LEVEL_HEAD?: number;
  LEVEL_SUB?: number;
  LEVEL_CONTENT?: number;
};

type Node = Row & { SUB_MENU?: Node[] };

// ——— Query sekali (patuh bind :b_user_level) ———
async function fetchFlat(userLevel: number): Promise<Row[]> {
  const sql = `
    SELECT MENU_ID, PARENT_ID, ICON, TITLE, URL, IS_ACTIVE, USER_LEVEL,
           MENU_LEVEL, IS_NEXT, LEVEL_HEAD, LEVEL_SUB, LEVEL_CONTENT
    FROM VW_SIAK_MENU
    WHERE USER_LEVEL = :b_user_level
      AND ACTIVE_MENU = 1
      AND IS_NEXT = 1
    ORDER BY LEVEL_HEAD, LEVEL_SUB, LEVEL_CONTENT, TITLE
  `;
  return execRows<Row>(sql, { b_user_level: userLevel }, {}, "DB"); // alias default "DB"
}

// ——— Susun tree tanpa N+1 ———
function buildTree(rows: Row[]): Node[] {
  const byId = new Map<number, Node>();
  const roots: Node[] = [];

  for (const r of rows) byId.set(r.MENU_ID, { ...r });

  for (const r of rows) {
    const node = byId.get(r.MENU_ID)!;
    if (r.PARENT_ID && byId.has(r.PARENT_ID)) {
      const parent = byId.get(r.PARENT_ID)!;
      if (!parent.SUB_MENU) parent.SUB_MENU = [];
      // Hanya dorong anak bila parent bucket (IS_ACTIVE != 1) atau URL '#' / null
      if (parent.IS_ACTIVE !== 1 || !parent.URL || parent.URL === "#") {
        parent.SUB_MENU.push(node);
      }
    } else {
      if (r.MENU_LEVEL === 1 || !r.PARENT_ID) roots.push(node);
    }
  }
  return roots;
}

// ——— Cache 5 menit dengan tag ———
const getMenuCached = unstable_cache(
  async (lvl: number) => {
    const rows = await fetchFlat(lvl);
    return buildTree(rows);
  },
  [MENU_TAG],
  { revalidate: 300, tags: [MENU_TAG] }
);

// ——— GET: kembalikan {success:true,data:[…]} + header cache ———
export async function GET() {
  try {
    const data = await getMenuCached(USER_LEVEL);
    // Aturan HTTP helper dipakai → ok()
    const res = ok(data);
    res.headers.set("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=300");
    return res;
  } catch (e: any) {
    return err(e?.message || "Gagal memuat menu", 500);
  }
}

// ——— POST revalidate: panggil setelah admin ubah menu ———
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("action") === "revalidate") {
    revalidateTag(MENU_TAG);
    return ok({ message: `Revalidated ${MENU_TAG}` });
  }
  return err("Unknown action", 400);
}
