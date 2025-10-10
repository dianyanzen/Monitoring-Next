// File: app/(components)/system/RouteChangeOverlay.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";

const MIN_MS = 350;        // minimal tampil biar tidak kedip
const FAILSAFE_MS = 10000; // jaga-jaga kalau navigasi batal/nyangkut

export function triggerRouteOverlay() {
  // buat dipanggil manual kalau perlu
  if (typeof window !== "undefined") {
    (window as any).__monalisaShow?.();
  }
}

export default function RouteChangeOverlay() {
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";

  const [visible, setVisible] = useState(false);

  // refs
  const mountedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const failsafeRef = useRef<number | null>(null);
  const showAtRef = useRef<number>(0);
  const waitingCommitRef = useRef(false);
  const lastKeyRef = useRef<string>("");

  // SHOW segera (tanpa auto-hide). Hide saat route commit / failsafe.
  const show = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (failsafeRef.current) clearTimeout(failsafeRef.current);

    rafRef.current = requestAnimationFrame(() => {
      if (!mountedRef.current) return;
      showAtRef.current = performance.now();
      waitingCommitRef.current = true;
      setVisible(true);

      // Failsafe jika route tidak pernah commit (error, dibatalkan, dll.)
      failsafeRef.current = window.setTimeout(() => {
        waitingCommitRef.current = false;
        setVisible(false);
      }, FAILSAFE_MS);
    });
  };

  // HIDE setelah minimal MIN_MS terpenuhi
  const hideRespectingMin = () => {
    if (!mountedRef.current) return;
    const elapsed = performance.now() - showAtRef.current;
    const remain = Math.max(0, MIN_MS - elapsed);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      waitingCommitRef.current = false;
      setVisible(false);
      if (failsafeRef.current) {
        clearTimeout(failsafeRef.current);
        failsafeRef.current = null;
      }
    }, remain);
  };

  // Ekspor global helper (optional)
  useEffect(() => {
    (window as any).__monalisaShow = show;
    return () => { delete (window as any).__monalisaShow; };
  }, []);

  // 1) Klik <a> internal → SHOW (termasuk jika href sama dengan URL sekarang → niat reload)
  useEffect(() => {
    mountedRef.current = true;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;

      // a) “tanda khusus” di elemen apapun (untuk tombol custom/router.push manual)
      const marked = target?.closest?.("[data-overlay-on-click]") as HTMLElement | null;
      if (marked) {
        show();
        return; // biarkan handler-mu lanjut (router.push / fetch / dll.)
      }

      // b) Anchor/link same-origin
      const a = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;

      // Abaikan modifier/new tab/middle click
      const hasModifier =
        e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e.button ?? 0) !== 0;
      const isNewTab = a.target && a.target.toLowerCase() !== "_self";
      if (hasModifier || isNewTab) return;

      // Same-origin saja
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;

      // Tampilkan overlay SELALU (termasuk kalau href sama → niat reload via Link/anchor)
      show();
    };

    document.addEventListener("click", onClick, { capture: true });

    return () => {
      mountedRef.current = false;
      document.removeEventListener("click", onClick, { capture: true } as any);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (failsafeRef.current) clearTimeout(failsafeRef.current);
    };
  }, []);

  // 2) Programmatic navigation: router.push/replace → SHOW (via patch history)
  // useEffect(() => {
  //   const wrap = (type: "pushState" | "replaceState") => {
  //     const orig = history[type];
  //     return function (this: History, ...args: any[]) {
  //       const rv = orig.apply(this, args as any);
  //       // Tampil segera setelah push/replace dipanggil
  //       show();
  //       return rv;
  //     };
  //   };

  //   if (!(window as any).__monalisaHistoryPatched) {
  //     (window as any).__monalisaHistoryPatched = true;
  //     (history as any).pushState = wrap("pushState");
  //     (history as any).replaceState = wrap("replaceState");
  //   }
  // }, []);

  // 3) Back/forward → SHOW
  // useEffect(() => {
  //   const onPop = () => show();
  //   window.addEventListener("popstate", onPop);
  //   return () => window.removeEventListener("popstate", onPop);
  // }, []);

  // 4) Reload/close tab → SHOW (akan menghilang bersama unload)
  // useEffect(() => {
  //   const onBeforeUnload = () => setVisible(true);
  //   window.addEventListener("beforeunload", onBeforeUnload);
  //   return () => window.removeEventListener("beforeunload", onBeforeUnload);
  // }, []);

  // 5) Saat route BARU commit (pathname/search berubah) → HIDE (kalau kita memang sedang menunggu commit)
  useEffect(() => {
    const key = pathname + "?" + search;
    if (!lastKeyRef.current) {
      lastKeyRef.current = key;
      return;
    }
    if (key !== lastKeyRef.current) {
      lastKeyRef.current = key;
      if (waitingCommitRef.current) hideRespectingMin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  if (!visible) return null;

  const overlay = (
    <div className="fixed inset-0 z-[100000] pointer-events-auto select-none">
      <div className="absolute inset-0 bg-[#05050b]/70 backdrop-blur-md" />
      <motion.div
        aria-hidden
        className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(to_right,#00ffff22_1px,transparent_1px),linear-gradient(to_bottom,#00ffff22_1px,transparent_1px)] bg-[size:40px_40px]"
        animate={reduce ? undefined : { backgroundPosition: ["0px 0px", "40px 40px"] }}
        transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,#00ffff22,transparent_60%),radial-gradient(circle_at_70%_60%,#ff00ff22,transparent_60%)]"
        animate={reduce ? undefined : { backgroundPosition: ["0% 0%", "100% 100%"] }}
        transition={reduce ? undefined : { duration: 8, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        aria-hidden
        className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-400 via-pink-400 to-cyan-400 opacity-60"
        animate={reduce ? undefined : { y: ["0%", "100%"] }}
        transition={reduce ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative h-full flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.99 }}
          transition={{ duration: 0.22 }}
          className="w-[min(92vw,540px)] rounded-2xl border border-cyan-500/30 bg-[#0b0b1a]/80 shadow-[0_0_25px_#00ffff33,0_0_15px_#ff00ff22_inset] p-6 text-center"
        >
          <div className="text-cyan-300 font-semibold tracking-wide">MONALISA SYSTEM</div>
          <div className="mt-1 text-[13px] text-cyan-100/70">Preparing User Interface…</div>
          <div className="mt-6 h-2 w-full rounded-full bg-cyan-900/40 overflow-hidden">
            <motion.div
              className="h-full w-1/3"
              animate={reduce ? undefined : { x: ["-40%", "120%"] }}
              transition={reduce ? undefined : { duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              style={{ background: "linear-gradient(90deg, var(--tw-gradient-from), var(--tw-gradient-to))" }}
            />
          </div>
          <div className="mt-3 text-xs text-cyan-200/70">Please wait… access channel stabilizing.</div>
        </motion.div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
