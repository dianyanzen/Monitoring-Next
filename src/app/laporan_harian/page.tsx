"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Loader2, RefreshCcw, Search, Trash2 } from "lucide-react";
import { useSession } from "@/contexts/session";
import { DataShell } from "@/components/ui/LoadingOverlay";

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => (
    <div className="px-4 py-5 text-sm text-cyan-100/70">
      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
      Menyiapkan tabel...
    </div>
  ),
});

type ApiData = {
  startDate: string;
  endDate: string;
  rekapPelayanan: { NO: number; DESCRIP: string; VAL: number }[];
  cetakPerWilayah: { NO_WIL: number; NAMA_WIL: string; JML: number }[];
  cetakPerPetugas: { KODE_WIL: number; USER_ID: string; NAMA_LGKP: string; JML: number }[];
  rekamPerPetugas: { KODE_WIL: number; USER_ID: string; NAMA_LGKP: string; JML: number }[];
  tunggakanPerWilayah: {
    USER_ID: string;
    NAMA_LGKP: string;
    NAMA_KANTOR: string;
    NIK: string;
    PENGAJUAN_S: string;
    PINDAHAN_S: string;
    PRR_S: string;
  }[];
  hasilPelayanan: {
    NO_WIL: number;
    NAMA_WIL: string;
    REKAM: number;
    CETAK: number;
    IKD: number;
    AKTE_17: number;
    KIA: number;
    JUMLAH: number;
  }[];
};

const toDMY = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};
const todayDMY = toDMY(new Date());

const formatDateInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const parts: string[] = [];
  if (digits.length >= 2) {
    parts.push(digits.slice(0, 2));
    if (digits.length >= 4) {
      parts.push(digits.slice(2, 4));
      if (digits.length > 4) parts.push(digits.slice(4));
    } else if (digits.length > 2) {
      parts.push(digits.slice(2));
    }
  } else if (digits.length > 0) {
    parts.push(digits);
  }
  return parts.join("-");
};

const formatNumber = (v: unknown) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("id-ID");
};

const sectionCardClass =
  "rounded-2xl border border-cyan-800/25 bg-white/90 px-4 py-3 shadow-[0_10px_35px_rgba(12,23,50,0.12)] backdrop-blur dark:border-cyan-800/40 dark:bg-[#0d1525]/80 dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)]";

type SectionKey =
  | "rekapPelayanan"
  | "cetakPerWilayah"
  | "cetakPerPetugas"
  | "rekamPerPetugas"
  | "tunggakanPerWilayah"
  | "hasilPelayanan";

type Section = {
  key: SectionKey;
  title: string;
  description: string;
  columns: { key: string; label: string; align?: "left" | "center" | "right" }[];
};

type SectionState = {
  loading: boolean;
  loaded: boolean;
  error: string | null;
  data: any[];
};

const toDtColumns = (cols: Section["columns"]) =>
  cols.map((c) => ({
    data: c.key,
    title: c.label,
    className:
      c.align === "right" ? "dt-body-right" : c.align === "center" ? "dt-body-center" : "dt-body-left",
    render: (val: any) => (typeof val === "number" ? formatNumber(val) : val ?? "-"),
  }));

