// FILE: src/components/ui/DateRangePopup.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DateRange, Range, RangeKeyDict } from "react-date-range";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Calendar } from "lucide-react";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

export type DateRangePopupProps = {
  start: string;           // YYYY-MM-DD
  end: string;             // YYYY-MM-DD
  onChange: (s: string, e: string) => void;
  placeholder?: string;
  className?: string;
  months?: 1 | 2;          // berapa bulan ditampilkan
  minWidth?: number;       // px, default 660 agar 2 bulan muat
  align?: "start" | "center" | "end"; // <— NEW fitur align (belum diimplementasi)
};

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toISOlocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseISOlocal = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
};
const fmtDMY = (d: Date) => format(d, "dd-MM-yyyy", { locale: idLocale });

const navKeys = new Set(["Backspace","Delete","Tab","Enter","Escape","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"]);
const maskToDDMMYYYY = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}-${mm}`;
  return `${dd}-${mm}-${yyyy}`;
};
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
  return dt.getFullYear() === yyyy && dt.getMonth() === (mm - 1) && dt.getDate() === dd && yyyy >= 1900 && yyyy <= 2100;
};
const parseDDMMYYYY = (s: string): Date | null =>
  (isValidDDMMYYYY(s) ? new Date(Number(s.slice(6, 10)), Number(s.slice(3, 5)) - 1, Number(s.slice(0, 2)), 0, 0, 0, 0) : null);

export default function DateRangePopup({
  start,
  end,
  onChange,
  placeholder = "DD-MM-YYYY - DD-MM-YYYY",
  className,
  months = 2,
  minWidth = 700,
  align = "center", // <— NEW fitur align (belum diimplementasi)
}: DateRangePopupProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Range>({ startDate: parseISOlocal(start), endDate: parseISOlocal(end), key: "selection" });
  const [manualStart, setManualStart] = useState(fmtDMY(parseISOlocal(start)));
  const [manualEnd, setManualEnd] = useState(fmtDMY(parseISOlocal(end)));
  const [manualError, setManualError] = useState("");

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: minWidth });

  useEffect(() => {
    setDraft({ startDate: parseISOlocal(start), endDate: parseISOlocal(end), key: "selection" });
    setManualStart(fmtDMY(parseISOlocal(start)));
    setManualEnd(fmtDMY(parseISOlocal(end)));
    setManualError("");
  }, [start, end]);

  // Hitung posisi & lebar popover
  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const relayout = () => {
      const r = triggerRef.current!.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const margin = 10;

      // Lebar popover
      const ideal = Math.max(r.width, minWidth, months === 2 ? 640 : 360);
      const maxAllowed = vw - margin * 2;
      const width = Math.min(ideal, Math.max(360, maxAllowed));

      // Posisi horizontal — CENTER ke trigger, lalu clamp agar tidak keluar layar
      let left: number;
      if (align === "start") {
        left = r.left + window.scrollX;
      } else if (align === "end") {
        left = r.right + window.scrollX - width;
      } else {
        // "center"
        left = r.left + r.width / 2 + window.scrollX - width / 2;
      }
      const minLeft = window.scrollX + margin;
      const maxLeft = window.scrollX + vw - width - margin;
      left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));

      // Posisi vertikal, flip ke atas bila perlu
      const estHeight = months === 2 ? 520 : 480;
      let top = r.bottom + window.scrollY + margin;
      if (top + estHeight + margin > window.scrollY + vh) {
        top = r.top + window.scrollY - estHeight - margin;
      }

      setPos({ top, left, width });
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
  }, [open, months, minWidth, align]);

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

  const onKeyDownMasked = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || navKeys.has(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
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
    setManualError("");
  };

  const canApply = useMemo(() => {
    const s = parseDDMMYYYY(manualStart);
    const e = parseDDMMYYYY(manualEnd);
    return !!(s && e && e >= s);
  }, [manualStart, manualEnd]);

  function apply() {
    const s = parseDDMMYYYY(manualStart);
    const e = parseDDMMYYYY(manualEnd);
    if (!s || !e) { setManualError("Gunakan format DD-MM-YYYY yang valid."); return; }
    if (e < s) { setManualError("Tanggal akhir tidak boleh sebelum tanggal awal."); return; }
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

      {/* Popover */}
      {open &&
        createPortal(
          <div
            data-drp-popover
            ref={panelRef}
            className="fixed z-[10000]"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <div className="rounded-xl border border-cyan-500/25 bg-[#0b0b1a] shadow-[0_10px_40px_rgba(0,0,0,.55)] overflow-hidden">
              <div className="p-3">
                <DateRange
                  onChange={onSelect}
                  ranges={[draft]}
                  months={months}
                  direction="horizontal"
                  showDateDisplay={false}
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
                        className={`drp-input ${!isValidDDMMYYYY(manualStart) ? "is-invalid" : ""} px-3 py-2 rounded-lg text-sm`}
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
                      className={`drp-input ${!isValidDDMMYYYY(manualEnd) ? "is-invalid" : ""} px-3 py-2 rounded-lg text-sm`}
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

                <div className="flex items-center justify-end gap-2 mt-3">
                  <button type="button" onClick={cancel} className="px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={apply}
                    disabled={!canApply}
                    className="px-3 py-1.5 text-sm rounded-lg bg-cyan-600/30 hover:bg-cyan-600/45 border border-cyan-400/40 shadow-[0_0_12px_#00ffff55] disabled:opacity-60"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          <style jsx global>{`
            /* Input manual tanggal */
            [data-drp-popover] .drp-input{
              background-color:#0f1629 !important;  /* dark, bukan putih */
              color:#d1feff !important;
              border:1px solid rgba(34,211,238,.25) !important; /* cyan-400/25 */
              outline:none !important;
            }
            [data-drp-popover] .drp-input::placeholder{
              color:rgba(165,243,252,.45) !important; /* cyan-200/45 */
            }
            [data-drp-popover] .drp-input:focus{
              border-color:rgba(34,211,238,.6) !important;
              box-shadow:0 0 0 2px rgba(34,211,238,.15) !important;
            }
            /* State invalid */
            [data-drp-popover] .drp-input.is-invalid{
              background-color:#1a1020 !important;
              color:#ffe4e6 !important; /* rose-100 */
              border-color:rgba(244,63,94,.45) !important; /* rose-500/45 */
              box-shadow:0 0 0 2px rgba(244,63,94,.2) !important;
            }
            /* Tangkis autofill */
            [data-drp-popover] .drp-input:-webkit-autofill,
            [data-drp-popover] .drp-input:-webkit-autofill:hover,
            [data-drp-popover] .drp-input:-webkit-autofill:focus{
              -webkit-text-fill-color:#d1feff !important;
              -webkit-box-shadow:0 0 0px 1000px #0f1629 inset !important;
              box-shadow:0 0 0px 1000px #0f1629 inset !important;
              caret-color:#a5f3fc !important;
            }
          `}</style>
        </div>,
        document.body
        )}
    </>
  );
}
