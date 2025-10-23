// FILE: src/components/ui/DateRangePopup.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DateRange, Range, RangeKeyDict } from "react-date-range";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Calendar } from "lucide-react";

// styles bawaan lib
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

/* ========= Types ========= */
export type DateRangePopupProps = {
  start: string;                       // YYYY-MM-DD
  end: string;                         // YYYY-MM-DD
  onChange: (s: string, e: string) => void;
  placeholder?: string;
  className?: string;
};

/* ========= Utils tanggal lokal ========= */
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toISOlocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseISOlocal = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
};
const fmtDMY = (d: Date) => format(d, "dd-MM-yyyy", { locale: idLocale });

/* ========= Masking & Validasi ========= */
const navKeys = new Set([
  "Backspace","Delete","Tab","Enter","Escape",
  "ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End",
]);

// 12345678 -> 12-34-5678 (maks 8 digit)
const maskToDDMMYYYY = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}-${mm}`;
  return `${dd}-${mm}-${yyyy}`;
};

// pad 1-2-2025 -> 01-02-2025
const normalizeDDMMYYYY = (s: string) => {
  if (!s) return s;
  const parts = s.split("-").map((p) => p.replace(/\D/g, ""));
  const dd = (parts[0] || "").padStart(2, "0").slice(0, 2);
  const mm = (parts[1] || "").padStart(2, "0").slice(0, 2);
  const yyyy = (parts[2] || "").padStart(4, "0").slice(0, 4);
  return maskToDDMMYYYY(`${dd}${mm}${yyyy}`);
};

const isValidDDMMYYYY = (s: string) => {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(s)) return false;
  const [dd, mm, yyyy] = s.split("-").map(Number);
  const dt = new Date(yyyy, (mm || 1) - 1, dd || 1, 0, 0, 0, 0);
  return (
    dt.getFullYear() === yyyy &&
    dt.getMonth() === ((mm || 1) - 1) &&
    dt.getDate() === (dd || 1) &&
    yyyy >= 1900 && yyyy <= 2100
  );
};

const parseDDMMYYYY = (s: string): Date | null => (isValidDDMMYYYY(s) ? new Date(
  Number(s.slice(6, 10)), Number(s.slice(3, 5)) - 1, Number(s.slice(0, 2)), 0, 0, 0, 0
) : null);

/* ========= Component ========= */
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
  const [manualError, setManualError] = useState("");

  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 360 });

  /* Sinkron dari parent */
  useEffect(() => {
    setDraft({ startDate: parseISOlocal(start), endDate: parseISOlocal(end), key: "selection" });
    setManualStart(fmtDMY(parseISOlocal(start)));
    setManualEnd(fmtDMY(parseISOlocal(end)));
    setManualError("");
  }, [start, end]);

  /* Posisi popover */
  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const relayout = () => {
      const r = triggerRef.current!.getBoundingClientRect();
      const desiredWidth = r.width || 360;
      const margin = 8;
      let top = r.bottom + window.scrollY + margin;
      let left = r.left + window.scrollX;
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const estimatedHeight = 420;
      if (left + desiredWidth + margin > window.scrollX + vw) {
        left = Math.max(window.scrollX + margin, vw + window.scrollX - desiredWidth - margin);
      }
      if (top + estimatedHeight + margin > window.scrollY + vh) {
        top = r.top + window.scrollY - estimatedHeight - margin;
      }
      setPos({ top, left, width: desiredWidth });
    };

    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current && !triggerRef.current.contains(t) && !(t as HTMLElement).closest?.("[data-drp-popover]")) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };

    relayout();
    document.addEventListener("mousedown", onDocClick, { capture: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", relayout);
    window.addEventListener("scroll", relayout, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick as any, { capture: true } as any);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", relayout);
      window.removeEventListener("scroll", relayout, true);
    };
  }, [open]);

  /* Saat klik kalender, sinkron ke input manual */
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

  /* ====== Input handlers (masking & sanitize) ====== */
  const onKeyDownMasked = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || navKeys.has(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault(); // angka saja
  };
  const onPasteMasked = (setter: (v: string) => void) => (e: React.ClipboardEvent<HTMLInputElement>) => {
    const t = e.clipboardData?.getData("text") ?? "";
    e.preventDefault();
    setter(maskToDDMMYYYY(t));
  };
  const onChangeMasked = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(maskToDDMMYYYY(e.target.value));
  };
  const onBlurNormalize = (setter: (v: string) => void) => (e: React.FocusEvent<HTMLInputElement>) => {
    setter(normalizeDDMMYYYY(e.target.value));
    setManualError(""); // bersihkan pesan sementara
  };

  /* ====== Validasi & Apply ====== */
  const canApply = useMemo(() => {
    const s = parseDDMMYYYY(manualStart);
    const e = parseDDMMYYYY(manualEnd);
    return !!(s && e && e >= s);
  }, [manualStart, manualEnd]);

  function apply() {
    const s = parseDDMMYYYY(manualStart);
    const e = parseDDMMYYYY(manualEnd);
    if (!s || !e) {
      setManualError("Gunakan format DD-MM-YYYY yang valid.");
      return;
    }
    if (e < s) {
      setManualError("Tanggal akhir tidak boleh sebelum tanggal awal.");
      return;
    }
    setManualError("");
    setDraft({ startDate: s, endDate: e, key: "selection" });
    onChange(toISOlocal(s), toISOlocal(e));
    setOpen(false);
  }
  function cancel() {
    const s = parseISOlocal(start);
    const e = parseISOlocal(end);
    setDraft({ startDate: s, endDate: e, key: "selection" });
    setManualStart(fmtDMY(s));
    setManualEnd(fmtDMY(e));
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
        className={`w-[360px] flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-800/60 bg-[#0e0e1c]/70 text-sm text-cyan-100 shadow-[inset_0_0_12px_#00ffff11] ${className ?? ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Calendar className="w-4 h-4 opacity-70" />
        <span className={display ? "" : "opacity-50"}>{display || placeholder}</span>
      </button>

      {/* Popover via portal */}
      {open &&
        createPortal(
          <div data-drp-popover className="fixed z-[10000]" style={{ top: pos.top, left: pos.left, width: pos.width }}>
            <div className="rounded-xl border border-cyan-500/25 bg-[#0b0b1a] shadow-[0_10px_40px_rgba(0,0,0,.55)] overflow-hidden">
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

                {/* Manual inputs */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-xs text-cyan-200/80 tracking-wide uppercase">
                    Tanggal awal (DD-MM-YYYY)
                    <input
                      value={manualStart}
                      onChange={onChangeMasked(setManualStart)}
                      onKeyDown={onKeyDownMasked}
                      onPaste={onPasteMasked(setManualStart)}
                      onBlur={onBlurNormalize(setManualStart)}
                      onKeyUp={(e) => { if (e.key === "Enter") apply(); }}
                      className={`drp-input px-3 py-2 rounded-lg border text-sm outline-none ${!isValidDDMMYYYY(manualStart) ? "border-rose-400/60 ring-1 ring-rose-400/40" : ""}`}
                      placeholder="01-01-2025"
                      inputMode="numeric"
                      aria-invalid={!isValidDDMMYYYY(manualStart)}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-cyan-200/80 tracking-wide uppercase">
                    Tanggal akhir (DD-MM-YYYY)
                    <input
                      value={manualEnd}
                      onChange={onChangeMasked(setManualEnd)}
                      onKeyDown={onKeyDownMasked}
                      onPaste={onPasteMasked(setManualEnd)}
                      onBlur={onBlurNormalize(setManualEnd)}
                      onKeyUp={(e) => { if (e.key === "Enter") apply(); }}
                      className={`drp-input px-3 py-2 rounded-lg border text-sm outline-none ${!isValidDDMMYYYY(manualEnd) ? "border-rose-400/60 ring-1 ring-rose-400/40" : ""}`}
                      placeholder="31-12-2025"
                      inputMode="numeric"
                      aria-invalid={!isValidDDMMYYYY(manualEnd)}
                    />
                  </label>
                </div>

                {manualError ? (
                  <p className="mt-2 text-xs text-rose-300/90">{manualError}</p>
                ) : (
                  <p className="mt-2 text-xs text-cyan-200/70">
                    Ketik manual dengan format DD-MM-YYYY atau gunakan kalender di atas.
                  </p>
                )}

                <div className="drp-actions flex items-center justify-end gap-2 mt-3">
                  <button
                    type="button"
                    onClick={cancel}
                    className="btn-cancel px-3 py-1.5 text-sm rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={apply}
                    disabled={!canApply}
                    className="btn-apply px-3 py-1.5 text-sm rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
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
