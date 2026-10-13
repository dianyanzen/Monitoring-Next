// FILE: src/components/ui/NeonModal.tsx
"use client";

import { useEffect, useRef, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  HelpCircle,
} from "lucide-react";

export type ModalKind = "info" | "success" | "warning" | "error" | "confirm";

type Props = {
  open: boolean;
  kind?: ModalKind;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
};

const iconByKind: Record<ModalKind, any> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  confirm: HelpCircle,
};

const colorRingByKind: Record<ModalKind, string> = {
  info: "from-cyan-400 via-blue-400 to-fuchsia-400",
  success: "from-emerald-400 via-cyan-400 to-emerald-400",
  warning: "from-amber-400 via-orange-400 to-amber-400",
  error: "from-rose-400 via-fuchsia-400 to-rose-400",
  confirm: "from-cyan-400 via-fuchsia-400 to-cyan-400",
};

export default function NeonModal({
  open,
  kind = "info",
  title = "Notification",
  message = "",
  confirmText = "OK",
  cancelText = "Cancel",
  loading = false,
  onConfirm,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(
      () =>
        dialogRef.current
          ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
          ?.focus(),
      0,
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
      if (e.key === "Enter" && kind !== "confirm" && !loading) onClose();
      if (e.key === "Tab") {
        const elements = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        );
        if (!elements?.length) {
          e.preventDefault();
          return;
        }
        const first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose, kind, loading]);

  const Icon = iconByKind[kind];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          className="fixed inset-0 z-[2000] flex items-center justify-center"
          aria-modal="true"
          aria-labelledby={titleId}
          ref={dialogRef}
          role="dialog"
          onClick={(e) => !loading && e.target === e.currentTarget && onClose()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* BACKDROP */}
          <div className="absolute inset-0 bg-black/75 backdrop-blur-[6px]" />

          {/* PARTICLES (dekor halus) */}
          <div className="pointer-events-none absolute inset-0 [background:radial-gradient(650px_200px_at_20%_10%,rgba(0,255,255,.08),transparent_60%),radial-gradient(450px_180px_at_80%_90%,rgba(255,0,170,.07),transparent_60%)] animate-[float_12s_ease-in-out_infinite]" />

          {/* CARD */}
          <motion.div
            key="card"
            className="relative w-[92%] max-w-[560px]"
            initial={{ y: 30, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
          >
            {/* BORDER RING BERPUTAR */}
            <div className="absolute -inset-[2px] rounded-[20px] overflow-hidden">
              <div
                className={`absolute inset-0 rounded-[20px] opacity-80
                            bg-[conic-gradient(var(--tw-gradient-stops))]
                            ${"from-cyan-400 via-fuchsia-500 to-cyan-400"}
                            animate-[borderSpin_4.5s_linear_infinite]`}
              />
              <div className="absolute inset-[2px] rounded-[18px] bg-[#071019] opacity-90" />
            </div>

            {/* BODY */}
            <div
              className="relative rounded-[18px] border border-cyan-400/20 bg-[#0b0f14]/90 p-6
                            shadow-[0_0_35px_rgba(0,255,255,.12),inset_0_0_60px_rgba(255,0,170,.05)]
                            backdrop-blur"
            >
              {/* SCANLINES & SHIMMER */}
              <div className="pointer-events-none absolute inset-0 rounded-[18px] overflow-hidden">
                <div className="absolute inset-0 opacity-[0.08] mix-blend-soft-light bg-[linear-gradient(transparent_7px,rgba(255,255,255,.2)_8px,transparent_9px)] bg-[length:100%_9px] animate-[scanlines_10s_linear_infinite]" />
                <div className="absolute -top-1/2 left-0 right-0 h-[200%] bg-[linear-gradient(to_bottom,rgba(255,255,255,0)_0%,rgba(255,255,255,.12)_50%,rgba(255,255,255,0)_100%)] opacity-0 animate-[shimmer_4s_ease-in-out_infinite]" />
              </div>

              {/* HEADER */}
              <div className="flex items-start gap-3">
                <div className={`relative mt-1`}>
                  <div
                    className={`absolute -inset-2 rounded-full blur-md opacity-60 bg-gradient-to-r ${colorRingByKind[kind]} animate-[glowPulse_3.5s_ease-in-out_infinite]`}
                  />
                  <Icon className="relative w-7 h-7 text-cyan-200 drop-shadow-[0_0_8px_rgba(0,255,255,.45)]" />
                </div>
                <div>
                  <h3
                    id={titleId}
                    className="text-lg font-extrabold tracking-wide text-cyan-100"
                  >
                    {title}
                  </h3>
                  {message && (
                    <p className="mt-2 text-[13.5px] leading-relaxed text-cyan-100/85">
                      {message}
                    </p>
                  )}
                </div>
              </div>

              {/* ACTIONS */}
              <div className="mt-6 flex items-center justify-end gap-3">
                {kind === "confirm" && (
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl border border-cyan-400/30 text-cyan-200/90 hover:text-cyan-100 hover:bg-white/5 transition
                               focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                  >
                    {cancelText}
                  </button>
                )}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    if (kind === "confirm") onConfirm?.();
                    else onClose();
                  }}
                  className="relative px-4 py-2 rounded-xl text-cyan-50
                             border border-cyan-400/40 bg-cyan-500/15 hover:bg-cyan-500/25
                             shadow-[0_0_18px_rgba(0,255,255,.25)]
                             focus:outline-none focus:ring-2 focus:ring-cyan-400/40
                             transition group"
                >
                  {/* tombol glow ring */}
                  <span className="pointer-events-none absolute -inset-[1px] rounded-xl bg-[radial-gradient(220px_80px_at_50%_-20%,rgba(0,255,255,.35),transparent_60%)] opacity-0 group-hover:opacity-100 transition" />
                  {loading
                    ? "Processing…"
                    : kind === "confirm"
                      ? confirmText
                      : "OK"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
