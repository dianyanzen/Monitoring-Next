"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarRange, Loader2, RefreshCcw, Search, Trash2 } from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import { DataShell } from "@/components/ui/LoadingOverlay";
import DateRangePopup from "@/components/ui/DateRangePopup";
import TypeableSelect from "@/components/ui/TypeableSelect";

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => (
    <div className="px-3 py-4 text-sm text-cyan-100/80">
      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
      Menyiapkan tabel...
    </div>
  ),
});

type BarangOption = { BARANG_ID: number; JENIS_BARANG: string };

type Row = {
  SEQ_ID: number;
  JENIS_BARANG: string;
  KODE_BARANG: number;
  KET: string;
  JUMLAH: number;
  SATUAN: string;
  JUMLAH_LABEL: string;
  HARGA: number;
  TANGGAL: string;
  RECEIVED: string;
};

type ApiResp<T> = { success?: boolean; message?: string; data?: T };

const fmtIdr = (v?: number) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(Number(v || 0));

const isoToday = () => new Date().toISOString().slice(0, 10);
const isoMonthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const isoToDMY = (iso: string) => {
  if (!iso.includes("-")) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

export default function BarangLaporanPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [options, setOptions] = useState<BarangOption[]>([]);
  const [barangId, setBarangId] = useState<string>("0");
  const [startIso, setStartIso] = useState(() => isoMonthStart());
  const [endIso, setEndIso] = useState(() => isoToday());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const columns = useMemo(
    () => [
      { data: null, title: "No", render: (_: any, __: any, ___: any, meta: any) => meta.row + 1 },
      { data: "JENIS_BARANG", title: "Jenis Barang" },
      { data: "KET", title: "Keterangan", width: "140px" },
      {
        data: "JUMLAH_LABEL",
        title: "Jumlah",
      },
      {
        data: "HARGA",
        title: "Nilai",
        render: (d: any) => `Rp ${fmtIdr(Number(d || 0))}`,
        className: "dt-body-right",
      },
      { data: "TANGGAL", title: "Tanggal", width: "110px" },
      { data: "RECEIVED", title: "Penerima" },
    ],
    []
  );

  const fetchOptions = async () => {
    try {
      const res = await fetch("/api/barang/options");
      const json = (await res.json().catch(() => ({}))) as ApiResp<BarangOption[]>;
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat master barang");
      setOptions(Array.isArray(json.data) ? json.data : []);
    } catch (e: any) {
      setOptions([]);
    }
  };

  const fetchRows = async () => {
    const start = isoToDMY(startIso);
    const end = isoToDMY(endIso);
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/barang/laporan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end, barang: Number(barangId) }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResp<Row[]>;
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat data");
      const data = Array.isArray(json.data) ? json.data : [];
      setRows(data);
      if (!data.length) setMessage("Tidak ada data untuk rentang ini.");
    } catch (e: any) {
      setError(e?.message || "Gagal memuat data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOptions();
    void fetchRows();
  }, []);

  const clearFilters = () => {
    setBarangId("0");
    const s = isoMonthStart();
    const e = isoToday();
    setStartIso(s);
    setEndIso(e);
    setRows([]);
    setMessage(null);
    setError(null);
  };

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-14 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[-25%] h-[820px] w-[820px] rounded-full bg-cyan-500/12 blur-[200px]" />
        <div className="absolute right-[8%] bottom-[-20%] h-[780px] w-[780px] rounded-full bg-fuchsia-600/10 blur-[180px]" />
      </div>

      <SettingPageHeader
        lead="Barang"
        title="Laporan Barang Masuk / Keluar"
        description="Gabungan transaksi masuk & keluar dalam rentang tanggal."
      />

      <section className="rounded-3xl border border-cyan-900/60 bg-[#05070d]/70 p-5 shadow-[0_0_32px_#00ffff22] backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePopup
            start={startIso}
            end={endIso}
            onChange={(s, e) => {
              setStartIso(s);
              setEndIso(e);
            }}
            months={2}
            minWidth={640}
          />
          <span className="inline-flex items-center gap-2 rounded-lg border border-cyan-700/40 bg-white/5 px-3 py-2 text-xs text-cyan-200/80">
            <CalendarRange className="h-4 w-4" /> {isoToDMY(startIso)} s/d {isoToDMY(endIso)}
          </span>

          <TypeableSelect
            value={barangId}
            onChange={(e) => setBarangId(e.target.value)}
            className="rounded-xl border border-cyan-800/60 bg-[#0c1224] px-3 py-2 text-sm text-cyan-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
          >
            <option value="0">Semua Barang</option>
            {options.map((o) => (
              <option key={o.BARANG_ID} value={o.BARANG_ID}>
                {o.BARANG_ID}. {o.JENIS_BARANG}
              </option>
            ))}
          </TypeableSelect>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchRows()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-white/5 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-white/10"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>
            <button
              type="button"
              onClick={() => void fetchRows()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-60"
            >
              <RefreshCcw className="h-4 w-4" />
              Reload
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-50">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-50">
            {message}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-3xl border border-cyan-900/60 bg-[#05070f]/70 shadow-[0_0_32px_#00ffff22] backdrop-blur-xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-900/50 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">Laporan Barang</p>
            <h2 className="text-lg font-semibold text-cyan-100">Daftar Transaksi</h2>
          </div>
          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
            Total: {rows.length}
          </span>
        </header>
        <div className="p-4">
          <DataShell loading={loading} hasData={rows.length > 0}>
            <JQDataTable
              id="dt-barang-laporan"
              data={rows as any[]}
              columns={columns as any[]}
              minWidth={1100}
              pageLength={25}
              options={{
                columnDefs: [{ className: "dt-left", targets: "_all" }],
                order: [[5, "desc"]],
              }}
            />
          </DataShell>
        </div>
      </section>
    </div>
  );
}

