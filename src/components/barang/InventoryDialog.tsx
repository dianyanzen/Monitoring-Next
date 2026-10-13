"use client";
import { useEffect, useRef, useId, type ReactNode } from "react";
import { X } from "lucide-react";
export default function InventoryDialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const active = document.activeElement as HTMLElement | null;
    d.showModal();
    return () => {
      d.close();
      active?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="monalisa-ops ops-dialog"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="ops-header">
        <h2 id={id}>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Tutup dialog"
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
