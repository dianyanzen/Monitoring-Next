"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCcw, Search, Trash2 } from "lucide-react";
import DateRangePopup from "@/components/ui/DateRangePopup";
import SelectDark from "@/components/ui/SelectDark";
import { DataShell, LoadingBlank } from "@/components/ui/LoadingOverlay";

// Penting untuk tombol Excel di DataTable
import JSZip from "jszip";
if (typeof window !== "undefined") (window as any).JSZip = JSZip;

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => <LoadingBlank message="Menyiapkan tabel" subtext="harap tunggu" />,
});

type WilayahOption = { value: string; label: string };
type MetaState = {
  akses: { aksesKecamatan: number; aksesKelurahan: number };
  defaults: { noProp: string; noKab: string; noKec: string; noKel: string };
  wilayah: { kecamatan: WilayahOption[]; kelurahan: WilayahOption[] };
};
type MetaResponse = { success: boolean; data?: MetaState; message?: string };

export type SearchReqPageProps = {
  endpoint: string;
  title: string;
  subtitle: string;
  tableTitle: string;
  tableId: string;
  columns: any[];
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const todayISO = () => iso(new Date());
const isoToDMY = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}-${m}-${y}`;
};
const stripHtml = (d: any) => String(d ?? "").replace(/<[^>]*>/g, "");
const bodyCsv = (data: any) => stripHtml(data).replace(/^[,\s]+/, "");
const bodyXlsxWithComma = (data: any) => "\u200B" + stripHtml(data);
const convertWilayahCode = (raw: string | null | undefined) => {
  const val = (raw ?? "").trim();
  if (!val) return "0";
  const digits = val.replace(/[^\d]/g, "");
  if (!digits || digits === "0" || digits === "000") return "0";
  const normalized = Number(digits);
  return Number.isNaN(normalized) ? digits : String(normalized);
};
function mergeOptions(options: WilayahOption[], includeDefault: boolean, defaultLabel: string) {
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
}

export function SearchReqPage({ endpoint, title, subtitle, tableTitle, tableId, columns }: SearchReqPageProps) {
  const [meta, setMeta] = useState<MetaState | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [kecamatanOptions, setKecamatanOptions] = useState<WilayahOption[]>([]);
  const [kelurahanCache, setKelurahanCache] = useState<Record<string, WilayahOption[]>>({});
  const [kelurahanLoadingKey, setKelurahanLoadingKey] = useState<string | null>(null);

  const [noKec, setNoKec] = useState<string>("0");
  const [noKel, setNoKel] = useState<string>("0");
  const [nikInput, setNikInput] = useState<string>("");

  const [start, setStart] = useState<string>(todayISO());
  const [end, setEnd] = useState<string>(todayISO());
  const [rangeErr, setRangeErr] = useState<string | null>(null);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMetaLoading(true);
      setMetaError(null);
      try {
        const res = await fetch("/api/check/ktpel/meta", { cache: "no-store", credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload: MetaResponse = await res.json();
        if (!payload.success || !payload.data) throw new Error(payload.message || "Metadata tidak valid");
        if (cancelled) return;
        const m = payload.data;
        setMeta(m);
        setKecamatanOptions(m.wilayah.kecamatan);
        const defKec = convertWilayahCode(m.defaults.noKec);
        const defKel = convertWilayahCode(m.defaults.noKel);
        setNoKec(defKec);
        setNoKel(defKel);
        if (defKec !== "0" && m.wilayah.kelurahan.length > 0) {
          setKelurahanCache({ [defKec]: m.wilayah.kelurahan });
        }
      } catch (e: any) {
        if (!cancelled) setMetaError(e?.message || "Gagal memuat metadata");
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allowSelectKecamatan = useMemo(() => {
    if (!meta) return true;
    const def = convertWilayahCode(meta.defaults.noKec);
    return def === "0" || meta.akses.aksesKecamatan > 0;
  }, [meta]);
  const allowSelectKelurahan = useMemo(() => {
    if (!meta) return true;
    const def = convertWilayahCode(meta.defaults.noKel);
    return def === "0" || meta.akses.aksesKelurahan > 0;
  }, [meta]);
  const currentKelOptions = useMemo(() => kelurahanCache[noKec] ?? [], [kelurahanCache, noKec]);

  async function handleKecamatanChange(value: string) {
    setNoKec(value);
    setNoKel("0");
    if (value === "0") return;
    if (kelurahanCache[value]) return;
    setKelurahanLoadingKey(value);
    try {
      const params = new URLSearchParams({ no_kec: value });
      if (meta) {
        params.set("no_prop", meta.defaults.noProp);
        params.set("no_kab", meta.defaults.noKab);
      }
      const res = await fetch(`/api/check/ktpel/kelurahan?${params.toString()}`, { cache: "no-store", credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list: WilayahOption[] = json?.data?.kelurahan ?? json?.kelurahan ?? [];
      setKelurahanCache((prev) => ({ ...prev, [value]: list }));
    } catch (e) {
      console.error("Gagal memuat kelurahan:", e);
    } finally {
      setKelurahanLoadingKey(null);
    }
  }

  useEffect(() => {
    setRangeErr(end >= start ? null : "Rentang tanggal tidak valid");
  }, [start, end]);

  const formInvalid = !!rangeErr;

  const runSearch = async () => {
    if (formInvalid) {
      setMsg("Periksa kembali input: " + [rangeErr].filter(Boolean).join("; "));
      return;
    }
    setLoading(true);
    setMsg(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body: any = {};
      if (noKec !== "0") body.no_kec = Number(noKec);
      if (noKel !== "0") body.no_kel = Number(noKel);
      body.tgl_start = isoToDMY(start);
      body.tgl_end = isoToDMY(end);

      const nikTrim = nikInput.trim().replace(/[^\d,]/g, "").replace(/,+/g, ",").replace(/(^,|,$)/g, "");
      if (nikTrim) body.nik = nikTrim;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const j = await res.json().catch(() => ({}));
      const d1 = j?.data ?? j;
      const d2 = d1?.data ?? d1;
      const items: any[] = (d2?.items ?? d2?.rows ?? []) as any[];

      if (!res.ok) throw new Error(j?.message || "Gagal mengambil data.");

      setRows(Array.isArray(items) ? items : []);
      if (!items?.length) setMsg("Data tidak ditemukan untuk filter yang dipilih.");
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setRows([]);
      setMsg(e?.message || "Gagal mengambil data.");
    } finally {
      setLoading(false);
    }
  };

  const clearFilter = () => {
    if (!meta) {
      setNoKec("0");
      setNoKel("0");
    } else {
      setNoKec(convertWilayahCode(meta.defaults.noKec));
      setNoKel(convertWilayahCode(meta.defaults.noKel));
    }
    const t = todayISO();
    setStart(t);
    setEnd(t);
    setRangeErr(null);
    setNikInput("");
    setRows([]);
    setMsg(null);
  };

  const kecOptions = mergeOptions(kecamatanOptions, true, "-- Pilih Kecamatan --");
  const kelOptions = mergeOptions(currentKelOptions, true, "-- Pilih Kelurahan --");

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-10 pt-6 text-gray-100 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-[-15%] h-[1100px] w-[1100px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[18%] bottom-[-20%] h-[1000px] w-[1000px] rounded-full bg-fuchsia-600/12 blur-[190px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl overflow-hidden">
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">Request eKTP</p>
              <h1 className="text-lg font-semibold text-cyan-100">{title}</h1>
              <p className="text-sm text-cyan-200/70">{subtitle}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
                Total: <span className="font-semibold text-cyan-50">{rows.length}</span>
              </span>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <RefreshCcw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
          </div>
        </header>

        <div className="p-4 space-y-6">
          <Panel title="Filter">
            <form
              className="rounded-xl border border-cyan-800/40 bg-[#0c1220]/50 p-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void runSearch();
              }}
            >
              {metaError ? (
                <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{metaError}</div>
              ) : null}

              <div className="flex flex-wrap items-start gap-4">
                <div className="flex flex-col gap-1 w-full lg:w-[40%]">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
                      <input type="checkbox" checked readOnly className="lux-checkbox" /> Kecamatan
                    </label>
                    <SelectDark
                      value={noKec}
                      onChange={(e) => void handleKecamatanChange(e.target.value)}
                      disabled={!allowSelectKecamatan || metaLoading}
                      className="flex-1 min-w-[220px]"
                    >
                      {kecOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </SelectDark>
                  </div>
                </div>

                <div className="flex flex-col gap-1 w-full lg:w-[40%]">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
                      <input type="checkbox" checked readOnly className="lux-checkbox" /> Kelurahan
                    </label>
                    <SelectDark
                      value={noKel}
                      onChange={(e) => setNoKel(e.target.value)}
                      disabled={!allowSelectKelurahan || noKec === "0" || kelurahanLoadingKey === noKec}
                      className="flex-1 min-w-[220px]"
                    >
                      {kelOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </SelectDark>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-start gap-4">
                <div className="flex flex-col w-full lg:w-[40%]">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
                      <input type="checkbox" checked readOnly className="lux-checkbox" /> Tanggal Request
                    </label>

                    <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                      <DateRangePopup
                        start={start}
                        end={end}
                        onChange={(s, e) => {
                          setStart(s);
                          setEnd(e);
                        }}
                        months={2}
                        minWidth={700}
                        preferDown
                      />
                    </div>
                  </div>
                  {rangeErr ? <small className="text-red-300 mt-1">{rangeErr}</small> : null}
                </div>

                <div className="flex items-center gap-3 w-full lg:w-[40%]">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" /> NIK (opsional)
                  </label>
                  <input
                    value={nikInput}
                    onChange={(e) => setNikInput(e.target.value)}
                    placeholder="Pisahkan dengan koma, boleh kosong"
                    className="flex-1 min-w-[220px] rounded-lg border border-cyan-800/40 bg-[#0c1220]/70 px-3 py-2 text-sm text-cyan-100 outline-none focus:border-cyan-400/60"
                  />
                </div>

                <div className="ml-auto flex items-center gap-2 w-full lg:w-auto">
                  <button
                    type="submit"
                    disabled={loading || metaLoading || formInvalid}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    title={formInvalid ? "Perbaiki input terlebih dulu" : "Cari (Enter)"}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {loading ? "Mencari..." : "Search"}
                  </button>
                  <button
                    type="button"
                    onClick={clearFilter}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-white/5 px-4 py-2 text-sm text-cyan-100/80 hover:bg-white/10"
                  >
                    <Trash2 className="h-4 w-4" /> Clear
                  </button>
                </div>
              </div>

              {msg ? (
                <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100" aria-live="polite">
                  {msg}
                </div>
              ) : null}
            </form>
          </Panel>

          <Panel title={tableTitle}>
            <DataShell loading={loading} hasData={rows.length > 0}>
              <JQDataTable
                id={tableId}
                data={rows as any[]}
                minWidth={1400}
                pageLength={50}
                tableClassName="dt-cyberpunk"
                columns={[
                  { data: null, title: "No", className: "dt-body-center", render: (_: any, __: any, ___: any, meta: any) => meta.row + 1, orderable: false, width: "60px" },
                  ...columns,
                ]}
                options={{
                  deferRender: true,
                  autoWidth: false,
                  scrollX: true,
                  stripeClasses: [],
                  lengthMenu: [
                    [10, 25, 50, 100],
                    [10, 25, 50, 100],
                  ],
                  dom: "<'dt-top-bar flex items-center justify-between gap-3'<'dt-left flex items-center gap-2'Bl><'dt-right ml-auto'f>>rt<'dt-bottom-bar flex items-center justify-between gap-3'<'dt-info'i><'dt-paging'p>>",
                  language: {
                    search: "",
                    searchPlaceholder: "Search…",
                    lengthMenu: "Tampilkan _MENU_ data",
                    info: "Menampilkan _START_–_END_ dari _TOTAL_ data",
                    infoEmpty: "Menampilkan 0 data",
                    paginate: { previous: "‹", next: "›" },
                    zeroRecords: "Tidak ada data yang sesuai",
                  },
                  buttons: [
                    { extend: "copy", text: "Copy", exportOptions: { format: { body: stripHtml } } },
                    { extend: "csvHtml5", text: "CSV", bom: true, exportOptions: { format: { body: bodyCsv } } },
                    { extend: "excelHtml5", text: "Excel", exportOptions: { format: { body: bodyXlsxWithComma } } },
                    { extend: "print", text: "Print", exportOptions: { format: { body: stripHtml } } },
                  ],
                  order: [[2, "desc"]],
                }}
              />
            </DataShell>
          </Panel>
        </div>
      </section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <header className="px-3 py-2 border-b border-white/10 text-sm text-cyan-200/90 font-semibold">{title}</header>
      <div className="p-3">{children}</div>
    </section>
  );
}
