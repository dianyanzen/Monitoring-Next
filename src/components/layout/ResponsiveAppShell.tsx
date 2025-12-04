"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import Footer from "@/components/layout/Footer";
import RouteChangeOverlay from "@/components/system/RouteChangeOverlay";

// Selaraskan dengan breakpoint Tailwind `lg` (1024px) supaya logika JS = kelas CSS.
const DESKTOP_QUERY = "(min-width: 1024px)";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);

    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      const next = "matches" in event ? event.matches : media.matches;
      setMatches(next);
    };

    handleChange(media);

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, [query]);

  return matches;
}

type ResponsiveAppShellProps = {
  children: React.ReactNode;
  mainClassName?: string;
};

export default function ResponsiveAppShell({ children, mainClassName = "flex-1 overflow-y-auto px-6 py-4" }: ResponsiveAppShellProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [sidebarOverlayOpen, setSidebarOverlayOpen] = useState(false);

  useEffect(() => {
    if (isDesktop) {
      setSidebarPinned(true);
      setSidebarOverlayOpen(false);
    } else {
      setSidebarPinned(false);
      setSidebarOverlayOpen(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    if (isDesktop || !sidebarOverlayOpen) return;
    const { style } = document.body;
    const prev = style.overflow;
    style.overflow = "hidden";
    return () => {
      style.overflow = prev;
    };
  }, [isDesktop, sidebarOverlayOpen]);

  useEffect(() => {
    if (!sidebarOverlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOverlayOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarOverlayOpen]);

  const handleToggleSidebar = useCallback(() => {
    if (isDesktop) {
      setSidebarPinned((prev) => !prev);
    } else {
      setSidebarOverlayOpen((prev) => !prev);
    }
  }, [isDesktop]);

  const handleSidebarNavigate = useCallback(() => {
    if (!isDesktop) setSidebarOverlayOpen(false);
  }, [isDesktop]);

  const sidebarShouldRenderPinned = useMemo(() => isDesktop && sidebarPinned, [isDesktop, sidebarPinned]);

  return (
    <div className="relative flex h-screen w-full overflow-hidden">
      <RouteChangeOverlay />

      <AnimatePresence initial={false}>
        {sidebarShouldRenderPinned && (
          <motion.div
            key="sidebar-pinned"
            className="hidden h-full lg:flex"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Sidebar mode="pinned" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <Topbar onToggleSidebar={handleToggleSidebar} />
        <main className={mainClassName}>{children}</main>
        <Footer />
      </div>

      <AnimatePresence>
        {!sidebarShouldRenderPinned && sidebarOverlayOpen && (
          <motion.div
            key="sidebar-overlay"
            className="fixed inset-0 z-[9000] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              role="presentation"
              className="absolute inset-0 bg-[#05050b]/60 backdrop-blur-sm"
              onClick={() => setSidebarOverlayOpen(false)}
            />
            <motion.div
              className="absolute left-0 top-16 h-[calc(100%-4rem)] w-[82vw] max-w-[320px]"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25 }}
            >
              <Sidebar mode="overlay" onNavigate={handleSidebarNavigate} className="mt-0 h-full" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
