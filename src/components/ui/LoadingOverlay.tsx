"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

type LoadingOverlayProps = {
  message?: string;
  subtext?: string;
  className?: string;
};

/**
 * Animated overlay used whenever data is being fetched inside the check menus.
 * Light mode leans into warm luxe hues, dark mode evokes neon cyberpunk glow.
 */
export function LoadingOverlay({ message = "Mengambil data", subtext = "harap tunggu", className = "" }: LoadingOverlayProps) {
  const base =
    "absolute inset-0 z-40 overflow-hidden rounded-2xl border border-amber-200/45 bg-white/70 shadow-[0_22px_55px_rgba(165,131,76,0.25)] backdrop-blur-xl transition dark:border-cyan-500/30 dark:bg-[#040b1d]/85 dark:shadow-[0_0_60px_rgba(0,255,234,0.22)]";
  return (
    <div className={`${base} ${className}`}>
      <div className="pointer-events-none absolute -inset-[1px] rounded-[1.2rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.88),rgba(255,255,255,0.05))] opacity-75 mix-blend-soft-light dark:bg-[radial-gradient(circle_at_top,rgba(0,255,234,0.35),rgba(111,0,175,0.08),rgba(2,8,23,0.95))]" />
      <div className="relative flex h-full flex-col items-center justify-center gap-5 px-6 py-8 text-center" role="status" aria-live="polite">
        <div className="relative flex items-center gap-3 text-[0.8rem] font-semibold uppercase tracking-[0.4em] text-amber-600/80 dark:text-cyan-200/80">
          <span className="relative grid h-12 w-12 place-items-center rounded-full border border-amber-200/70 bg-white/90 shadow-[0_18px_34px_rgba(205,161,83,0.3)] animate-floaty dark:border-cyan-400/50 dark:bg-[#071732]/90 dark:shadow-[0_0_45px_rgba(0,255,234,0.32)]">
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-white/80 via-transparent to-white/25 opacity-80 dark:from-cyan-400/70 dark:via-transparent dark:to-fuchsia-500/50" />
            <Loader2 className="relative h-5 w-5 animate-spin text-amber-500 dark:text-cyan-300 drop-shadow-[0_0_12px_rgba(0,255,234,0.6)]" />
          </span>
          {message}
        </div>
        <div className="relative h-[3px] w-48 overflow-hidden rounded-full bg-amber-100/60 dark:bg-cyan-500/20">
          <span className="absolute inset-y-0 -left-16 w-24 rounded-full bg-gradient-to-r from-amber-400 via-amber-200 to-transparent animate-shimmer dark:from-cyan-400 dark:via-fuchsia-500/70 dark:to-transparent" />
        </div>
        <p className="text-[0.65rem] uppercase tracking-[0.55em] text-amber-600/70 dark:text-cyan-200/70">
          {subtext}
        </p>
      </div>
    </div>
  );
}

export function LoadingBlank({ message = "Mengambil data", subtext = "harap tunggu" }: LoadingOverlayProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-200/45 bg-white/[0.85] py-12 text-center text-amber-600/80 shadow-[0_12px_34px_rgba(185,148,92,0.18)] dark:border-cyan-500/30 dark:bg-[#050c1f]/90 dark:text-cyan-200/80 dark:shadow-[0_0_45px_rgba(0,255,234,0.18)]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-white/10 opacity-70 dark:from-cyan-400/30 dark:via-transparent dark:to-fuchsia-500/20" />
      <div className="relative flex flex-col items-center gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-full border border-amber-200/60 bg-white/90 shadow-[0_12px_20px_rgba(205,161,83,0.25)] animate-floaty dark:border-cyan-500/30 dark:bg-[#071732]/85 dark:shadow-[0_0_34px_rgba(0,255,234,0.22)]">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500 dark:text-cyan-300" />
        </span>
        <div className="text-sm font-semibold uppercase tracking-[0.3em]">{message}</div>
        <div className="text-[0.6rem] uppercase tracking-[0.5em] text-amber-500/70 dark:text-cyan-200/70">{subtext}</div>
      </div>
    </div>
  );
}

export const DATA_SHELL_CLASS =
  "overflow-x-auto rounded-2xl border border-amber-200/55 bg-white/70 p-4 shadow-[0_18px_45px_rgba(185,148,92,0.18)] transition-all duration-500 dark:border-cyan-800/40 dark:bg-[#0c1220]/60 dark:shadow-[0_0_45px_rgba(0,255,234,0.18)]";

export const DATA_SHELL_BUSY_CLASS = "pointer-events-none blur-[1.1px] opacity-30";

type DataShellProps = {
  loading: boolean;
  hasData: boolean;
  children: ReactNode;
  emptyHint?: ReactNode;
  message?: string;
  subtext?: string;
};

export function DataShell({
  loading,
  hasData,
  children,
  emptyHint,
  message = "Menyiapkan data",
  subtext = "harap tunggu",
}: DataShellProps) {
  return (
    <div className="relative">
      {loading && <LoadingOverlay message={message} subtext={subtext} />}
      <div className={`${DATA_SHELL_CLASS} ${loading ? DATA_SHELL_BUSY_CLASS : ""}`}>
        {hasData ? (
          children
        ) : loading ? (
          <LoadingBlank message={message} subtext={subtext} />
        ) : (
          emptyHint ?? (
            <div className="px-6 py-8 text-sm text-amber-700/70 dark:text-cyan-200/70">
              Tidak ada data. Tentukan filter lalu tekan Search.
            </div>
          )
        )}
      </div>
    </div>
  );
}

