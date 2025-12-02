"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/contexts/session";
import { BarChart3, Calendar, Loader2, RefreshCcw, Search, Trash2 } from "lucide-react";
import SelectDark from "@/components/ui/SelectDark";
import { LoadingBlank } from "@/components/ui/LoadingOverlay";

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

type ColumnDef = Record<string, any>;

export type ReportPageProps = {
  endpoint: string;
  tableId: string;
  tableKey: string;
  columns: ColumnDef[];
  minWidth?: number;
  order?: any[];
  badgeLabel: string;
  moduleLabel: string;
  headerTitle: string;
  headerSubtitle: string;
  description: string;
  totalLabel: string;
  showKlasifikasi?: boolean;
  klasifikasiOptions?: { value: string; label: string }[];
  extraFilters?: { key: string; label: string; placeholder?: string }[];
};

const toDMY = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};
const todayDMY = toDMY(new Date());

const toISODateValue = (value: string) => {
  const parts = value.split("-");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (dd && mm && yyyy) return `${yyyy}-${mm}-${dd}`;
  }
  return "";
};

const fromISODateValue = (value: string) => {
  if (!value) return "";
  const parts = value.split("-");
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    if (dd && mm && yyyy) return `${dd}-${mm}-${yyyy}`;
  }
  return "";
};

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

const normalizeDigits = (v?: string | number | null) => {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\D/g, "");
};
const toIntOrZero = (v?: string | number | null) => {
  const clean = normalizeDigits(v);
  if (!clean) return 0;
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
};

type PayloadState = {
  startDate: string;
  endDate: string;
  noKec: string;
  noKel: string;
  noKlas: string;
  extras: Record<string, string>;
};

