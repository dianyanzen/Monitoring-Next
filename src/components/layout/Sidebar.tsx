// FILE: app/(components)/layout/Sidebar.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface MenuItem {
  MENU_ID: number;
  PARENT_ID?: number;
  ICON?: string;
  TITLE: string;
  URL?: string;
  IS_ACTIVE?: number;
  USER_LEVEL?: number;
  MENU_LEVEL?: number;
  SUB_MENU?: MenuItem[];
}

/* ── util ──────────────────────────────────────────────────────────────── */
function sanitizeIconClass(cls?: string) {
  if (!cls) return "";
  return cls.match(/[a-zA-Z0-9\- _:]/g)?.join("") ?? "";
}
function normalizeUrl(url?: string) {
  const t = (url ?? "").trim();
  if (!t || t === "#") return "#";
  const u = t.startsWith("/") ? t : `/${t}`;
  return u.replace(/\/{2,}/g, "/");
}

/** Cari LEAF yang paling cocok (prefix terpanjang) → hanya 1 item yang aktif */
function findActiveLeafId(items: MenuItem[], pathname: string): number | null {
  let best: { id: number; len: number } | null = null;

  const walk = (arr: MenuItem[]) => {
    for (const it of arr) {
      const hasSub = Array.isArray(it.SUB_MENU) && it.SUB_MENU.length > 0;
      if (hasSub) {
        walk(it.SUB_MENU!);
      } else {
        const clean = normalizeUrl(it.URL);
        if (clean !== "#" && clean) {
          if (pathname === clean || pathname.startsWith(clean + "/")) {
            const len = clean.length;
            if (!best || len > best.len) best = { id: it.MENU_ID, len };
          }
        }
      }
    }
  };
  walk(items);
  return best?.id ?? null;
}

/** Kembalikan rantai ID dari root → target (termasuk target). */
function chainToTarget(items: MenuItem[], targetId: number): number[] {
  const dfs = (arr: MenuItem[]): number[] => {
    for (const it of arr) {
      if (it.MENU_ID === targetId) return [it.MENU_ID];
      if (it.SUB_MENU?.length) {
        const sub = dfs(it.SUB_MENU);
        if (sub.length) return [it.MENU_ID, ...sub];
      }
    }
    return [];
  };
  return dfs(items);
}

/* ── component ─────────────────────────────────────────────────────────── */
type SidebarProps = {
  mode?: "pinned" | "overlay";
  onNavigate?: () => void;
  className?: string;
};

