// FILE: src/app/laporan/cetak/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/contexts/session";
import { BarChart3, Loader2, RefreshCcw, Search, Trash2 } from "lucide-react";
import SelectDark from "@/components/ui/SelectDark";
import { LoadingBlank } from "@/components/ui/LoadingOverlay";

type LaporanCetakRow = {
  noWil: number;
  namaWil: string;
  tanggal: string;
  jumlah: number;
};

type LaporanCetakMeta = {
  title: string;
  subTitle: string;
  typeTgl: "Pencetakan";
  noWilLabel: string;
  kodeWilLabel: string;
  startDate: string;
  endDate: string;
  labelTanggal: string;
  filter: { noKec: number; noKel: number };
  total: number;
};

type LaporanCetakResponse = {
  meta: LaporanCetakMeta;
  rows: LaporanCetakRow[];
};

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => <LoadingBlank message="Menyiapkan tabel" subtext="harap tunggu" />,
});

type WilayahOption = { value: string; label: string };
type WilayahMetaState = {
  akses: { aksesKecamatan: number; aksesKelurahan: number };
  defaults: { noProp: string; noKab: string; noKec: string; noKel: string };
  wilayah: { kecamatan: WilayahOption[]; kelurahan: WilayahOption[] };
};
type WilayahMetaResponse = {
  success?: boolean;
  message?: string;
  data?: {
    akses?: { aksesKecamatan?: number; aksesKelurahan?: number };
    defaults?: { noProp?: string; noKab?: string; noKec?: string; noKel?: string };
    wilayah?: { kecamatan?: WilayahOption[]; kelurahan?: WilayahOption[] };
  };
} & Partial<WilayahMetaState>;

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

const convertWilayahCode = (raw?: string | null) => {
  const val = (raw ?? "").trim();
  if (!val) return "0";
  const digits = val.replace(/[^\d]/g, "");
  if (!digits || digits === "0" || digits === "000") return "0";
  const normalized = Number(digits);
  return Number.isNaN(normalized) ? digits : String(normalized);
};

const mergeOptions = (options: WilayahOption[], includeDefault: boolean, defaultLabel: string) => {
  const merged: WilayahOption[] = [];
  const seen = new Set<string>();
  if (includeDefault) {
    merged.push({ value: "0", label: defaultLabel });
    seen.add("0");
  }
  for (const opt of options) {
    const value = (opt.value ?? "").trim() || "0";
    if (!seen.has(value)) {
      merged.push({ value, label: opt.label });
      seen.add(value);
    }
  }
  return merged;
};

