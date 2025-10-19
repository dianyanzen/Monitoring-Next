// FILE: src/components/ui/DateRangePopup.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DateRange, Range, RangeKeyDict } from "react-date-range";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Calendar } from "lucide-react";

// styles bawaan
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

export type DateRangePopupProps = {
  start: string;                       // YYYY-MM-DD
  end: string;                         // YYYY-MM-DD
  onChange: (s: string, e: string) => void;
  placeholder?: string;
  className?: string;
};

/* ===== Utilities: tanggal lokal aman (anti timezone drift) ===== */
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toISOlocal = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseISOlocal = (s: string) => {
  // s: YYYY-MM-DD → bangun Date lokal (jam 00:00 lokal)
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
};
const fmtDMY = (d: Date) => format(d, "dd-MM-yyyy", { locale: idLocale });

export default function DateRangePopup({
  start,
  end,
  onChange,
  placeholder = "DD-MM-YYYY - DD-MM-YYYY",
  className,
}: DateRangePopupProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Range>({
    startDate: parseISOlocal(start),
    endDate: parseISOlocal(end),
    key: "selection",
  });
  const [manualStart, setManualStart] = useState(fmtDMY(parseISOlocal(start)));
  const [manualEnd, setManualEnd] = useState(fmtDMY(parseISOlocal(end)));
  const [manualError, setManualError] = useState<string>("");

  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 360,
  });

  /* Sinkronisasi dari parent ketika start/end berubah */
  useEffect(() => {
    setDraft({
      startDate: parseISOlocal(start),
      endDate: parseISOlocal(end),
      key: "selection",
    });
    setManualStart(fmtDMY(parseISOlocal(start)));
    setManualEnd(fmtDMY(parseISOlocal(end)));
  }, [start, end]);

  /* Hitung & clamp posisi popover saat dibuka / relayout */
  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const relayout = () => {
      const el = triggerRef.current!;
      const r = el.getBoundingClientRect();

      // ukuran popover (kalender 2 bulan ~ 600-700px; kita pakai lebar trigger agar konsisten)
      const desiredWidth = r.width || 360;
      const margin = 8;

      // posisi dasar
      let top = r.bottom + window.scrollY + margin;
      let left = r.left + window.scrollX;

      // clamp agar tidak keluar viewport kanan/bawah
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;

      // estimasi tinggi popover (kisaran 360-420)
      const estimatedHeight = 420;

      if (left + desiredWidth + margin > window.scrollX + vw) {
        left = Math.max(window.scrollX + margin, vw + window.scrollX - desiredWidth - margin);
      }
      if (top + estimatedHeight + margin > window.scrollY + vh) {
        // jika tidak muat ke bawah, tampilkan di atas trigger
        top = r.top + window.scrollY - estimatedHeight - margin;
      }

      setPos({ top, left, width: desiredWidth });
    };

    relayout();

    document.addEventListener("mousedown", onDocClick, { capture: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", relayout);
    window.addEventListener("scroll", relayout, true);

    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(t) &&
        !(t as HTMLElement).closest?.("[data-drp-popover]")
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    return () => {
      document.removeEventListener("mousedown", onDocClick, { capture: true } as any);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", relayout);
      window.removeEventListener("scroll", relayout, true);
    };
  }, [open]);

  useEffect(() => {
    if (!draft.startDate || !draft.endDate) return;
    setManualStart(fmtDMY(draft.startDate));
    setManualEnd(fmtDMY(draft.endDate));
  }, [draft.startDate, draft.endDate]);

  const display = useMemo(() => {
    if (!draft.startDate || !draft.endDate) return "";
    return `${fmtDMY(draft.startDate)} - ${fmtDMY(draft.endDate)}`;
  }, [draft]);

  function onSelect(ranges: RangeKeyDict) {
    setDraft(ranges.selection);
    if (ranges.selection.startDate) setManualStart(fmtDMY(ranges.selection.startDate));
    if (ranges.selection.endDate) setManualEnd(fmtDMY(ranges.selection.endDate));
    setManualError("");
  }

  const parseManual = (value: string) => {
    if (!/^\d{2}-\d{2}-\d{4}$/.test(value)) return null;
    const [dd, mm, yyyy] = value.split("-").map(Number);
    const date = new Date(yyyy, (mm || 1) - 1, dd || 1, 0, 0, 0, 0);
    if (
      date.getFullYear() !== yyyy ||
      date.getMonth() !== ((mm || 1) - 1) ||
      date.getDate() !== (dd || 1)
    ) {
      return null;
    }
    return date;
  };

  function validateManualInputs() {
    const startDate = parseManual(manualStart);
    const endDate = parseManual(manualEnd);
    if (!startDate || !endDate) {
      setManualError("Gunakan format DD-MM-YYYY.");
      return null;
    }
    if (endDate < startDate) {
      setManualError("Tanggal akhir tidak boleh sebelum tanggal awal.");
      return null;
    }
    setManualError("");
    return { startDate, endDate };
  }

  function apply() {
    const parsed = validateManualInputs();
    if (!parsed) return;
    const { startDate, endDate } = parsed;
    setDraft({ startDate, endDate, key: "selection" });
    onChange(toISOlocal(startDate), toISOlocal(endDate));
    setOpen(false);
  }
  function cancel() {
    setDraft({ startDate: parseISOlocal(start), endDate: parseISOlocal(end), key: "selection" });
    setManualStart(fmtDMY(parseISOlocal(start)));
    setManualEnd(fmtDMY(parseISOlocal(end)));
    setManualError("");
    setOpen(false);
  }

  return (
    <>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-[360px] flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-800/60 bg-[#0e0e1c]/70 text-sm text-cyan-100 shadow-[0_0_12px_#00ffff11_inset] ${className ?? ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Calendar className="w-4 h-4 opacity-70" />
        <span className={display ? "" : "opacity-50"}>
          {display || placeholder}
        </span>
      </button>

      {/* Popover via portal */}
      {open &&
        createPortal(
          <div
            data-drp-popover
            className="fixed z-[10000]"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <div className="rounded-xl border border-white/10 bg-[#0b0b1a] shadow-2xl overflow-hidden">
              <div className="p-3">
                <DateRange
                  onChange={onSelect}
                  ranges={[draft]}
                  showDateDisplay={false}
                  months={2}
                  direction="horizontal"
                  locale={idLocale}
                  rangeColors={["#22d3ee"]}
                  weekStartsOn={1}
                  scroll={{ enabled: false }}
                  showMonthAndYearPickers
                />
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-xs text-cyan-200/80 tracking-wide uppercase">
                    Tanggal awal (DD-MM-YYYY)
                    <input
                      value={manualStart}
                      onChange={(e) => setManualStart(e.target.value)}
                      onBlur={validateManualInputs}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          apply();
                        }
                      }}
                      className="drp-input px-3 py-2 rounded-lg border text-sm outline-none"
                      placeholder="01-01-2024"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-cyan-200/80 tracking-wide uppercase">
                    Tanggal akhir (DD-MM-YYYY)
                    <input
                      value={manualEnd}
                      onChange={(e) => setManualEnd(e.target.value)}
                      onBlur={validateManualInputs}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          apply();
                        }
                      }}
                      className="drp-input px-3 py-2 rounded-lg border text-sm outline-none"
                      placeholder="31-12-2024"
                    />
                  </label>
                </div>
                {manualError ? (
                  <p className="mt-2 text-xs text-rose-400">{manualError}</p>
                ) : (
                  <p className="mt-2 text-xs text-cyan-200/70">
                    Ketik manual dengan format DD-MM-YYYY atau gunakan kalender di atas.
                  </p>
                )}
                <div className="flex items-center justify-end gap-2 mt-3">
                  <button
                    type="button"
                    onClick={cancel}
                    className="px-3 py-1.5 text-sm rounded-lg border border-white/20 bg-white/5 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={apply}
                    className="px-3 py-1.5 text-sm rounded-lg border border-cyan-400/40 bg-cyan-600/30 hover:bg-cyan-600/50"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
