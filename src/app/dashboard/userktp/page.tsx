// FILE: src/app/dashboard/userktp/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Trash2, ChevronRight } from "lucide-react";
import DateRangePopup from "@/components/ui/DateRangePopup";

/* ========= Types ========= */
type Row = {
  USER_ID: string;
  TGL: string;
  MULAI: string;
  SELESAI: string;
  JML: number;
};

/* ========= Helpers ========= */
const iso = (d: Date) => d.toISOString().slice(0, 10);
const todayISO = () => iso(new Date());
const toDisp = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}-${m}-${y}`;
};
const rangeLabel = (s: string, e: string) => `(${toDisp(s)} - ${toDisp(e)})`;
const monthEdges = (d = new Date()) => {
  const s = new Date(d.getFullYear(), d.getMonth(), 1);
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: iso(s), end: iso(e) };
};

export default function UserKtpPage() {
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const label = useMemo(() => rangeLabel(start, end), [start, end]);

  async function load(s = start, e = end) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/userktp/summary?start=${s}&end=${e}`, {
        cache: "no-store",
        signal: ac.signal,
      });
      const j = await res.json();
      setRows((j?.data ?? []) as Row[]);
    } catch {
      if (!ac.signal.aborted) setRows([]);
    } finally {
      if (!ac.signal.aborted) {
        setLoading(false);
        setFirstLoad(false);
      }
    }
  }

  useEffect(() => {
    load(); // first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (end < start) setEnd(start);
  }, [start, end]);

  const onClear = () => {
    const t = todayISO();
    setStart(t);
    setEnd(t);
  };

  return (
    <div className="page-userktp relative px-8 pb-8 pt-6 md:pt-8 text-gray-200 space-y-8 mt-5">
      {/* Ambient cyberpunk glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-15%] left-[15%] w-[1100px] h-[1100px] bg-cyan-500/15 blur-[220px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[18%] w-[1000px] h-[1000px] bg-fuchsia-600/12 blur-[190px] rounded-full" />
      </div>

      {/* Panel */}
      <section className="rounded-2xl border border-cyan-800/40 bg-[#0b0b1a]/80 backdrop-blur-xl shadow-[0_0_34px_#00ffff22] overflow-hidden">
        {/* Header title */}
        <header className="px-5 py-4 border-b border-cyan-900/50">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
            <h1 className="text-base font-semibold tracking-wide text-cyan-200">
              List Pencetakan KTP-EL Per-User
            </h1>
            <div className="ml-auto h-[2px] w-48 bg-gradient-to-r from-cyan-400 via-pink-400 to-transparent opacity-70" />
          </div>
        </header>

        {/* Toolbar */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <label className="inline-flex items-center gap-2 text-sm text-cyan-200/90">
              <input type="checkbox" checked readOnly className="accent-cyan-500" />
              Tanggal Cetak
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <DateRangePopup
                start={start}
                end={end}
                onChange={(s, e) => {
                  setStart(s);
                  setEnd(e);
                }}
                minWidth={700}
                months={2}
              />
              <span className="text-xs text-cyan-200/70">{label}</span>

              {/* Quick chips */}
              <div className="flex items-center gap-2">
                <Chip onClick={() => {
                  const t = todayISO();
                  setStart(t);
                  setEnd(t);
                }}>Today</Chip>
                <Chip onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  const y = iso(d);
                  setStart(y);
                  setEnd(y);
                }}>Yesterday</Chip>
                <Chip onClick={() => {
                  const to = todayISO();
                  const d = new Date();
                  d.setDate(d.getDate() - 6);
                  const fr = iso(d);
                  setStart(fr);
                  setEnd(to);
                }}>Last 7d</Chip>
                <Chip onClick={() => {
                  const { start: ms, end: me } = monthEdges();
                  setStart(ms);
                  setEnd(me);
                }}>This Month</Chip>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => load()}
                data-overlay-on-click
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600/25 hover:bg-cyan-600/40 border border-cyan-400/40 text-sm shadow-[0_0_14px_#00ffff55] transition-colors"
              >
                <Search className="w-4 h-4" />
                {loading && !firstLoad ? "Loading…" : "Search"}
              </button>
              <button
                onClick={onClear}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/20 text-sm transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Divider glow */}
        <div className="mx-5 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

        {/* List */}
        <div className="p-4">
          {loading && firstLoad ? (
            <SkeletonList />
          ) : rows.length === 0 ? (
            <div className="px-2 py-4 text-sm text-cyan-200/80">
              Petugas Cetak belum ada yang mencetak KTP-EL pada rentang ini {label}. ~ 0
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((r, i) => (
                <li
                    key={`${r.USER_ID}-${r.TGL}`}
                    className="relative rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-colors"
                  >
                    <span className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-gradient-to-b from-cyan-400 via-pink-400 to-cyan-400 shadow-[0_0_14px_#00ffff66]" />

                    {/* items-center → kolom kanan ikut center vertikal */}
                    <div className="pl-4 pr-3 py-4 md:pl-5 md:pr-4 flex items-center justify-between gap-4">
                      {/* LEFT */}
                      <div className="pr-2">
                        <h3 className="font-semibold text-indigo-200 tracking-wide">{r.USER_ID}</h3>
                        <p className="mt-1 text-[12px] leading-5 text-cyan-100/80">
                          {r.TGL}<br />
                          Dari Jam : {r.MULAI}<br />
                          Sampai Jam : {r.SELESAI}
                        </p>
                      </div>

                      {/* RIGHT – center & bigger */}
                      <div className="min-w-[180px] flex flex-col items-end justify-center gap-2">
                        <div className="inline-flex items-center justify-center px-4 py-2
                                        rounded-full text-lg font-semibold">
                          ~ {r.JML}
                        </div>

                        <Link
                          href={{
                            pathname: `/dashboard/userktp/${encodeURIComponent(r.USER_ID)}`,
                            query: { start, end },
                          }}
                          className="btn-detail inline-flex items-center justify-center gap-2
                                    px-4 py-2 rounded-lg text-sm font-medium
                                    bg-cyan-600/30 hover:bg-cyan-600/45
                                    border border-cyan-400/40
                                    shadow-[0_0_12px_#00ffff55] transition-colors"
                        >
                          Detail <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </li>

              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

/* ========= UI bits ========= */
function Chip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="chip text-xs px-2.5 py-1 rounded-md border border-cyan-700/40 bg-cyan-600/10 hover:bg-cyan-600/20 transition-colors"
    >
      {children}
    </button>
  );
}

function SkeletonList() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="relative rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <span className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-gradient-to-b from-cyan-400 via-pink-400 to-cyan-400 opacity-60" />
          <div className="pl-4 pr-3 py-4 md:pl-5 md:pr-4">
            <div className="h-4 w-40 bg-white/10 rounded animate-pulse mb-2" />
            <div className="h-3 w-72 bg-white/10 rounded animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  );
}
