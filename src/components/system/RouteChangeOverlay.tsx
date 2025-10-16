// FILE: app/(components)/system/RouteChangeOverlay.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";

const MIN_MS = 350;        // tampil minimal agar tidak kedip
const FAILSAFE_MS = 10000; // jaga-jaga
const PROGRESS_TICK_MS = 120; // interval simulasi progress

export function triggerRouteOverlay() {
  if (typeof window !== "undefined") (window as any).__monalisaShow?.();
}

export default function RouteChangeOverlay() {
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  // refs
  const mountedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const failsafeRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const showAtRef = useRef<number>(0);
  const waitingCommitRef = useRef(false);
  const lastKeyRef = useRef<string>("");

  // ==== SHOW / HIDE ===========================================================
  const startProgressLoop = () => {
    stopProgressLoop();
    // naik pelan ke 85% pakai easing (logistik-ish)
    progressTimerRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p < 85) {
          const next = p + Math.max(1.2, (85 - p) * 0.08);
          return Math.min(next, 85);
        }
        return p;
      });
    }, PROGRESS_TICK_MS);
  };
  const stopProgressLoop = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const show = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (failsafeRef.current) clearTimeout(failsafeRef.current);

    rafRef.current = requestAnimationFrame(() => {
      if (!mountedRef.current) return;
      showAtRef.current = performance.now();
      waitingCommitRef.current = true;
      setProgress(5);
      startProgressLoop();
      setVisible(true);

      // failsafe
      failsafeRef.current = window.setTimeout(() => {
        waitingCommitRef.current = false;
        stopProgressLoop();
        setVisible(false);
        setProgress(0);
      }, FAILSAFE_MS);
    });
  };

  const hideRespectingMin = () => {
    if (!mountedRef.current) return;
    const elapsed = performance.now() - showAtRef.current;
    const remain = Math.max(0, MIN_MS - elapsed);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      // selesaikan progress → 100 lalu tutup
      stopProgressLoop();
      setProgress(100);
      waitingCommitRef.current = false;
      // beri sedikit waktu untuk animasi bar ke 100
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 180);

      if (failsafeRef.current) {
        clearTimeout(failsafeRef.current);
        failsafeRef.current = null;
      }
    }, remain);
  };

  // export helper global
  useEffect(() => {
    (window as any).__monalisaShow = show;
    return () => {
      delete (window as any).__monalisaShow;
    };
  }, []);

  // ==== LISTENER KLIK ========================================================
  useEffect(() => {
    mountedRef.current = true;

    // simpan reference yang sama untuk removeEventListener
    const listenerOptions: AddEventListenerOptions & EventListenerOptions = { capture: true };

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;

      // tanda khusus (untuk tombol custom/router.push manual)
      const marked = target?.closest?.("[data-overlay-on-click]") as HTMLElement | null;
      if (marked) return show();

      const a = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;

      // abaikan modifier / new tab / tombol selain kiri
      const hasMod = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e.button ?? 0) !== 0;
      if (hasMod) return;
      if (a.target && a.target.toLowerCase() !== "_self") return;

      // abaikan anchor hash / download / mailto / tel
      if (a.hasAttribute("download")) return;
      const href = a.getAttribute("href") || "";
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      // same-origin only
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;

      // kalau hanya hash berubah, jangan overlay
      const curr = new URL(location.href);
      const onlyHashChanged =
        url.pathname === curr.pathname && url.search === curr.search && url.hash !== curr.hash;
      if (onlyHashChanged) return;

      show();
    };

    document.addEventListener("click", onClick, listenerOptions);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("click", onClick, listenerOptions);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (failsafeRef.current) clearTimeout(failsafeRef.current);
      stopProgressLoop();
    };
  }, []);

  // ==== ROUTE COMMIT: ketika pathname/search berubah → hide ====
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
      {/* backdrop */}
      <div className="absolute inset-0 bg-[#05050b]/70 backdrop-blur-md" />

      {/* grid & glow parallax */}
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

      {/* sweeping line */}
      <motion.div
        aria-hidden
        className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-400 via-pink-400 to-cyan-400 opacity-60"
        animate={reduce ? undefined : { y: ["0%", "100%"] }}
        transition={reduce ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* center card */}
      <div className="relative h-full flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.99 }}
          transition={{ duration: 0.22 }}
          className="w-[min(92vw,560px)] rounded-2xl border border-cyan-500/30 bg-[#0b0b1a]/80 shadow-[0_0_25px_#00ffff33,0_0_15px_#ff00ff22_inset] p-6 text-center"
          role="status"
          aria-live="polite"
          aria-label="Loading"
        >
          <div className="text-cyan-300 font-semibold tracking-wide">MONALISA SYSTEM</div>
          <div className="mt-1 text-[13px] text-cyan-100/70">Preparing User Interface…</div>

          {/* progress bar */}
          <div className="mt-6 h-2 w-full rounded-full bg-cyan-900/40 overflow-hidden relative">
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ type: "tween", ease: "easeInOut", duration: 0.18 }}
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(90deg, rgba(0,255,255,.9) 0%, rgba(255,0,170,.9) 100%)",
                boxShadow: "0 0 16px rgba(0,255,255,.45)",
              }}
            />
            {/* comet */}
            <div
              className="absolute -top-[3px] h-[8px] w-[120px] rounded-full blur-md"
              style={{
                left: `calc(${progress}% - 60px)`,
                background:
                  "radial-gradient(closest-side, rgba(0,255,255,.5), transparent)",
                transition: "left .18s ease",
              }}
            />
          </div>

          <div className="mt-3 text-xs text-cyan-200/70">
            Please wait… access channel stabilizing.
          </div>
        </motion.div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
