// src/app/api/menu/check/route.ts
import { NextRequest } from "next/server";
import { ok, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readUserLevelFromCookies } from "@/lib/session";
import { Log  } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- tipe row (sama seperti route menu utama) ---
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

function normalizeUrl(url?: string) {
  const t = (url ?? "").trim();
  if (!t || t === "#") return "#";
  const u = t.startsWith("/") ? t : `/${t}`;
  return u.replace(/\/{2,}/g, "/");
}

async function fetchFlat(userLevel: number): Promise<Row[]> {
  const sql = `
    SELECT MENU_ID, PARENT_ID, ICON, TITLE, URL, IS_ACTIVE, USER_LEVEL,
           MENU_LEVEL, IS_NEXT, LEVEL_HEAD, LEVEL_SUB, LEVEL_CONTENT
    FROM VW_SIAK_MENU
    WHERE USER_LEVEL = :b_user_level
      AND ACTIVE_MENU = 1 AND IS_NEXT = 1
    ORDER BY LEVEL_HEAD, LEVEL_SUB, LEVEL_CONTENT, TITLE
  `;
  return execRows<Row>(sql, { b_user_level: userLevel }, {}, "DB");
}

function buildTree(rows: Row[]): Node[] {
  const byId = new Map<number, Node>();
  const roots: Node[] = [];

  for (const r of rows) byId.set(r.MENU_ID, { ...r });

  const attachToParent = (child: Node, parent: Node) => {
    const isParentClickable = parent.IS_ACTIVE === 1 && !!parent.URL && parent.URL !== "#";
    if (isParentClickable) return;
    if (!parent.SUB_MENU) parent.SUB_MENU = [];
    parent.SUB_MENU.push(child);
  };

  for (const r of rows) {
    const node = byId.get(r.MENU_ID)!;
    const pid = r.PARENT_ID;
    if (pid && byId.has(pid)) {
      attachToParent(node, byId.get(pid)!);
    } else {
      if (r.MENU_LEVEL === 1 || !pid || !byId.has(pid)) roots.push(node);
    }
  }

  const sortKey = (n: Node) =>
    `${String(n.LEVEL_CONTENT ?? 999).padStart(3, "0")}|${n.TITLE.toLowerCase()}`;

  const sortTree = (list: Node[]) => {
    list.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    list.forEach((n) => n.SUB_MENU && sortTree(n.SUB_MENU));
  };
  sortTree(roots);

  return roots;
}

function flattenUrls(nodes: Node[], acc = new Set<string>()) {
  for (const n of nodes) {
    const href = normalizeUrl(n.URL || undefined);
    if (href !== "#") acc.add(href);
    if (n.SUB_MENU?.length) flattenUrls(n.SUB_MENU, acc);
  }
  return acc;
}

async function checkUrl(url: string, req: NextRequest) {
  // bawa cookie user agar halaman protected bisa diakses sesuai level
  const cookie = req.headers.get("cookie") || "";
  const target = new URL(url, req.url).toString();

  // HEAD bisa saja tidak dihandle oleh page tertentu, fallback ke GET
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    let res = await fetch(target, { method: "HEAD", headers: { cookie }, redirect: "manual", signal: controller.signal });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(target, { method: "GET", headers: { cookie }, redirect: "manual", signal: controller.signal });
    }
    return { url, status: res.status, ok: res.ok };
  } catch (e: any) {
    return { url, status: 0, ok: false, error: e?.name || "FetchError" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  try {
    const level = readUserLevelFromCookies(5);
    const rows = await fetchFlat(await level);
    const tree = buildTree(rows);
    const urls = Array.from(flattenUrls(tree));

    const t0 = Date.now();
    const results = await Promise.all(urls.map((u) => checkUrl(u, req)));
    const took = Date.now() - t0;

    await Log.info({
      scope: "SYSTEM",
      msg: "menu.routes.check",
      at: "/api/menu/check",
      tookMs: took,
      extra: { level, total: urls.length, ok: results.filter(r => r.ok).length }
    });

    return ok({ level, total: urls.length, results });
  } catch (e: any) {
    return err("Gagal cek routes", 500);
  }
}