export default function Sidebar({ mode = "pinned", onNavigate, className = "" }: SidebarProps) {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [openIds, setOpenIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const fetchMenus = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/menu", { credentials: "include", signal });
      if (!res.ok) return;
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) setMenus(json.data);
    } catch (err: any) {
      if (err?.name !== "AbortError") console.error("❌ Fetch menu error:", err);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    fetchMenus(ac.signal);
    return () => ac.abort();
  }, [fetchMenus]);

  // Hitung LEAF aktif (hanya satu) + buka parent chain-nya
  const activeLeafId = useMemo(
    () => (menus.length ? findActiveLeafId(menus, pathname) : null),
    [menus, pathname]
  );

  useEffect(() => {
    if (!menus.length || activeLeafId == null) return;
    const chain = chainToTarget(menus, activeLeafId).slice(0, -1); // parent only
    setOpenIds((prev) => {
      const s = new Set([...prev, ...chain]);
      return [...s];
    });
  }, [menus, activeLeafId]);

  const toggleMenu = (id: number) => {
    setOpenIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const renderMenu = useCallback(
    (items: MenuItem[], depth = 0) => (
      <ul className={depth === 0 ? "space-y-1" : "pl-4 space-y-1 border-l border-cyan-700/40 ml-2"}>
        {items.map((item) => {
          const hasSub = !!(item.SUB_MENU && item.SUB_MENU.length > 0);
          const isOpen = openIds.includes(item.MENU_ID);
          const iconClass = sanitizeIconClass(item.ICON);
          const href = normalizeUrl(item.URL);

          // ⚡ HANYA leaf yang bisa “aktif” (highlight). Parent tidak akan aktif.
          const isActiveLeaf = !hasSub && activeLeafId === item.MENU_ID;

          return (
            <li key={item.MENU_ID}>
              {hasSub ? (
                <div>
                  <button
                    type="button"
                    onClick={() => toggleMenu(item.MENU_ID)}
                    aria-expanded={isOpen}
                    aria-controls={`sub-${item.MENU_ID}`}
                    className={`w-full flex justify-between items-center px-3 py-2 text-sm rounded transition-all duration-200 border
                      ${isOpen ? "text-cyan-300 border-cyan-500/20 bg-cyan-900/10" : "border-transparent text-gray-300 hover:bg-gray-800/40 hover:border-cyan-500/20"}`}
                  >
                    <span className="flex items-center gap-2">
                      {iconClass && <i className={`${iconClass} text-base text-gray-400`} aria-hidden />}
                      <span className="truncate">{item.TITLE}</span>
                    </span>

                    <motion.span
                      aria-hidden
                      animate={{ rotate: isOpen ? 90 : 0, scale: isOpen ? 1.2 : 1 }}
                      transition={{ duration: 0.25 }}
                      className="relative flex items-center justify-center w-3 h-3"
                    >
                      <span
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          isOpen ? "bg-cyan-400 shadow-[0_0_8px_#00ffff]" : "bg-pink-500/40 shadow-[0_0_6px_#ff00ff55]"
                        }`}
                      />
                    </motion.span>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        id={`sub-${item.MENU_ID}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="ml-3"
                      >
                        {renderMenu(item.SUB_MENU!, depth + 1)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                (() => {
                  const isDisabled = href === "#";
                  return isDisabled ? (
                    <div
                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded border ${
                        isActiveLeaf
                          ? "bg-cyan-900/40 text-cyan-400 border-cyan-500/40 shadow-[0_0_10px_#00ffff55]"
                          : "border-transparent text-gray-400/70"
                      } cursor-not-allowed select-none`}
                      aria-disabled="true"
                      title={item.TITLE}
                    >
                      {iconClass && (
                        <i className={`${iconClass} text-base ${isActiveLeaf ? "text-cyan-400" : "text-gray-400"}`} aria-hidden />
                      )}
                      <span className="truncate">{item.TITLE}</span>
                    </div>
                  ) : (
                    <Link
                      href={href}
                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded transition-all duration-200 border ${
                        isActiveLeaf
                          ? "bg-cyan-900/40 text-cyan-400 border-cyan-500/40 shadow-[0_0_10px_#00ffff55]"
                          : "border-transparent text-gray-300 hover:bg-gray-800/40 hover:border-cyan-500/20"
                      }`}
                      aria-current={isActiveLeaf ? "page" : undefined}
                      title={item.TITLE}
                      onClick={() => {
                        if (mode === "overlay") onNavigate?.();
                      }}
                    >
                      {iconClass && (
                        <i className={`${iconClass} text-base ${isActiveLeaf ? "text-cyan-400" : "text-gray-400"}`} aria-hidden />
                      )}
                      <span className="truncate">{item.TITLE}</span>
                    </Link>
                  );
                })()
              )}
            </li>
          );
        })}
      </ul>
    ),
    [openIds, activeLeafId, mode, onNavigate]
  );

  const baseClasses = [
    "w-80 bg-gradient-to-b from-[#07070a] to-[#0d0d10] border-r border-cyan-900/40 text-gray-200 flex flex-col overflow-x-hidden relative",
    mode === "overlay" ? "h-full" : "h-screen mt-4",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const composedClass = baseClasses || "w-80";

  return (
    <aside className={composedClass} data-sidebar-mode={mode}>
      {/* Background animasi */}
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,#00ffff22,transparent_60%),radial-gradient(circle_at_80%_70%,#ff00ff11,transparent_70%)]"
        animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }}
        transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
      />

      <div className="relative text-cyan-400 font-semibold text-lg p-4 border-b border-cyan-800/40 backdrop-blur-sm">
        &nbsp;
      </div>

      <div className="flex-1 overflow-y-auto p-3 relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full py-10 space-y-8">
            <motion.div
              aria-hidden
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
              className="relative w-16 h-16"
            >
              <div className="absolute inset-0 rounded-full border-4 border-t-transparent border-cyan-400 shadow-[0_0_30px_#00ffff,0_0_60px_#00ffff55]" />
              <div className="absolute inset-0 rounded-full border-4 border-t-transparent border-pink-500/60 animate-ping" />
            </motion.div>
            <motion.p
              className="text-sm text-gray-400 tracking-wide uppercase font-mono"
              animate={{ opacity: [0.2, 1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Initializing <span className="text-cyan-400">menu system</span>...
            </motion.p>
            <div className="flex flex-col w-5/6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  aria-hidden
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.3 }}
                  className="h-4 w-full rounded bg-gradient-to-r from-cyan-700/20 via-pink-600/30 to-cyan-700/20 bg-[length:200%_100%] animate-[shimmer_1.8s_infinite_linear] shadow-[0_0_8px_#00ffff33]"
                />
              ))}
            </div>
          </div>
        ) : menus.length > 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {renderMenu(menus)}
          </motion.div>
        ) : (
          <div className="text-center text-sm text-gray-400 py-6">Menu tidak tersedia.</div>
        )}
      </div>
    </aside>
  );
}
