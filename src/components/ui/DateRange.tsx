// FILE: src/components/ui/DateRange.tsx
"use client";

import { Calendar } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type DateRangeProps = {
  start: string;                       // YYYY-MM-DD
  end: string;                         // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  className?: string;
};

function iso(d: Date) { return d.toISOString().slice(0, 10); }
function toDisp(isoStr: string) {
  const [y, m, d] = isoStr.split("-");
  return `${d}-${m}-${y}`;
}

export default function DateRange({ start, end, onChange, className }: DateRangeProps) {
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);

  // sync dari parent
  useEffect(() => { setS(start); }, [start]);
  useEffect(() => { setE(end); }, [end]);

  // jaga end >= start
  useEffect(() => { if (e < s) setE(s); }, [s, e]);

  const label = useMemo(() => `(${toDisp(s)} - ${toDisp(e)})`, [s, e]);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      {/* picker + border + icon */}
      <div className="flex items-center gap-2 border border-cyan-800/60 rounded-lg px-2 py-1 bg-[#0e0e1c]/70 shadow-[0_0_12px_#00ffff11_inset]">
        <Calendar className="w-4 h-4 opacity-70" />
        <input
          type="date"
          value={s}
          max={e}
          onChange={(ev) => { const v = ev.target.value; setS(v); onChange(v, e); }}
          className="bg-transparent outline-none text-sm"
        />
        <span className="opacity-60">—</span>
        <input
          type="date"
          value={e}
          min={s}
          onChange={(ev) => { const v = ev.target.value; setE(v); onChange(s, v); }}
          className="bg-transparent outline-none text-sm"
        />
      </div>

      {/* label kecil */}
      <span className="text-xs text-cyan-200/70">{label}</span>
    </div>
  );
}
