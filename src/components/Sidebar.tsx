"use client";
import { useEffect, useState } from "react";
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

export default function Sidebar() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [openIds, setOpenIds] = useState<number[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    async function fetchMenus() {
      try {
        const res = await fetch("/api/menu");
        const data = await res.json();
        if (Array.isArray(data)) setMenus(data);
      } catch (err) {
        console.error("❌ Fetch menu error:", err);
      }
    }
    fetchMenus();
  }, []);

  const toggleMenu = (id: number) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isActive = (url?: string) => {
    if (!url) return false;
    const cleanUrl = url.startsWith("/") ? url : `/${url}`;
    return pathname.startsWith(cleanUrl);
  };

  useEffect(() => {
    const findActiveParent = (items: MenuItem[], path: string): number[] => {
      let expanded: number[] = [];
      for (const item of items) {
        if (item.SUB_MENU && item.SUB_MENU.length > 0) {
          const childExpanded = findActiveParent(item.SUB_MENU, path);
          if (childExpanded.length > 0 || isActive(item.URL)) {
            expanded.push(item.MENU_ID, ...childExpanded);
          }
        }
      }
      return expanded;
    };

    const expandedParents = findActiveParent(menus, pathname);
    if (expandedParents.length > 0) setOpenIds(expandedParents);
  }, [menus, pathname]);

  const renderMenu = (items: MenuItem[], depth = 0) => (
    <ul
      className={`${
        depth === 0
          ? "space-y-1"
          : "pl-4 space-y-1 border-l border-cyan-700/40 ml-2"
      }`}
    >
      {items.map((item) => {
        const hasSub = item.SUB_MENU && item.SUB_MENU.length > 0;
        const isOpen = openIds.includes(item.MENU_ID);
        const active = isActive(item.URL);

        return (
          <li key={item.MENU_ID}>
            {hasSub ? (
              <div>
                <button
                  onClick={() => toggleMenu(item.MENU_ID)}
                  className={`w-full flex justify-between items-center px-3 py-2 text-sm rounded transition-all duration-200 border border-transparent ${
                    active
                      ? "bg-cyan-900/40 text-cyan-400 border-cyan-500/40 shadow-[0_0_10px_#00ffff55]"
                      : "text-gray-300 hover:bg-gray-800/40 hover:border-cyan-500/20"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {item.ICON && (
                      <i
                        className={`${item.ICON} text-base ${
                          active ? "text-cyan-400" : "text-gray-400"
                        }`}
                      ></i>
                    )}
                    {item.TITLE}
                  </span>

                  <motion.span
                    animate={{
                      rotate: isOpen ? 90 : 0,
                      scale: isOpen ? 1.2 : 1,
                    }}
                    transition={{ duration: 0.25 }}
                    className="relative flex items-center justify-center w-3 h-3"
                  >
                    <span
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        isOpen
                          ? "bg-cyan-400 shadow-[0_0_8px_#00ffff]"
                          : "bg-pink-500/40 shadow-[0_0_6px_#ff00ff55]"
                      }`}
                    ></span>
                  </motion.span>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
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
              <a
                href={item.URL && item.URL !== "#" ? `/${item.URL}` : "#"}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded transition-all duration-200 border border-transparent ${
                  active
                    ? "bg-cyan-900/40 text-cyan-400 border-cyan-500/40 shadow-[0_0_10px_#00ffff55]"
                    : "text-gray-300 hover:bg-gray-800/40 hover:border-cyan-500/20"
                }`}
              >
                {item.ICON && (
                  <i
                    className={`${item.ICON} text-base ${
                      active ? "text-cyan-400" : "text-gray-400"
                    }`}
                  ></i>
                )}
                {item.TITLE}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside className="w-80 bg-gradient-to-b from-[#07070a] to-[#0d0d10] border-r border-cyan-900/40 text-gray-200 h-screen flex flex-col overflow-x-hidden mt-4 relative">
      {/* 🟣 glowing animated background */}
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,#00ffff22,transparent_60%),radial-gradient(circle_at_80%_70%,#ff00ff11,transparent_70%)]"
        animate={{
          backgroundPosition: ["0% 0%", "100% 100%"],
        }}
        transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
      />

      <div className="relative text-cyan-400 font-semibold text-lg p-4 border-b border-cyan-800/40 backdrop-blur-sm">
        &nbsp;
      </div>

      <div className="flex-1 overflow-y-auto p-3 relative z-10">
        {menus.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {renderMenu(menus)}
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-10 space-y-8">
            {/* 🔵 rotating neon ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
              className="relative w-16 h-16"
            >
              <div className="absolute inset-0 rounded-full border-4 border-t-transparent border-cyan-400 shadow-[0_0_30px_#00ffff,0_0_60px_#00ffff55]"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-transparent border-pink-500/60 animate-ping"></div>
            </motion.div>

            {/* 💬 text with flicker animation */}
            <motion.p
              className="text-sm text-gray-400 tracking-wide uppercase font-mono"
              animate={{ opacity: [0.2, 1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Initializing <span className="text-cyan-400">menu system</span>...
            </motion.p>

            {/* 🧩 holographic shimmer list */}
            <div className="flex flex-col w-5/6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.3 }}
                  className="h-4 w-full rounded bg-gradient-to-r from-cyan-700/20 via-pink-600/30 to-cyan-700/20 bg-[length:200%_100%] animate-[shimmer_1.8s_infinite_linear] shadow-[0_0_8px_#00ffff33]"
                ></motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
