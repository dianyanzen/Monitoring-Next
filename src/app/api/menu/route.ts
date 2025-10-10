// src/app/api/menu/route.ts
import { unstable_cache, revalidateTag } from "next/cache";
import { ok, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readUserLevelFromCookies } from "@/lib/session";
import { Log } from "@/lib/log"; // 

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ Sementara: level hardcode; nanti Step 4 baca dari session/cookie
const USER_LEVEL = 5;
// Tag cache per level (tetap konsisten dgn implementasi kamu sekarang)
const MENU_TAG = `menu:${USER_LEVEL}`;

// ——— Tipe Row dari VIEW ———
type Row = {
  MENU_ID: number;
  PARENT_ID: number | null;
  ICON: string | null;
  TITLE: string;
  URL: string | null;
  IS_ACTIVE: number;   // 1 = clickable (sesuai logic kamu)
  USER_LEVEL: number;
  MENU_LEVEL: number;  // 1 = root (sesuai data kamu)
  IS_NEXT: number;
  LEVEL_HEAD?: number;
  LEVEL_SUB?: number;
  LEVEL_CONTENT?: number;
};

type Node = Row & { SUB_MENU?: Node[] };

// ——— Query sekali (bind aman) ———
async function fetchFlat(userLevel: number): Promise<Row[]> {
  const sql = `
    SELECT MENU_ID, PARENT_ID, ICON, TITLE, URL, IS_ACTIVE, USER_LEVEL,
           MENU_LEVEL, IS_NEXT, LEVEL_HEAD, LEVEL_SUB, LEVEL_CONTENT
    FROM VW_SIAK_MENU
    WHERE USER_LEVEL = :b_user_level
      AND ACTIVE_MENU = 1
    ORDER BY LEVEL_HEAD,LEVEL_SUB,LEVEL_CONTENT, TITLE
  `;
  return execRows<Row>(sql, { b_user_level: userLevel }, {}, "DB");
}

/**
 * buildTree (hardened):
 * - Tidak lagi "menghilangkan" anak ketika parent tidak ikut di result (naik ke root).
 * - Tetap mempertahankan aturan kamu: parent klikabel (IS_ACTIVE=1 & URL ada) tidak menampilkan submenu.
 * - Menstabilkan urutan anak per parent (sort per LEVEL_CONTENT + TITLE).
 */
function buildTree(rows: Row[]): Node[] {
  const byId = new Map<number, Node>();
  const roots: Node[] = [];

  // index node
  for (const r of rows) byId.set(r.MENU_ID, { ...r });

  // helper attach child -> parent, menghormati aturan "parent klikabel tidak tampilkan submenu"
  const attachToParent = (child: Node, parent: Node) => {
    const isParentClickable = parent.IS_ACTIVE === 1 && !!parent.URL && parent.URL !== "#";
    if (isParentClickable) {
      // Sesuai logic kamu sebelumnya: jika parent klikabel, anak tidak ditampilkan sebagai submenu.
      // (Jika nanti ingin parent bisa klik + punya submenu, kita ubah di Step 3, layer UI.)
      return;
    }
    if (!parent.SUB_MENU) parent.SUB_MENU = [];
    parent.SUB_MENU.push(child);
  };

  // bangun relasi
  for (const r of rows) {
    const node = byId.get(r.MENU_ID)!;
    const pid = r.PARENT_ID;

    if (pid && byId.has(pid)) {
      // parent ada di result → attach ke parent (dengan aturan di atas)
      attachToParent(node, byId.get(pid)!);
    } else {
      // parent tidak ada di result atau memang root → jadikan root
      if (r.MENU_LEVEL === 1 || !pid || !byId.has(pid)) {
        roots.push(node);
      }
    }
  }

  // sort stabil per parent
  const sortKey = (n: Node) =>
    `${Number(n.LEVEL_HEAD)}|${Number(n.LEVEL_SUB)}|${n.TITLE.toLowerCase()}`;

  const sortTree = (list: Node[]) => {
    list.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    list.forEach((n) => n.SUB_MENU && sortTree(n.SUB_MENU));
  };
  sortTree(roots);

  return roots;
}

// ——— Cache 5 menit dengan tag ———
const getMenuCached = unstable_cache(
  async (lvl: number) => {
    const t0 = Date.now();
    const rows = await fetchFlat(lvl);
    const tree = buildTree(rows);
    // (Opsional) kamu bisa log di sini pakai lib/log.ts kalau mau
    // logInfo({ scope: 'SYSTEM', msg: 'menu.buildTree', tookMs: Date.now()-t0, extra:{ size: rows.length, roots: tree.length }});
    return tree;
  },
  [MENU_TAG],
  { revalidate: 300, tags: [MENU_TAG] }
);

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

// ——— GET: baca level dari session cookie (fallback=5), lalu pakai cache per-level ———
export async function GET() {
  try {
    const level = readUserLevelFromCookies(5);
    const t0 = Date.now();
    const getMenuCached = getMenuCachedFactory(await level);
    const data = await getMenuCached();
    const took = Date.now() - t0;

    Log.info({
      scope: "SYSTEM",
      msg: "menu.GET",
      at: "/api/menu",
      tookMs: took,
      extra: { level, items: data.length }
    });

    const res = ok(data);
    res.headers.set("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=300");
    return res;
  } catch (e: any) {
    return err(e?.message || "Gagal memuat menu", 500);
  }
}

// ——— POST revalidate: targetkan tag sesuai level caller ———
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("action") === "revalidate") {
    // ── 🔐 Batasi hanya level tertentu (silakan sesuaikan)
    const level = readUserLevelFromCookies(5);
    const ALLOWED_LEVELS = new Set([1, 2]); // contoh: 1=SuperAdmin, 2=Admin
    if (!ALLOWED_LEVELS.has(await level)) {
      return err("Forbidden: you are not allowed to revalidate menu cache", 403);
    }

    // Revalidate cache untuk level caller
    const tag = `menu:${level}`;
    revalidateTag(tag);
    Log.info({ scope: "SYSTEM", msg: "menu.revalidate", at: "/api/menu", extra: { level, tag } });

    return ok({ message: `Revalidated ${tag}` });
  }
  return err("Unknown action", 400);
}
