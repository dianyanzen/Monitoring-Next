// File: app/(components)/layout/Sidebar.tsx
"use client";
import { useEffect, useState, useCallback } from "react";
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

/** Sanitizer sederhana untuk class icon yang dikirim dari DB (hindari injeksi) */
function sanitizeIconClass(cls?: string) {
  if (!cls) return "";
  // hanya huruf/angka/spasi/dash/underscore/colon (tailwind variants)
  return cls.match(/[a-zA-Z0-9\- _:]/g)?.join("") ?? "";
}

/** Normalisasi URL: trim, pastikan diawali "/" dan hilangkan double slash */
function normalizeUrl(url?: string) {
  const t = (url ?? "").trim();
  if (!t || t === "#") return "#";
  const u = t.startsWith("/") ? t : `/${t}`;
  return u.replace(/\/{2,}/g, "/");
}

export default function Sidebar() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [openIds, setOpenIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const fetchMenus = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/menu", { credentials: "include", signal }); // kirim cookie sesi
      if (!res.ok) return; // biarkan middleware yang handle redirect jika unauthorized
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) setMenus(json.data);
    } catch (err) {
      if ((err as any)?.name !== "AbortError") {
        console.error("❌ Fetch menu error:", err);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    fetchMenus(ac.signal);
    return () => ac.abort();
  }, [fetchMenus]);

  const isActive = useCallback(
    (url?: string) => {
      if (!url) return false;
      const clean = normalizeUrl(url);
      return pathname === clean || pathname.startsWith(clean + "/");
    },
    [pathname]
  );

  // Expand parent chain berdasarkan route aktif
  useEffect(() => {
    const collectExpanded = (items: MenuItem[], path: string, acc: number[] = []) => {
      for (const it of items) {
        const hasSub = Array.isArray(it.SUB_MENU) && it.SUB_MENU.length > 0;
        if (hasSub) {
          const before = acc.length;
          collectExpanded(it.SUB_MENU!, path, acc);
          if (acc.length > before || isActive(it.URL)) {
            acc.push(it.MENU_ID);
          }
        } else if (isActive(it.URL)) {
          // no-op, penanda aktif pada leaf akan “mengangkat” parent di atasnya
        }
      }
      return acc;
    };
    if (menus.length) {
      const expanded = Array.from(new Set(collectExpanded(menus, pathname)));
      if (expanded.length) setOpenIds(expanded);
    }
  }, [menus, pathname, isActive]);

  const toggleMenu = (id: number) => {
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const renderMenu = useCallback(
    (items: MenuItem[], depth = 0) => (
      <ul
        className={
          depth === 0
            ? "space-y-1"
            : "pl-4 space-y-1 border-l border-cyan-700/40 ml-2"
        }
      >
        {items.map((item) => {
          const hasSub = !!(item.SUB_MENU && item.SUB_MENU.length > 0);
          const isOpen = openIds.includes(item.MENU_ID);
          const active = isActive(item.URL);
          const iconClass = sanitizeIconClass(item.ICON);
          const href = normalizeUrl(item.URL);

          return (
            <li key={item.MENU_ID}>
              {hasSub ? (
                <div>
                  <button
                    type="button"
                    onClick={() => toggleMenu(item.MENU_ID)}
                    aria-expanded={isOpen}
                    aria-controls={`sub-${item.MENU_ID}`}
                    className={`w-full flex justify-between items-center px-3 py-2 text-sm rounded transition-all duration-200 border ${
                      active
                        ? "bg-cyan-900/40 text-cyan-400 border-cyan-500/40 shadow-[0_0_10px_#00ffff55]"
                        : "border-transparent text-gray-300 hover:bg-gray-800/40 hover:border-cyan-500/20"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {iconClass && (
                        <i
                          className={`${iconClass} text-base ${
                            active ? "text-cyan-400" : "text-gray-400"
                          }`}
                          aria-hidden
                        />
                      )}
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
                          isOpen
                            ? "bg-cyan-400 shadow-[0_0_8px_#00ffff]"
                            : "bg-pink-500/40 shadow-[0_0_6px_#ff00ff55]"
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
                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded border
                        ${
                          active
                            ? "bg-cyan-900/20 text-cyan-400 border-cyan-500/30"
                            : "border-transparent text-gray-400/70"
                        }
                        cursor-not-allowed select-none`}
                      aria-disabled="true"
                      title={item.TITLE}
                    >
                      {iconClass && (
                        <i
                          className={`${iconClass} text-base ${
                            active ? "text-cyan-400" : "text-gray-400"
                          }`}
                          aria-hidden
                        />
                      )}
                      <span className="truncate">{item.TITLE}</span>
                    </div>
                  ) : (
                    <Link
                      href={href}
                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded transition-all duration-200 border ${
                        active
                          ? "bg-cyan-900/40 text-cyan-400 border-cyan-500/40 shadow-[0_0_10px_#00ffff55]"
                          : "border-transparent text-gray-300 hover:bg-gray-800/40 hover:border-cyan-500/20"
                      }`}
                      aria-current={active ? "page" : undefined}
                      title={item.TITLE}
                    >
                      {iconClass && (
                        <i
                          className={`${iconClass} text-base ${
                            active ? "text-cyan-400" : "text-gray-400"
                          }`}
                          aria-hidden
                        />
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
    [openIds, isActive]
  );

  return (
    <aside className="w-80 bg-gradient-to-b from-[#07070a] to-[#0d0d10] border-r border-cyan-900/40 text-gray-200 h-screen flex flex-col overflow-x-hidden mt-4 relative">
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