export default function LaporanHarianPage() {
  useSession(); // memastikan konteks sesi aktif

  const [startDate, setStartDate] = useState<string>(todayDMY);
  const [endDate, setEndDate] = useState<string>(todayDMY);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [sectionsState, setSectionsState] = useState<Record<SectionKey, SectionState>>({
    rekapPelayanan: { loading: false, loaded: false, error: null, data: [] },
    cetakPerWilayah: { loading: false, loaded: false, error: null, data: [] },
    cetakPerPetugas: { loading: false, loaded: false, error: null, data: [] },
    rekamPerPetugas: { loading: false, loaded: false, error: null, data: [] },
    tunggakanPerWilayah: { loading: false, loaded: false, error: null, data: [] },
    hasilPelayanan: { loading: false, loaded: false, error: null, data: [] },
  });

  const sections: Section[] = useMemo(
    () => [
      {
        key: "rekapPelayanan",
        title: "Rekapitulasi Pelayanan",
        description: "Akumulasi indikator pelayanan harian.",
        columns: [
          { key: "NO", label: "No", align: "center" },
          { key: "DESCRIP", label: "Deskripsi" },
          { key: "VAL", label: "Jumlah", align: "right" },
        ],
      },
      {
        key: "cetakPerWilayah",
        title: "Cetak KTP-el per Wilayah",
        description: "Rekap pencetakan per wilayah (DB5CETAK).",
        columns: [
          { key: "NO_WIL", label: "Kode Wil", align: "center" },
          { key: "NAMA_WIL", label: "Wilayah" },
          { key: "JML", label: "Jumlah Cetak", align: "right" },
        ],
      },
      {
        key: "cetakPerPetugas",
        title: "Cetak KTP-el per Petugas",
        description: "Rekap pencetakan berdasar petugas (kategori 2).",
        columns: [
          { key: "KODE_WIL", label: "Kode Wil", align: "center" },
          { key: "USER_ID", label: "User ID" },
          { key: "NAMA_LGKP", label: "Nama Petugas" },
          { key: "JML", label: "Jumlah Cetak", align: "right" },
        ],
      },
      {
        key: "rekamPerPetugas",
        title: "Perekaman KTP-el per Petugas",
        description: "Jumlah perekaman by user (FINGERS@DB5).",
        columns: [
          { key: "KODE_WIL", label: "Kode Wil", align: "center" },
          { key: "USER_ID", label: "User ID" },
          { key: "NAMA_LGKP", label: "Nama" },
          { key: "JML", label: "Jumlah Rekam", align: "right" },
        ],
      },
      {
        key: "tunggakanPerWilayah",
        title: "Tunggakan KTP-el per Wilayah",
        description: "Daftar pending PRR / pengajuan / pindahan.",
        columns: [
          { key: "USER_ID", label: "User ID" },
          { key: "NAMA_LGKP", label: "Nama" },
          { key: "NAMA_KANTOR", label: "Kantor" },
          { key: "NIK", label: "NIK" },
          { key: "PENGAJUAN_S", label: "Pengajuan" },
          { key: "PINDAHAN_S", label: "Pindahan" },
          { key: "PRR_S", label: "PRR" },
        ],
      },
      {
        key: "hasilPelayanan",
        title: "Hasil Pelayanan Harian",
        description: "Ringkasan rekam/cetak/IKD/KIA per wilayah.",
        columns: [
          { key: "NO_WIL", label: "Kode Wil", align: "center" },
          { key: "NAMA_WIL", label: "Wilayah" },
          { key: "REKAM", label: "Rekam", align: "right" },
          { key: "CETAK", label: "Cetak", align: "right" },
          { key: "IKD", label: "IKD", align: "right" },
          { key: "AKTE_17", label: "Akte 17", align: "right" },
          { key: "KIA", label: "KIA", align: "right" },
          { key: "JUMLAH", label: "Total", align: "right" },
        ],
      },
    ],
    []
  );

  const setSectionState = useCallback(
    (key: keyof ApiData, partial: Partial<SectionState>) => {
      setSectionsState((prev) => ({
        ...prev,
        [key]: { ...prev[key], ...partial },
      }));
    },
    []
  );

  const fetchSection = useCallback(
    async (key: keyof ApiData, payload: { startDate: string; endDate: string }) => {
      setSectionState(key, { loading: true, error: null });
      try {
        const res = await fetch(`/api/laporan/harian?part=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat data");
        const rows = Array.isArray(json?.data?.[key]) ? (json.data[key] as any[]) : [];
        setSectionState(key, { data: rows, loading: false, loaded: true, error: null });
      } catch (e: any) {
        const msg = e?.message || "Gagal memuat data";
        setSectionState(key, { error: msg, loading: false, loaded: true, data: [] });
      }
    },
    [setSectionState]
  );

  const loadAll = useCallback(
    (mode: "search" | "reload" = "search") => {
      const payload = { startDate: startDate.trim(), endDate: endDate.trim() };
      if (!payload.startDate || !payload.endDate) {
        setGlobalError("Tanggal awal dan akhir wajib diisi (DD-MM-YYYY).");
        return;
      }
      setGlobalError(null);
      setReloading(mode === "reload");

      setSectionsState((prev) => {
        const next = { ...prev };
        sections.forEach((sec) => {
          next[sec.key] = {
            loading: true,
            loaded: mode === "reload" ? prev[sec.key].loaded : false,
            error: null,
            data: mode === "reload" ? prev[sec.key].data : [],
          };
        });
        return next;
      });

      sections.forEach((sec) => {
        void fetchSection(sec.key, payload);
      });
    },
    [endDate, fetchSection, sections, startDate]
  );

  useEffect(() => {
    void loadAll("search");
  }, [loadAll]);

  useEffect(() => {
    const anyLoading = Object.values(sectionsState).some((s) => s.loading);
    if (!anyLoading) setReloading(false);
  }, [sectionsState]);

  const handleReset = () => {
    setStartDate(todayDMY);
    setEndDate(todayDMY);
    setGlobalError(null);
    setSectionsState((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        const key = k as keyof ApiData;
        next[key] = { loading: false, loaded: false, error: null, data: [] };
      });
      return next;
    });
  };

  const isBusy = Object.values(sectionsState).some((s) => s.loading) || reloading;
  const totalLoaded = sections.filter((sec) => sectionsState[sec.key]?.loaded).length;

  return (
    <div className="relative mt-12 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div
        className={`${sectionCardClass} flex flex-col gap-3 md:flex-row md:items-center md:justify-between dark:text-gray-100`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-cyan-700 dark:text-cyan-300/80">
            <Calendar className="h-4 w-4" />
            Laporan Harian
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Monitoring Harian</h1>
          <p className="text-sm text-slate-600 dark:text-gray-300/80">
            Gunakan tanggal awal & akhir (DD-MM-YYYY).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-gray-400">
          {reloading && (
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-3 py-1 text-cyan-900 dark:text-cyan-100">
              <Loader2 className="h-4 w-4 animate-spin" />
              Refreshing
            </span>
          )}
          {globalError && <span className="rounded-full bg-red-100 px-3 py-1 text-red-700 dark:bg-red-500/10 dark:text-red-200">{globalError}</span>}
          <span className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-800 dark:bg-cyan-500/5 dark:text-cyan-200/80">
            Loaded {totalLoaded}/{sections.length}
          </span>
        </div>
      </div>

      <div className={`${sectionCardClass} md:flex-row md:items-end`}>
        <div className="flex-1">
          <label className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200/80">Tanggal Awal</label>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-cyan-700/40 bg-white/70 px-3 py-2 dark:bg-white/5">
            <Calendar className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
            <input
              type="text"
              value={startDate}
              onChange={(e) => setStartDate(formatDateInput(e.target.value))}
              placeholder="DD-MM-YYYY"
              className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500 dark:text-white"
            />
          </div>
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200/80">Tanggal Akhir</label>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-cyan-700/40 bg-white/70 px-3 py-2 dark:bg-white/5">
            <Calendar className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
            <input
              type="text"
              value={endDate}
              onChange={(e) => setEndDate(formatDateInput(e.target.value))}
              placeholder="DD-MM-YYYY"
              className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500 dark:text-white"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadAll("search")}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-900 hover:bg-cyan-500/25 disabled:opacity-50 dark:text-cyan-100"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
          <button
            type="button"
            onClick={() => loadAll("reload")}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-100"
          >
            <RefreshCcw className="h-4 w-4" />
            Reload
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-400/60 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600/60 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
          >
            <Trash2 className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {sections.map((section) => {
          const state = sectionsState[section.key];
          const rows = state?.data ?? [];
          const hasData = rows && rows.length > 0;
          const columns = toDtColumns(section.columns);
          return (
            <div key={section.key} className={sectionCardClass}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{section.title}</h2>
                  <p className="text-xs text-slate-600 dark:text-gray-400">{section.description}</p>
                </div>
                {state.loading && <Loader2 className="h-5 w-5 animate-spin text-cyan-300" aria-label="loading" />}
              </div>
              <DataShell
                loading={state.loading}
                hasData={hasData || !!state.error}
                emptyHint={<div className="px-6 py-5 text-sm text-amber-200/80">Belum ada data untuk tabel ini.</div>}
              >
                {state.error ? (
                  <div className="px-4 py-5 text-sm text-red-200">{state.error}</div>
                ) : (
                  hasData && (
                    <JQDataTable
                      id={`dt-${section.key}`}
                      data={rows}
                      minWidth={900}
                      columns={columns as any}
                      tableClassName="dt-cyberpunk"
                    />
                  )
                )}
              </DataShell>
            </div>
          );
        })}
      </div>
    </div>
  );
}