export default function WilayahReportPage({
  endpoint,
  tableId,
  tableKey,
  columns,
  minWidth = 1000,
  order = [],
  badgeLabel,
  moduleLabel,
  headerTitle,
  headerSubtitle,
  description,
  totalLabel,
  showKlasifikasi = false,
  klasifikasiOptions = [
    { value: "0", label: "Semua Klasifikasi" },
    { value: "1", label: "Dalam Kota / Antar Kecamatan" },
    { value: "2", label: "Antar Kab/Kota / Provinsi" },
  ],
  extraFilters = [],
}: ReportPageProps) {
  const { user } = useSession();

  const [startDate, setStartDate] = useState(todayDMY);
  const [endDate, setEndDate] = useState(todayDMY);
  const [noKec, setNoKec] = useState<string>("0");
  const [noKel, setNoKel] = useState<string>("0");
  const [noKlas, setNoKlas] = useState<string>("0");
  const [wilayahMeta, setWilayahMeta] = useState<WilayahMetaState | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [kecamatanOptions, setKecamatanOptions] = useState<WilayahOption[]>([]);
  const [kelurahanCache, setKelurahanCache] = useState<Record<string, WilayahOption[]>>({});
  const [kelurahanLoadingKey, setKelurahanLoadingKey] = useState<string | null>(null);
  const [wilayahInitialized, setWilayahInitialized] = useState(false);
  const initialFetchDoneRef = useRef(false);

  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<PayloadState | null>(null);
  const [extraFilterValues, setExtraFilterValues] = useState<Record<string, string>>({});
  const startPickerRef = useRef<HTMLInputElement | null>(null);
  const endPickerRef = useRef<HTMLInputElement | null>(null);

  const extraFilterKey = useMemo(
    () => extraFilters.map((ef) => ef.key).sort().join("|"),
    [extraFilters]
  );
  const normalizedExtraFilters = useMemo(() => extraFilters, [extraFilterKey]);

  useEffect(() => {
    setExtraFilterValues((prev) => {
      const next: Record<string, string> = {};
      normalizedExtraFilters.forEach((ef) => {
        next[ef.key] = prev[ef.key] ?? "";
      });
      return next;
    });
  }, [extraFilterKey]);

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
    (): PayloadState => ({
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      noKec: noKec.trim(),
      noKel: noKel.trim(),
      noKlas: noKlas.trim(),
      extras: { ...extraFilterValues },
    }),
    [startDate, endDate, noKec, noKel, noKlas, extraFilterValues]
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

      const body: Record<string, number | string> = {
        startDate: payload.startDate,
        endDate: payload.endDate,
        noKec: parseNum(payload.noKec),
        noKel: parseNum(payload.noKel),
      };
      if (showKlasifikasi) body.noKlas = parseNum(payload.noKlas);
      Object.entries(payload.extras || {}).forEach(([key, value]) => {
        if (typeof value === "string" && value.trim()) {
          body[key] = value.trim();
        }
      });

      if (mode === "search") {
        setLoading(true);
        setError(null);
      } else {
        setReloading(true);
        setError(null);
      }

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => ({}))) as
          | { success?: boolean; message?: string; data?: { meta: any; rows: any[] } }
          | { meta: any; rows: any[] };

        if (!res.ok) {
          const msg =
            (json as any)?.message ||
            (typeof (json as any) === "string" ? (json as any) : null) ||
            "Gagal memuat laporan.";
          throw new Error(msg);
        }

        const payloadData =
          (json as any).meta && (json as any).rows
            ? (json as { meta: any; rows: any[] })
            : ((json as any).data as { meta: any; rows: any[] });
        if (!payloadData?.meta) throw new Error("Struktur respons laporan tidak sesuai.");

        setData(payloadData.rows || []);
        setMeta(payloadData.meta);
        setError(null);
        if (mode === "search") setLastPayload({ ...payload, extras: { ...payload.extras } });
      } catch (e: any) {
        setError(e?.message || "Gagal memuat laporan.");
        setData([]);
        setMeta(null);
      } finally {
        setLoading(false);
        setReloading(false);
      }
    },
    [endpoint, buildPayload, lastPayload, showKlasifikasi]
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
    setNoKlas("0");
    setExtraFilterValues((prev) => {
      const cleared: Record<string, string> = {};
      Object.keys(prev).forEach((key) => {
        cleared[key] = "";
      });
      return cleared;
    });
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
        const res = await fetch("/api/check/ktpel/meta", { cache: "no-store", credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as WilayahMetaResponse;
        if (cancelled) return;

        const source = (payload?.data as any) ?? payload;
        if (!source || !source.defaults || !source.wilayah) throw new Error(payload?.message || "Metadata wilayah tidak tersedia.");

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

  const total = meta?.total ?? data.length;
  const tableKeyWithFilter = useMemo(
    () => `${tableKey}-${meta?.filter?.noKec ?? 0}-${meta?.filter?.noKel ?? 0}-${meta?.filter?.noKlas ?? 0}`,
    [tableKey, meta?.filter?.noKec, meta?.filter?.noKel, meta?.filter?.noKlas]
  );

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSearch();
  };

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-10 pt-6 text-slate-50 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-[-15%] h-[1100px] w-[1100px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[18%] bottom-[-20%] h-[1000px] w-[1000px] rounded-full bg-fuchsia-600/12 blur-[190px]" />
      </div>

      <section className="w-full rounded-3xl border border-slate-700/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        <header className="border-b border-slate-600/40 px-5 py-4">
          <div className="text-xs uppercase tracking-[0.32em] text-slate-400">{headerSubtitle}</div>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              <h1 className="text-base font-semibold tracking-wide text-cyan-100">{headerTitle}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">
                <BarChart3 className="h-3.5 w-3.5" />
                {badgeLabel}
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
          <p className="mt-2 text-sm text-slate-400">{description}</p>
        </header>

        <div className="space-y-6 p-6">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-cyan-900/60 bg-[#05070f]/70 p-5 shadow-[0_0_24px_#00ffff22]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  <input type="checkbox" checked readOnly className="h-4 w-4 rounded accent-cyan-500" />
                  Tanggal Activity
                </label>
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      value={startDate}
                      onChange={(e) => setStartDate(formatDateInput(e.target.value))}
                      placeholder="DD-MM-YYYY"
                      className="w-full rounded-2xl border border-cyan-500/30 bg-[#080d1f] px-4 py-2 pr-12 text-sm text-slate-100 outline-none shadow-[0_4px_15px_rgba(0,0,0,0.45)] transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
                    />
                    <button
                      type="button"
                      onClick={() => startPickerRef.current?.showPicker?.()}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-cyan-500/20 p-1 text-cyan-200 hover:bg-cyan-500/30"
                    >
                      <Calendar className="h-4 w-4" />
                    </button>
                    <input
                      type="date"
                      ref={startPickerRef}
                      value={toISODateValue(startDate)}
                      onChange={(e) => setStartDate(fromISODateValue(e.target.value))}
                      className="sr-only"
                    />
                  </div>
                  <div className="relative">
                    <input
                      value={endDate}
                      onChange={(e) => setEndDate(formatDateInput(e.target.value))}
                      placeholder="DD-MM-YYYY"
                      className="w-full rounded-2xl border border-cyan-500/30 bg-[#080d1f] px-4 py-2 pr-12 text-sm text-slate-100 outline-none shadow-[0_4px_15px_rgba(0,0,0,0.45)] transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
                    />
                    <button
                      type="button"
                      onClick={() => endPickerRef.current?.showPicker?.()}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-cyan-500/20 p-1 text-cyan-200 hover:bg-cyan-500/30"
                    >
                      <Calendar className="h-4 w-4" />
                    </button>
                    <input
                      type="date"
                      ref={endPickerRef}
                      value={toISODateValue(endDate)}
                      onChange={(e) => setEndDate(fromISODateValue(e.target.value))}
                      className="sr-only"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  <input type="checkbox" checked readOnly className="h-4 w-4 rounded accent-cyan-500" />
                  Kecamatan
                </label>
                <SelectDark
                  value={noKec}
                  onChange={(e) => void handleKecamatanChange(e.target.value)}
                  disabled={!allowSelectKecamatan || metaLoading}
                >
                  {kecOptions.map((opt) => (
                    <option key={`kec-${opt.value}`} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </SelectDark>
              </div>

              <div className="space-y-1.5">
                <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  <input type="checkbox" checked readOnly className="h-4 w-4 rounded accent-cyan-500" />
                  Kelurahan
                </label>
                <SelectDark
                  value={noKel}
                  onChange={(e) => setNoKel(e.target.value || "0")}
                  disabled={
                    noKec === "0" ||
                    !allowSelectKelurahan ||
                    metaLoading ||
                    kelurahanLoadingKey === noKec
                  }
                >
                  {kelOptions.map((opt) => (
                    <option key={`kel-${opt.value}`} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </SelectDark>
                {kelurahanLoadingKey === noKec && (
                  <p className="text-[11px] text-cyan-200/70">Memuat daftar kelurahan...</p>
                )}
              </div>

              {showKlasifikasi && (
                <div className="space-y-1.5 sm:col-span-2 xl:col-span-1">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                    <input type="checkbox" checked readOnly className="h-4 w-4 rounded accent-cyan-500" />
                    Klasifikasi Pindah
                  </label>
                  <SelectDark value={noKlas} onChange={(e) => setNoKlas(e.target.value)}>
                    {klasifikasiOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </SelectDark>
                </div>
              )}

              {normalizedExtraFilters.map((ef) => (
                <div key={ef.key} className="space-y-1.5 sm:col-span-2 xl:col-span-1">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                    {ef.label}
                  </label>
                  <input
                    value={extraFilterValues[ef.key] ?? ""}
                    onChange={(e) =>
                      setExtraFilterValues((prev) => ({ ...prev, [ef.key]: e.target.value }))
                    }
                    placeholder={ef.placeholder ?? ef.label}
                    className="w-full rounded-2xl border border-cyan-500/30 bg-[#080d1f] px-4 py-2 text-sm text-slate-100 outline-none shadow-[0_4px_15px_rgba(0,0,0,0.45)] transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30"
                  />
                </div>
              ))}
            </div>

            {metaError && (
              <div className="mt-4 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                {metaError}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-400/60 bg-cyan-500/30 px-6 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-50 shadow-[0_6px_16px_rgba(0,255,255,0.12)] transition hover:bg-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Cari / Generate
                </button>

                <button
                  type="button"
                  onClick={handleReload}
                  disabled={reloading || !lastPayload}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-500/60 bg-sky-500/20 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  Reload
                </button>

                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 transition hover:bg-white/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </button>
              </div>

              {meta && (
                <div className="rounded-xl bg-white/5 px-4 py-3 text-[11px] text-cyan-200/80 sm:ml-auto">
                  <span className="font-semibold text-cyan-50">
                    Total: {total.toLocaleString("id-ID")} {totalLabel}
                  </span>
                  <span className="ml-2">
                    Rentang: {meta.labelTanggal}
                    {meta.filter?.noKec ? ` • NO_KEC ${meta.filter.noKec}` : " • Semua Kec"}
                    {meta.filter?.noKec &&
                      (meta.filter?.noKel ? ` • NO_KEL ${meta.filter.noKel}` : " • Semua Kel")}
                    {showKlasifikasi && meta.filter?.noKlas ? ` • Klasifikasi ${meta.filter.noKlas}` : ""}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                {error}
              </div>
            )}
          </form>

          <section className="rounded-2xl border border-cyan-900/60 bg-[#050816]/80 p-4 shadow-[0_0_30px_#00ffff22] sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-cyan-300" />
                <div>
                  <p className="text-sm font-semibold text-cyan-50">{meta?.subTitle || moduleLabel}</p>
                  <p className="text-xs text-slate-300">Dinas Kependudukan dan Pencatatan Sipil Kota Bandung</p>
                </div>
              </div>
              {data.length > 0 && (
                <p className="text-[11px] text-cyan-200/70">
                  Menampilkan {data.length.toLocaleString("id-ID")} baris • Total {total.toLocaleString("id-ID")} {totalLabel}
                </p>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-cyan-900/60 bg-[#020617]/80 p-2">
              <JQDataTable
                key={tableKeyWithFilter}
                id={tableId}
                data={data as any[]}
                columns={columns as any}
                minWidth={minWidth}
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
                  order,
                }}
              />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
