"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

type AnyFetch = typeof fetch;

const SHOW_DELAY_MS = 160; // elak flicker untuk request cepat
const SUPPRESS_AFTER_ROUTE_MS = 320; // jeda sejenak setelah route overlay hilang

function extractUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

function shouldTrack(input: RequestInfo | URL) {
  if (typeof window === "undefined") return false;
  try {
    const raw = extractUrl(input);
    const url = raw.startsWith("http") ? new URL(raw) : new URL(raw, window.location.href);
    // abaikan asset/next static, sisanya (relative/same-origin) dilacak
    if (url.origin !== window.location.origin) return false;
    return !url.pathname.startsWith("/_next/");
  } catch {
    return true;
  }
}

export default function GlobalFetchOverlay() {
  const [pending, setPending] = useState(0);
  const [visible, setVisible] = useState(false);
  const [routeOverlayVisible, setRouteOverlayVisible] = useState(false);

  const originalFetch = useRef<AnyFetch | null>(null);
  const delayTimerRef = useRef<number | null>(null);
  const routeHiddenAtRef = useRef<number | null>(null);

  const hasPending = pending > 0;

  // patch fetch untuk menghitung request aktif
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.fetch === "undefined") return;
    if ((window as any).__monalisaFetchPatched) return;

    const orig: AnyFetch = window.fetch.bind(window);
    originalFetch.current = orig;
    (window as any).__monalisaFetchPatched = true;

    window.fetch = (async (...args) => {
      const track = shouldTrack(args[0]);
      if (track) setPending((p) => p + 1);
      try {
        return await orig(...args);
      } finally {
        if (track) setPending((p) => Math.max(0, p - 1));
      }
    }) as AnyFetch;

    return () => {
      if (originalFetch.current) window.fetch = originalFetch.current;
      delete (window as any).__monalisaFetchPatched;
    };
  }, []);

  // sinkronkan state dengan overlay perpindahan route agar tidak dobel
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setRouteOverlayVisible(Boolean(detail));
      if (!detail) routeHiddenAtRef.current = Date.now();
    };
    const current = (window as any).__monalisaRouteOverlayVisible;
    if (typeof current === "boolean") setRouteOverlayVisible(current);
    window.addEventListener("monalisa:route-overlay", handler as EventListener);
    return () => window.removeEventListener("monalisa:route-overlay", handler as EventListener);
  }, []);

  // debounce tampil agar tidak berkedip
  useEffect(() => {
    const suppressedByRoute =
      routeOverlayVisible ||
      (routeHiddenAtRef.current !== null &&
        Date.now() - routeHiddenAtRef.current < SUPPRESS_AFTER_ROUTE_MS);

    if (delayTimerRef.current) {
      window.clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }

    if (suppressedByRoute) {
      setVisible(false);
      return;
    }

    if (hasPending) {
      delayTimerRef.current = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    } else {
      // sembunyikan segera ketika tidak ada pending
      setVisible(false);
    }

    return () => {
      if (delayTimerRef.current) {
        window.clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
    };
  }, [hasPending, routeOverlayVisible]);

  const overlay = useMemo(() => {
    const suppressedByRoute =
      routeOverlayVisible ||
      (routeHiddenAtRef.current !== null &&
        Date.now() - routeHiddenAtRef.current < SUPPRESS_AFTER_ROUTE_MS);
    if (!visible || suppressedByRoute) return null;
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#05070d]/60 backdrop-blur-sm transition-opacity">
        <div className="relative flex items-center gap-3 rounded-2xl border border-cyan-500/35 bg-[#0b0f1c]/90 px-5 py-3 shadow-[0_0_40px_rgba(0,255,255,0.22)]">
          <span className="grid h-11 w-11 place-items-center rounded-full border border-cyan-400/40 bg-cyan-400/10">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-100 drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]" />
          </span>
          <div className="text-sm font-semibold text-cyan-50 leading-tight">
            Memproses permintaan...
            <div className="text-xs font-normal text-cyan-200/75">Mohon tunggu, sistem sedang bekerja.</div>
          </div>
        </div>
      </div>
    );
  }, [routeOverlayVisible, visible]);

  if (!overlay || typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}
