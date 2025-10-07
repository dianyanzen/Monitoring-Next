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

  // Fetch menu dari API
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

  // Toggle dropdown
  const toggleMenu = (id: number) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Highlight aktif berdasarkan URL
  const isActive = (url?: string) => {
    if (!url) return false;
    const cleanUrl = url.startsWith("/") ? url : `/${url}`;
    return pathname.startsWith(cleanUrl);
  };

  // Auto expand parent jika child aktif
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

  // Recursive render
  const renderMenu = (items: MenuItem[], depth = 0) => (
    <ul
      className={`${
        depth === 0
          ? "space-y-1"
          : "pl-4 space-y-1 border-l border-gray-700 ml-2"
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
                  className={`w-full flex justify-between items-center px-3 py-2 text-sm rounded transition-all duration-200 ${
                    active
                      ? "bg-cyan-900/30 text-cyan-400"
                      : "text-gray-300 hover:bg-gray-800"
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

                  {/* 🔹 Indicator dropdown — neon circle */}
                  <motion.span
                    animate={{
                      rotate: isOpen ? 90 : 0,
                      scale: isOpen ? 1.1 : 1,
                    }}
                    transition={{ duration: 0.25 }}
                    className="relative flex items-center justify-center w-3 h-3"
                  >
                    <span
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        isOpen
                          ? "bg-cyan-400 shadow-[0_0_6px_#00ffff]"
                          : "bg-gray-500"
                      }`}
                    ></span>
                  </motion.span>
                </button>

                {/* Submenu */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
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
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded transition-all duration-200 ${
                  active
                    ? "bg-cyan-900/30 text-cyan-400"
                    : "text-gray-300 hover:bg-gray-800"
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
    <aside className="w-80 bg-[#0d0d10] border-r border-gray-800 text-gray-200 h-screen flex flex-col overflow-x-hidden mt-4">

      <div className="text-cyan-400 font-semibold text-lg p-4 border-b border-gray-700">
        Navigation
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {menus.length > 0 ? renderMenu(menus) : <p>Loading menu...</p>}
      </div>
    </aside>
  );
}