const toNumber = (value: number | string | null | undefined) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export default function LaporanCetakPage() {
  const { user } = useSession();

  const [startDate, setStartDate] = useState(todayDMY);
  const [endDate, setEndDate] = useState(todayDMY);
  const [noKec, setNoKec] = useState<string>("0");
  const [noKel, setNoKel] = useState<string>("0");
  const [wilayahMeta, setWilayahMeta] = useState<WilayahMetaState | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [kecamatanOptions, setKecamatanOptions] = useState<WilayahOption[]>([]);
  const [kelurahanCache, setKelurahanCache] = useState<Record<string, WilayahOption[]>>({});
  const [kelurahanLoadingKey, setKelurahanLoadingKey] = useState<string | null>(null);
  const [wilayahInitialized, setWilayahInitialized] = useState(false);
  const initialFetchDoneRef = useRef(false);

  const [data, setData] = useState<LaporanCetakRow[]>([]);
  const [meta, setMeta] = useState<LaporanCetakMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<{
    startDate: string;
    endDate: string;
    noKec: string;
    noKel: string;
  } | null>(null);

  const defaultNoKec = useMemo(() => convertWilayahCode(wilayahMeta?.defaults?.noKec), [wilayahMeta]);
  const defaultNoKel = useMemo(() => convertWilayahCode(wilayahMeta?.defaults?.noKel), [wilayahMeta]);
  const allowSelectKecamatan = useMemo(() => {
    if (!wilayahMeta) return true;
    const def = convertWilayahCode(wilayahMeta.defaults.noKec);
    return def === "0" || wilayahMeta.akses.aksesKecamatan > 0;
  }, [wilayahMeta]);
  const allowSelectKelurahan = useMemo(() => {
    if (!wilayahMeta) return true;
    const def = convertWilayahCode(wilayahMeta.defaults.noKel);
    return def === "0" || wilayahMeta.akses.aksesKelurahan > 0;
  }, [wilayahMeta]);
  const currentKelOptions = useMemo(() => kelurahanCache[noKec] ?? [], [kelurahanCache, noKec]);
  const kecOptions = useMemo(
    () => mergeOptions(kecamatanOptions, true, "-- Pilih Kecamatan --"),
    [kecamatanOptions]
  );
  const kelOptions = useMemo(
    () => mergeOptions(currentKelOptions, true, "-- Pilih Kelurahan --"),
    [currentKelOptions]
  );

  const buildPayload = useCallback(
    () => ({
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      noKec: noKec.trim(),
      noKel: noKel.trim(),
    }),
    [startDate, endDate, noKec, noKel]
  );

  const fetchData = useCallback(
    async (mode: "search" | "reload") => {
      const isReload = mode === "reload";
      if (isReload && !lastPayload) return;

      const payload = isReload ? lastPayload! : buildPayload();
      if (!payload.startDate || !payload.endDate) {
        setError("Tanggal awal dan akhir wajib diisi dalam format DD-MM-YYYY.");
        return;
      }

      const parseNum = (v: string) => {
        const clean = v.replace(/\D/g, "");
        if (!clean) return 0;
        const n = Number(clean);
        return Number.isFinite(n) ? n : 0;
      };

      const body = {
        startDate: payload.startDate,
        endDate: payload.endDate,
        noKec: parseNum(payload.noKec),
        noKel: parseNum(payload.noKel),
      };

      if (mode === "search") {
        setLoading(true);
        setError(null);
      } else {
        setReloading(true);
        setError(null);
      }

      try {
        const res = await fetch("/api/laporan/cetak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => ({}))) as
          | { success?: boolean; message?: string; data?: LaporanCetakResponse }
          | LaporanCetakResponse;

        if (!res.ok) {
          const msg =
            (json as any)?.message ||
            (typeof (json as any) === "string" ? (json as any) : null) ||
            "Gagal memuat laporan pencetakan.";
          throw new Error(msg);
        }

        const payloadData =
          (json as any).meta && (json as any).rows
            ? (json as LaporanCetakResponse)
            : ((json as any).data as LaporanCetakResponse);

        if (!payloadData?.meta) throw new Error("Struktur respons laporan tidak sesuai.");

        setData(payloadData.rows || []);
        setMeta(payloadData.meta);
        setError(null);
        if (mode === "search") setLastPayload({ ...payload });
      } catch (e: any) {
        setError(e?.message || "Gagal memuat laporan pencetakan.");
        setData([]);
        setMeta(null);
      } finally {
        setLoading(false);
        setReloading(false);
      }
    },
    [buildPayload, lastPayload]
  );

  const loadKelurahanOptions = useCallback(
    async (kec: string) => {
      const nextKec = kec.trim();
      if (!nextKec || nextKec === "0" || kelurahanCache[nextKec]) return;

      setKelurahanLoadingKey(nextKec);
      try {
        const params = new URLSearchParams({ no_kec: nextKec });
        if (wilayahMeta?.defaults?.noProp) params.set("no_prop", wilayahMeta.defaults.noProp);
        if (wilayahMeta?.defaults?.noKab) params.set("no_kab", wilayahMeta.defaults.noKab);
        const res = await fetch(`/api/check/ktpel/kelurahan?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || "Gagal memuat kelurahan");
        const list: WilayahOption[] = json?.data?.kelurahan ?? json?.kelurahan ?? [];
        setKelurahanCache((prev) => ({ ...prev, [nextKec]: list }));
      } catch (error) {
        console.error("Gagal memuat kelurahan:", error);
      } finally {
        setKelurahanLoadingKey((prev) => (prev === nextKec ? null : prev));
      }
    },
    [kelurahanCache, wilayahMeta]
  );

  const handleKecamatanChange = useCallback(
    (value: string) => {
      setNoKec(value);
      setNoKel("0");
      void loadKelurahanOptions(value);
    },
    [loadKelurahanOptions]
  );

  const handleSearch = () => void fetchData("search");
  const handleReload = () => void fetchData("reload");

  const handleClear = () => {
    const nextNoKec = defaultNoKec || "0";
    const nextNoKel = nextNoKec === "0" ? "0" : defaultNoKel || "0";
    setStartDate(todayDMY);
    setEndDate(todayDMY);
    setNoKec(nextNoKec);
    setNoKel(nextNoKel);
    if (nextNoKec !== "0") void loadKelurahanOptions(nextNoKec);
    setData([]);
    setMeta(null);
    setError(null);
    setLastPayload(null);
  };

  useEffect(() => {
    let cancelled = false;
    setMetaLoading(true);
    setMetaError(null);

    (async () => {
      try {
        const res = await fetch("/api/check/ktpel/meta", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as WilayahMetaResponse;
        if (cancelled) return;

        const source = (payload?.data as any) ?? payload;
        if (!source || !source.defaults || !source.wilayah) {
          throw new Error(payload?.message || "Metadata wilayah tidak tersedia.");
        }
        const akses = source?.akses ?? {};
        const defaults = source?.defaults ?? {};
        const wilayah = source?.wilayah ?? {};

        const normalized: WilayahMetaState = {
          akses: {
            aksesKecamatan: Number(akses.aksesKecamatan ?? 0),
            aksesKelurahan: Number(akses.aksesKelurahan ?? 0),
          },
          defaults: {
            noProp: defaults.noProp ?? "",
            noKab: defaults.noKab ?? "",
            noKec: defaults.noKec ?? "0",
            noKel: defaults.noKel ?? "0",
          },
          wilayah: {
            kecamatan: Array.isArray(wilayah.kecamatan) ? wilayah.kecamatan : [],
            kelurahan: Array.isArray(wilayah.kelurahan) ? wilayah.kelurahan : [],
          },
        };

        const nextNoKec = convertWilayahCode(normalized.defaults.noKec);
        const nextNoKel = convertWilayahCode(normalized.defaults.noKel);

        setWilayahMeta(normalized);
        setKecamatanOptions(normalized.wilayah.kecamatan);
        if (nextNoKec !== "0" && normalized.wilayah.kelurahan.length > 0) {
          setKelurahanCache((prev) => ({ ...prev, [nextNoKec]: normalized.wilayah.kelurahan }));
        }
        setNoKec(nextNoKec);
        setNoKel(nextNoKec === "0" ? "0" : nextNoKel);
        setMetaError(null);
      } catch (err: any) {
        if (!cancelled) {
          setMetaError(err?.message || "Gagal memuat metadata wilayah.");
          setWilayahMeta(null);
        }
      } finally {
        if (!cancelled) {
          setMetaLoading(false);
          setWilayahInitialized(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!wilayahInitialized || initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;
    void fetchData("search");
  }, [wilayahInitialized, fetchData]);

  const total = meta?.total ?? data.reduce((sum, row) => sum + (row.jumlah || 0), 0);

  const columns = useMemo(() => {
    const noWilLabel = meta?.noWilLabel ?? "No Wil";
    const kodeWilLabel = meta?.kodeWilLabel ?? "Nama Wilayah";
    return [
      {
        data: null,
        title: "No",
        className: "dt-body-center",
        width: "60px",
        orderable: false,
        render: (_: any, __: any, ___: any, metaTable: any) => metaTable.row + 1,
      },
      { data: (row: LaporanCetakRow) => row.noWil, title: noWilLabel, className: "dt-body-right", width: "100px" },
      { data: (row: LaporanCetakRow) => row.namaWil, title: kodeWilLabel, width: "260px" },
      { data: (row: LaporanCetakRow) => row.tanggal, title: "Tanggal", className: "dt-body-center", width: "160px" },
      {
        data: (row: LaporanCetakRow) => row.jumlah,
        title: "Jumlah",
        className: "dt-body-right",
        width: "140px",
        render: (val: any) => toNumber(val).toLocaleString("id-ID"),
      },
    ];
  }, [meta?.kodeWilLabel, meta?.noWilLabel]);

  const tableKey = useMemo(
    () => `${meta?.noWilLabel ?? "No Wil"}-${meta?.kodeWilLabel ?? "Nama Wilayah"}`,
    [meta?.kodeWilLabel, meta?.noWilLabel]
  );

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-10 pt-6 text-gray-100 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-[-15%] h-[1100px] w-[1100px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[18%] bottom-[-20%] h-[1000px] w-[1000px] rounded-full bg-fuchsia-600/12 blur-[190px]" />
      </div>

      <section className="w-full rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500/80 dark:text-slate-400/70">
            Laporan SIAK – Modul Cetak KTP-el
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              <h1 className="text-base font-semibold tracking-wide text-cyan-200">Laporan Pencetakan KTP-el</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">
                <BarChart3 className="h-3.5 w-3.5" />
                Modul Cetak KTP-el
              </span>
              <div className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
                User: {(user as any)?.S_NAMA_LGKP ?? (user as any)?.S_USER_ID ?? "-"}
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Rekap jumlah pencetakan KTP-el berdasarkan data CARD_MANAGEMENT dalam rentang tanggal tertentu.
          </p>
        </header>

        <div className="space-y-6 p-6">
          <section className="rounded-2xl border border-cyan-900/60 bg-[#05070f]/70 p-4 shadow-[0_0_24px_#00ffff22]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                  Tanggal Cetak (Awal)
                </label>
                <input
                  value={startDate}
                  onChange={(e) => setStartDate(formatDateInput(e.target.value))}
                  placeholder="DD-MM-YYYY"
                  className="mt-1 w-full rounded-xl border border-cyan-800/60 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
                <p className="text-[11px] text-cyan-200/70">Format: DD-MM-YYYY</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                  Tanggal Cetak (Akhir)
                </label>
                <input
                  value={endDate}
                  onChange={(e) => setEndDate(formatDateInput(e.target.value))}
                  placeholder="DD-MM-YYYY"
                  className="mt-1 w-full rounded-xl border border-cyan-800/60 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                />
                <p className="text-[11px] text-cyan-200/70">Format: DD-MM-YYYY</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Kecamatan</label>
                <SelectDark
                  value={noKec}
                  onChange={(e) => void handleKecamatanChange(e.target.value)}
                  disabled={!allowSelectKecamatan || metaLoading}
                  className="mt-1"
                >
                  {kecOptions.map((opt) => (
                    <option key={`kec-${opt.value}`} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </SelectDark>
                <p className="text-[11px] text-cyan-200/70">
                  {allowSelectKecamatan
                    ? "Pilih kecamatan atau gunakan nilai 0 untuk seluruh kecamatan."
                    : "Akses kecamatan dibatasi sesuai level akun."}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Kelurahan</label>
                <SelectDark
                  value={noKel}
                  onChange={(e) => setNoKel(e.target.value || "0")}
                  disabled={
                    noKec === "0" ||
                    !allowSelectKelurahan ||
                    metaLoading ||
                    kelurahanLoadingKey === noKec
                  }
                  className="mt-1"
                >
                  {kelOptions.map((opt) => (
                    <option key={`kel-${opt.value}`} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </SelectDark>
                <p className="text-[11px] text-cyan-200/70">
                  {noKec === "0"
                    ? "Kelurahan dapat dipilih setelah menentukan kecamatan."
                    : "Gunakan nilai 0 untuk seluruh kelurahan di kecamatan tersebut."}
                </p>
                {kelurahanLoadingKey === noKec && (
                  <p className="text-[11px] text-cyan-200/70">Memuat daftar kelurahan...</p>
                )}
              </div>
            </div>

            {metaError && (
              <div className="mt-4 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                {metaError}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/60 bg-cyan-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100 shadow-[0_6px_16px_rgba(0,255,255,0.12)] transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Cari / Generate
                </button>

                <button
                  type="button"
                  onClick={handleReload}
                  disabled={reloading || !lastPayload}
                  className="inline-flex items-center gap-2 rounded-2xl border border-sky-500/60 bg-sky-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  Reload
                </button>

                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-2 rounded-2xl border border-cyan-800/60 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100 transition hover:bg-white/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </button>
              </div>

              {meta && (
                <div className="sm:ml-auto">
                  <div className="flex flex-col items-start text-[11px] text-cyan-200/80 sm:items-end">
                    <span className="font-semibold tracking-wide">
                      Total: {total.toLocaleString("id-ID")} pencetakan
                    </span>
                    <span>
                      Rentang: {meta.labelTanggal}
                      {meta.filter.noKec ? ` • NO_KEC ${meta.filter.noKec}` : " • Semua Kec"}
                      {meta.filter.noKec &&
                        (meta.filter.noKel ? ` • NO_KEL ${meta.filter.noKel}` : " • Semua Kel")}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                {error}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-cyan-900/60 bg-[#050816]/80 p-4 shadow-[0_0_30px_#00ffff22] sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-cyan-300" />
                <div>
                  <p className="text-sm font-semibold text-cyan-50">
                    {meta?.subTitle || "Laporan Pencetakan KTP-el"}
                  </p>
                  <p className="text-xs text-slate-300">
                    Dinas Kependudukan dan Pencatatan Sipil Kota Bandung
                  </p>
                </div>
              </div>
              {data.length > 0 && (
                <p className="text-[11px] text-cyan-200/70">
                  Menampilkan {data.length.toLocaleString("id-ID")} baris • Total {total.toLocaleString("id-ID")} pencetakan
                </p>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-cyan-900/60 bg-[#020617]/80 p-2">
              <JQDataTable
                key={tableKey}
                id="dt-laporan-cetak"
                data={data as any[]}
                columns={columns as any}
                minWidth={900}
                pageLength={50}
                tableClassName="dt-cyberpunk"
                options={{
                  deferRender: true,
                  autoWidth: false,
                  scrollX: true,
                  stripeClasses: [],
                  dom: "<'dt-top-bar flex items-center justify-between gap-3'<'dt-left flex items-center gap-2'Bl><'dt-right ml-auto'f>>rt<'dt-bottom-bar flex items-center justify-between gap-3'<'dt-info'i><'dt-paging'p>>",
                  language: {
                    search: "",
                    searchPlaceholder: "Search...",
                    lengthMenu: "Tampilkan _MENU_ data",
                    info: "Menampilkan _START_-_END_ dari _TOTAL_ data",
                    infoEmpty: "Menampilkan 0 data",
                    emptyTable: "Belum ada data untuk filter yang dipilih.",
                    zeroRecords: "Tidak ada data yang sesuai",
                    paginate: { previous: "<", next: ">" },
                  },
                  buttons: [
                    { extend: "copy", text: "Copy" },
                    { extend: "csvHtml5", text: "CSV", bom: true },
                    { extend: "excelHtml5", text: "Excel" },
                    { extend: "print", text: "Print" },
                  ],
                  order: [[1, "asc"]],
                  footerCallback: function (_row: any, dataRows: any[]) {
                    const api = this.api();
                    const rowsData =
                      typeof api?.rows === "function"
                        ? api.rows({ search: "applied" }).data().toArray()
                        : Array.isArray(dataRows)
                          ? dataRows
                          : [];
                    const totalJumlah = rowsData.reduce(
                      (sum: number, row: any) => sum + toNumber(row?.jumlah),
                      0
                    );
                    const html = `
                      <tr>
                        <th colspan="4" style="text-align:center;font-weight:600;">Jumlah</th>
                        <th style="text-align:right;font-weight:600;">${totalJumlah.toLocaleString("id-ID")}</th>
                      </tr>
                    `;
                    let tfoot = api.table().footer();
                    if (!tfoot) {
                      tfoot = document.createElement("tfoot");
                      (api.table().node() as HTMLElement).appendChild(tfoot);
                    }
                    (tfoot as HTMLElement).innerHTML = html;
                    const scrollFoot = (api.table().node() as HTMLElement)
                      .closest(".dt-scroll")
                      ?.querySelector(".dt-scroll-foot tfoot");
                    if (scrollFoot) (scrollFoot as HTMLElement).innerHTML = html;
                  },
                }}
              />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
