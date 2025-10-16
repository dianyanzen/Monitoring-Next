// src/app/api/menu/route.ts
import { unstable_cache, revalidateTag } from "next/cache";
import { ok, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readUserLevelFromCookies } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ——— Tipe Row dari VIEW ———
type Row = {
  MENU_ID: number;
  PARENT_ID: number | null;
  ICON: string | null;
  TITLE: string;
  URL: string | null;
  IS_ACTIVE: number;   // 1 = clickable
  USER_LEVEL: number;
  MENU_LEVEL: number;  // 1 = root
  IS_NEXT: number;
  LEVEL_HEAD?: number | null;
  LEVEL_SUB?: number | null;
  LEVEL_CONTENT?: number | null;
};

type Node = Row & { SUB_MENU?: Node[] };

// ——— Query sekali (bind aman) ———
// Urutan persis implementasi lama (Blade): LEVEL_HEAD, LEVEL_SUB, LEVEL_CONTENT, TITLE
async function fetchFlat(userLevel: number): Promise<Row[]> {
  const sql = `
    SELECT MENU_ID, PARENT_ID, ICON, TITLE, LOWER(URL) URL, IS_ACTIVE, USER_LEVEL,
           MENU_LEVEL, IS_NEXT, LEVEL_HEAD, LEVEL_SUB, LEVEL_CONTENT
    FROM VW_SIAK_MENU
    WHERE USER_LEVEL = :b_user_level
      AND ACTIVE_MENU = 1
    ORDER BY LEVEL_HEAD, LEVEL_SUB, LEVEL_CONTENT, TITLE
  `;
  return execRows<Row>(sql, { b_user_level: userLevel }, {}, "DB");
}

/**
 * buildTree:
 * - Root hanya baris dengan MENU_LEVEL = 1 (persis get_menu() lama).
 * - Anak di-attach ke parent jika parent ada di result dan parent TIDAK klikabel.
 * - Tidak mengangkat node ke root kalau parent tidak ada (biarkan “yatim” tak ditampilkan).
 * - Sorting siblings pakai key yang sama: LEVEL_HEAD, LEVEL_SUB, LEVEL_CONTENT, TITLE.
 */
function buildTree(rows: Row[]): Node[] {
  const byId = new Map<number, Node>();
  const roots: Node[] = [];

  // index node
  for (const r of rows) byId.set(r.MENU_ID, { ...r });

  // helper: parent klikabel tidak menampilkan submenu
  const attachToParent = (child: Node, parent: Node) => {
    const clickable = parent.IS_ACTIVE === 1 && !!parent.URL && parent.URL !== "#";
    if (clickable) return;
    if (!parent.SUB_MENU) parent.SUB_MENU = [];
    parent.SUB_MENU.push(child);
  };

  // bangun relasi
  for (const r of rows) {
    const node = byId.get(r.MENU_ID)!;

    // root persis: hanya MENU_LEVEL === 1
    if (r.MENU_LEVEL === 1) {
      roots.push(node);
      continue;
    }

    // non-root → pasang ke parent jika ada
    const pid = r.PARENT_ID ?? 0;
    const parent = pid ? byId.get(pid) : undefined;
    if (parent) attachToParent(node, parent);
    // jika parent tidak ada di result: jangan ditampilkan (no-ops), sama seperti versi lama
  }

  // sort siblings persis Blade
  const key = (n: Node) => {
    const h = (n.LEVEL_HEAD ?? 0).toString().padStart(6, "0");
    const s = (n.LEVEL_SUB ?? 0).toString().padStart(6, "0");
    const c = (n.LEVEL_CONTENT ?? 0).toString().padStart(6, "0");
    const t = (n.TITLE ?? "").toLowerCase();
    return `${h}|${s}|${c}|${t}`;
  };

  const sortTree = (list: Node[]) => {
    list.sort((a, b) => key(a).localeCompare(key(b)));
    list.forEach((n) => n.SUB_MENU && sortTree(n.SUB_MENU));
  };
  sortTree(roots);

  return roots;
}

// ——— Cache per level ———
function getMenuCachedFactory(level: number) {
  const tag = `menu:${level}`;
  return unstable_cache(
    async () => {
      const rows = await fetchFlat(level);
      return buildTree(rows);
    },
    [tag],
    { revalidate: 300, tags: [tag] }
  );
}

// ——— GET: baca level dari cookie/session (fallback=5), lalu pakai cache per-level ———
export async function GET() {
  try {
    const level = await readUserLevelFromCookies(5);
    const t0 = Date.now();
    const getMenuCached = getMenuCachedFactory(level);
    const data = await getMenuCached();
    const took = Date.now() - t0;

    Log.info({
      scope: "SYSTEM",
      msg: "menu.GET",
      at: "/api/menu",
      tookMs: took,
      extra: { level, items: data.length },
    });

    const res = ok(data);
    res.headers.set(
      "Cache-Control",
      "public, max-age=0, s-maxage=300, stale-while-revalidate=300"
    );
    return res;
  } catch (e: any) {
    return err(e?.message || "Gagal memuat menu", 500);
  }
}

// ——— POST revalidate: revalidate cache sesuai level caller ———
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("action") === "revalidate") {
    const level = await readUserLevelFromCookies(5);
    const ALLOWED_LEVELS = new Set([1, 2]); // contoh: 1=SuperAdmin, 2=Admin
    if (!ALLOWED_LEVELS.has(level)) {
      return err("Forbidden: you are not allowed to revalidate menu cache", 403);
    }

    const tag = `menu:${level}`;
    revalidateTag(tag);
    Log.info({
      scope: "SYSTEM",
      msg: "menu.revalidate",
      at: "/api/menu",
      extra: { level, tag },
    });

    return ok({ message: `Revalidated ${tag}` });
  }
  return err("Unknown action", 400);
}
