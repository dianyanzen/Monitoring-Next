// FILE: src/app/(routes)/check/history/page.tsx
"use client";

import { useMemo, useState } from "react";
import { Search, Trash2, Loader2, Download, RefreshCcw } from "lucide-react";
import { useSession } from "@/contexts/session";

type Row = {
  NIK: string;
  NO_KK: string | null;
  NAMA_LGKP: string | null;
  CHIP_ID: string | null;
  KTP_DT: string | null;
  KTP_BY: string | null;
  UPDATED_DT: string | null;
  UPDATED_BY: string | null;
  NAMA_KEC: string | null;
  NAMA_KEL: string | null;
};

const onlyDigitsOrComma = (s: string) => s.replace(/[^\d,]/g, "");
const onlyNik16 = (s: string) => s.replace(/[^\d]/g, "").slice(0, 16);
const softLeadingComma = (v?: string | null) => {
  const s = String(v ?? "").trim();
  return s ? `,${s}` : "";
};

export default function HistoryPage() {
  const { user } = useSession();
  const [nik, setNik] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const total = rows.length;

  const canSearch = useMemo(() => onlyNik16(nik).length === 16, [nik]);

  async function onSearch() {
    const clean = onlyNik16(nik);
    if (clean.length !== 16) {
      setMsg("NIK harus 16 digit.");
      setRows([]);
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/check/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nik: clean }),
      });

      const j = await res.json();

      const d1 = j?.data ?? j;
      const d2 = d1?.data ?? d1;
      const rowsAny: Row[] = (d2?.rows ?? []) as Row[];

      if (!res.ok) throw new Error(j?.message || `HTTP ${res.status}`);

      setRows(rowsAny);
      if (rowsAny.length === 0) setMsg("Data tidak ditemukan.");
    } catch (e: any) {
      setRows([]);
      setMsg(e?.message || "Gagal mengambil data.");
    } finally {
      setLoading(false);
    }
  }


  function onClear() {
    setNik("");
    setRows([]);
    setMsg(null);
  }

  function LoadingRow({ colSpan = 9 }: { colSpan?: number }) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-3 py-8">
          <div className="flex items-center justify-center gap-3 text-sm text-cyan-200/80">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4"/>
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            </svg>
            Mengambil data…
          </div>
        </td>
      </tr>
    );
  }


  function onExportCsv() {
    if (!rows.length) return;

    const headers = [
      "NO",
      "CHIP_EKTP",
      "NAMA",
      "NIK",
      "NO_KK",
      "CETAK_BY",
      "CETAK_TGL",
      "ENCODE_BY",
      "ENCODE_TGL",
      "NAMA_KEC",
      "NAMA_KEL",
    ];

    const lines = rows.map((r, i) => [
      String(i + 1),
      softLeadingComma(r.CHIP_ID) ?? "",
      r.NAMA_LGKP ?? "",
      softLeadingComma(r.NIK),
      softLeadingComma(r.NO_KK ?? ""),
      r.KTP_BY ?? "",
      r.KTP_DT ?? "",
      r.UPDATED_BY ?? "",
      r.UPDATED_DT ?? "",
      r.NAMA_KEC ?? "",
      r.NAMA_KEL ?? "",
    ]);

    const csv = [headers, ...lines]
      .map((row) =>
        row
          .map((v) => {
            const s = String(v ?? "");
            // quotes double -> escape
            return `"${s.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ktpel-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-10 pt-6 text-gray-100 sm:px-6 md:px-8 md:pt-8">
      {/* glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-[-15%] h-[1100px] w-[1100px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[18%] bottom-[-20%] h-[1000px] w-[1000px] rounded-full bg-fuchsia-600/12 blur-[190px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl overflow-hidden">
        {/* header */}
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
            <h1 className="text-base font-semibold tracking-wide text-cyan-200">
              Ktp-el Cek History Cetak
            </h1>
             <div className="ml-auto flex items-center gap-2">
              <div className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
                User: {(user as any)?.S_NAMA_LGKP ?? (user as any)?.S_USER_ID ?? "-"}
              </div>
              <button
                type="button"
                onClick={()=>window.location.reload()}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>
            {total > 0 ? (
              <span className="ml-auto text-xs text-cyan-200/80">
                Total: <span className="font-semibold text-cyan-100">{total}</span> data
              </span>
            ) : null}
          </div>
        </header>

        {/* toolbar */}
        <div className="px-5 pb-2 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
              <input type="checkbox" checked readOnly className="accent-cyan-500" />
              NIK
            </label>

            <input
              className="w-[260px] rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              type="text"
              inputMode="numeric"
              maxLength={16}
              placeholder="Masukkan NIK (16 digit)"
              value={nik}
              autoFocus
              onChange={(e) => setNik(onlyDigitsOrComma(e.target.value))}
              onKeyDown={(e) => {
                const nav = ["Backspace", "Delete", "Tab", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"];
                if (e.ctrlKey || e.metaKey || nav.includes(e.key)) return;
                if (!/^\d$/.test(e.key)) e.preventDefault();
                if (onlyNik16(nik).length >= 16) e.preventDefault();
              }}
              onPaste={(e) => {
                e.preventDefault();
                setNik(onlyDigitsOrComma(e.clipboardData.getData("text") || ""));
              }}
              onKeyUp={(e) => {
                if (e.key === "Enter") onSearch();
              }}
            />

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={onSearch}
                disabled={loading || !canSearch}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-600/25 px-4 py-2 text-sm shadow-[0_0_14px_#00ffff55] transition-colors hover:bg-cyan-600/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? "Loading…" : "Search"}
              </button>
              <button
                onClick={onClear}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100 transition-colors hover:bg-[#0c1220]/90"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
              <button
                onClick={onExportCsv}
                disabled={!rows.length}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>

          {msg && (
            <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {msg}
            </div>
          )}
        </div>

        {/* table */}
        <div className="p-4">
          <div className="overflow-hidden rounded-xl border border-cyan-800/40 bg-black/30">
            <div className="overflow-x-auto">
              <div className="overflow-x-auto" aria-busy={loading} aria-live="polite">
              <table className="min-w-full divide-y divide-cyan-800/60 text-sm text-cyan-100/90">
                <thead className="bg-cyan-500/10 text-xs uppercase tracking-wide text-cyan-200">
                  <tr>
                    <th className="px-3 py-3 text-center">NO</th>
                    <th className="px-3 py-3 text-left">CHIP E-KTP</th>
                    <th className="px-3 py-3 text-left">NAMA</th>
                    <th className="px-3 py-3 text-center">NIK</th>
                    <th className="px-3 py-3 text-center">NOMOR KK</th>
                    <th className="px-3 py-3 text-left">CETAK E-KTP</th>
                    <th className="px-3 py-3 text-left">ENCODE ULANG E-KTP</th>
                    <th className="px-3 py-3 text-left">NAMA KEC</th>
                    <th className="px-3 py-3 text-left">NAMA KEL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-900/60">
                  {loading ? (
                    // Saat fetch: tampilkan loader baris tunggal
                    <tr>
                      <td colSpan={9} className="px-3 py-8">
                        <div className="flex items-center justify-center gap-3 text-sm text-cyan-200/80">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Mengambil data…
                        </div>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    // Setelah fetch selesai tapi kosong
                    <tr>
                      <td className="px-3 py-6 text-center text-cyan-200/70" colSpan={9}>
                        No data available
                      </td>
                    </tr>
                  ) : (
                    // Data sudah ada
                    rows.map((r, i) => (
                      <tr key={`${r.NIK}-${i}`} className="transition hover:bg-cyan-500/10">
                        <td className="px-3 py-3 text-center text-xs font-medium text-cyan-100/70">{i + 1}</td>
                        <td className="px-3 py-3">{r.CHIP_ID ?? "-"}</td>
                        <td className="px-3 py-3">{r.NAMA_LGKP ?? "-"}</td>
                        <td className="px-3 py-3 text-center">
                          {r.NIK ? (
                            <span className="font-medium tracking-wide">
                              <span className="opacity-60">,</span>
                              <span>{r.NIK}</span>
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {r.NO_KK ? (
                            <span className="font-medium tracking-wide">
                              <span className="opacity-60">,</span>
                              <span>{r.NO_KK}</span>
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-cyan-100/80">
                          <div className="flex items-center gap-1 text-cyan-200/80">
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                            {r.KTP_BY ?? "-"}
                          </div>
                          <div className="ml-3 text-cyan-200/60">{r.KTP_DT ?? "-"}</div>
                        </td>
                        <td className="px-3 py-3 text-xs text-cyan-100/80">
                          <div className="flex items-center gap-1 text-cyan-200/80">
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                            {r.UPDATED_BY ?? "-"}
                          </div>
                          <div className="ml-3 text-cyan-200/60">{r.UPDATED_DT ?? "-"}</div>
                        </td>
                        <td className="px-3 py-3 text-xs text-cyan-100/80">{r.NAMA_KEC ?? "-"}</td>
                        <td className="px-3 py-3 text-xs text-cyan-100/80">{r.NAMA_KEL ?? "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
