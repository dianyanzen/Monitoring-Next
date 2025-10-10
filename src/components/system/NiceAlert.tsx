"use client";

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type Props = {
  open: boolean;
  type?: "success" | "warning" | "error";
  title: string;
  message?: string;
  onClose: () => void;
  okText?: string;
};

export default function NiceAlert({
  open,
  type = "success",
  title,
  message,
  onClose,
  okText = "OK",
}: Props) {
  if (typeof document === "undefined") return null;

  const Icon =
    type === "success" ? CheckCircle2 : type === "warning" ? AlertTriangle : XCircle;

  const glow =
    type === "success"
      ? "shadow-[0_0_40px_#00ffcc55]"
      : type === "warning"
      ? "shadow-[0_0_40px_#ffd16655]"
      : "shadow-[0_0_40px_#ff006655]";

  const ring =
    type === "success"
      ? "border-cyan-400/50"
      : type === "warning"
      ? "border-amber-400/50"
      : "border-rose-400/50";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200000] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* card */}
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: 12, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 8, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={`relative w-[min(90vw,480px)] rounded-2xl border ${ring} bg-[#0b0b1a] text-cyan-50 p-6 ${glow}`}
          >
            <div className="flex flex-col items-center text-center">
              <Icon
                className={`w-16 h-16 ${
                  type === "success"
                    ? "text-cyan-300"
                    : type === "warning"
                    ? "text-amber-300"
                    : "text-rose-300"
                }`}
              />
              <h3 className="mt-4 text-2xl font-semibold">{title}</h3>
              {message && (
                <p className="mt-2 text-[15px] text-cyan-100/80">{message}</p>
              )}

              <button
                type="button"
                className="mt-6 px-5 py-2 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-400/40 text-cyan-100 shadow-[0_0_14px_#00ffff66] transition-colors"
                onClick={onClose}
              >
                {okText}
              </button>
            </div>
            {/* top neon line */}
            <div className="absolute inset-x-0 -top-px h-[2px] bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-cyan-400 opacity-70" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
