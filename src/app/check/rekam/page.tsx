// FILE: src/app/check/rekam/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Loader2, Search, RefreshCcw, Trash2 } from "lucide-react";
import { useSession } from "@/contexts/session";
import SelectDark from "@/components/ui/SelectDark";
import DateRangePopup from "@/components/ui/DateRangePopup"; // ⟵ NEW

// Penting untuk excelHtml5
import JSZip from "jszip";
if (typeof window !== "undefined") (window as any).JSZip = JSZip;

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => <div className="px-2 py-6 text-sm text-cyan-200/80">Memuat tabel…</div>,
});

type Row = {
  NIK: string;
  NAMA_LGKP: string;
  TMPT_LHR: string;
  TGL_LHR: string;   // DD-MM-YYYY
  ALAMAT: string;
  NO_KEC: number;
  NAMA_KEC: string;
  NO_KEL: number;
  NAMA_KEL: string;
  NO_RW: number;
  NO_RT: number;
  KODE_POS: string;
  AGAMA: string;
  STATUS_KAWIN: string;
  PEKERJAAN: string;
  TGL_REKAM: string; // YYYY-MM-DD
  JAM_REKAM?: string; // HH:MM
  STATUS_KTP: string;
  PETUGAS_REKAM: string;
};

type WilayahOption = { value: string; label: string };
type MetaState = {
  akses: { aksesKecamatan: number; aksesKelurahan: number };
  defaults: { noProp: string; noKab: string; noKec: string; noKel: string };
  wilayah: { kecamatan: WilayahOption[]; kelurahan: WilayahOption[] };
  statuses: { pushable: string[]; pushPrimary: string[]; pushRetry: string[] };
  photoBase: string | null;
  legacyPushBase: string | null;
  legacyHistoryBase: string | null;
};
type MetaResponse = { success: boolean; data?: MetaState; message?: string };

/* ===== Helpers tanggal ===== */
const iso = (d: Date) => d.toISOString().slice(0, 10);                      // YYYY-MM-DD
const todayISO = () => iso(new Date());
const isoToDMY = (s: string) => { const [y,m,d] = s.split("-"); return `${d}-${m}-${y}`; }; // DD-MM-YYYY
const labelRange = (s: string, e: string) => `(${isoToDMY(s)} - ${isoToDMY(e)})`;

const stripHtml = (d: any) => String(d ?? "").replace(/<[^>]*>/g, "");
const NIK_COL = 2;
const bodyXlsxWithComma = (data: any, _row: number, col: number) => {
  const t = stripHtml(data);
  return col === NIK_COL ? "\u200B" + t : t;
};
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
  if (includeDefault) { merged.push({ value: "0", label: defaultLabel }); seen.add("0"); }
  for (const opt of options) {
    const value = (opt.value ?? "").trim() || "0";
    if (!seen.has(value)) { merged.push({ value, label: opt.label }); seen.add(value); }
  }
  return merged;
}
function ensureFooter(api: any, html: string) {
  const table = api.table();
  let foot = table.footer();
  if (!foot) { foot = document.createElement("tfoot"); foot.innerHTML = html; (table.node() as HTMLElement).appendChild(foot); }
  return foot;
}

/* ===== Validasi & helper input ===== */
const onlyDigits16 = (s: string) => s.replace(/\D/g, "").slice(0, 16);
const is16 = (s: string) => /^\d{16}$/.test(s);

// ===== Export helpers (CSV & Excel) =====
// Urutan kolom: 0 No, 1 No Kec, 2 NIK, 3 Nama, 4 Petugas, 5 Tgl Rekam, 6 Jam Rekam, 7 Status, 8 Nama Kec, 9 Nama Kel
const isSensitiveCol = (col: number) => col === 2 || col === 5;
const bodyCsv = (data: any, _row: number, col: number) => {
  const t = stripHtml(data).replace(/^[,\s]+/, "");
  return isSensitiveCol(col) ? '="' + t.replace(/"/g, '""') + '"' : t;
};
const bodyXlsx = (data: any) => stripHtml(data).replace(/^[,\s]+/, "");
// --- REPLACE excelCustomize ---
// utils/excelCustomizeTextCols.ts
export const excelCustomizeTextCols = (xlsx: any, wantedHeaders: string[]) => {
  try {
    const wsName = Object.keys(xlsx?.xl?.worksheets ?? {})[0];
    if (!wsName) return;

    const wsStr = xlsx.xl.worksheets[wsName];
    const stylesStr = xlsx.xl["styles.xml"];
    const sstStr = xlsx.xl["sharedStrings.xml"]; // bisa tidak ada

    if (typeof wsStr !== "string" || typeof stylesStr !== "string") return;

    const wdoc = new DOMParser().parseFromString(wsStr, "application/xml");
    const sdoc = new DOMParser().parseFromString(stylesStr, "application/xml");
    const sstdoc = sstStr ? new DOMParser().parseFromString(sstStr, "application/xml") : null;

    // buat/cari style TEXT (numFmtId 49)
    const cellXfs = sdoc.getElementsByTagName("cellXfs")[0];
    let textId = Array.from(cellXfs.getElementsByTagName("xf"))
      .findIndex((xf: any) => xf.getAttribute("numFmtId") === "49");
    if (textId < 0) {
      const xf = sdoc.createElement("xf");
      xf.setAttribute("numFmtId", "49");
      xf.setAttribute("applyNumberFormat", "1");
      cellXfs.appendChild(xf);
      textId = cellXfs.childNodes.length - 1;
      xlsx.xl["styles.xml"] = new XMLSerializer().serializeToString(sdoc);
    }

    // petakan judul header -> huruf kolom (A,B,C,...)
    const headMap: Record<string, string> = {};
    const headRow = wdoc.querySelector('sheetData row[r="1"]');
    const getText = (c: Element) => {
      const t = c.getAttribute("t");
      if (t === "inlineStr") return c.querySelector("is t")?.textContent ?? "";
      if (t === "s" && sstdoc) {
        const idx = Number(c.querySelector("v")?.textContent ?? "");
        return sstdoc.querySelectorAll("si t")[idx]?.textContent ?? "";
      }
      return c.querySelector("v")?.textContent ?? "";
    };
    headRow?.querySelectorAll("c").forEach((c) => {
      const col = c.getAttribute("r")!.replace(/\d+$/, "");
      const title = (getText(c) || "").trim().toLowerCase();
      headMap[title] = col;
    });

    // paksa kolom target menjadi TEXT
    wantedHeaders
      .map((h) => headMap[h.toLowerCase()])
      .filter(Boolean)
      .forEach((col) => {
        wdoc.querySelectorAll(`row c[r^="${col}"]`).forEach((c) => {
          c.setAttribute("t", "str");
          c.setAttribute("s", String(textId));
        });
      });

    xlsx.xl.worksheets[wsName] = new XMLSerializer().serializeToString(wdoc);
  } catch (e) {
    console.warn("excel customize failed:", e);
  }
};



export default function RekamPage() {
  const { user } = useSession();

  const [meta, setMeta] = useState<MetaState | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [kecamatanOptions, setKecamatanOptions] = useState<WilayahOption[]>([]);
  const [kelurahanCache, setKelurahanCache] = useState<Record<string, WilayahOption[]>>({});
  const [kelurahanLoadingKey, setKelurahanLoadingKey] = useState<string | null>(null);

  const [noKec, setNoKec] = useState<string>("0");
  const [noKel, setNoKel] = useState<string>("0");
  const [nik, setNik] = useState<string>("");
  const [noKk, setNoKk] = useState<string>("");
  const [userBenroll, setUserBenroll] = useState<string>("");

  // ⟵ NEW: pakai ISO start/end dari DateRangePopup
  const [start, setStart] = useState<string>(todayISO());
  const [end, setEnd] = useState<string>(todayISO());

  // error state
  const [nikErr, setNikErr] = useState<string | null>(null);
  const [kkErr, setKkErr] = useState<string | null>(null);
  const [rangeErr, setRangeErr] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const total = rows.length;

  // load meta
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
    return () => { cancelled = true; };
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

  // === VALIDASI DINAMIS ===
  useEffect(() => { setNikErr(nik ? (is16(nik) ? null : "NIK harus 16 digit") : null); }, [nik]);
  useEffect(() => { setKkErr(noKk ? (is16(noKk) ? null : "No KK harus 16 digit") : null); }, [noKk]);
  useEffect(() => {
    // range wajib valid hanya bila NIK & No KK kosong
    if (!nik && !noKk) setRangeErr(end >= start ? null : "Rentang tanggal tidak valid");
    else setRangeErr(null);
  }, [start, end, nik, noKk]);

  const formInvalid =
    (!!nik && !!nikErr) ||
    (!!noKk && !!kkErr) ||
    (!nik && !noKk && !!rangeErr);

  const runSearch = async () => {
    if (formInvalid) {
      setMsg("Periksa kembali input: " + [nikErr, kkErr, rangeErr].filter(Boolean).join("; "));
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

      const nikTrim = nik.trim();
      const kkTrim = noKk.trim();
      const usrTrim = userBenroll.trim();

      if (nikTrim) body.nik = nikTrim;
      else if (kkTrim) body.no_kk = kkTrim;
      else {
        // ⟵ pakai ISO dari picker, convert ke DD-MM-YYYY untuk API
        body.tgl_start = isoToDMY(start);
        body.tgl_end   = isoToDMY(end);
      }
      if (usrTrim) body.user = usrTrim;

      const res = await fetch(`/api/check/rekam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const j = await res.json().catch(() => ({}));
      const d1 = j?.data ?? j;
      const d2 = d1?.data ?? d1;
      const items: Row[] = (d2?.rows ?? d2?.items ?? []) as Row[];

      if (!res.ok) throw new Error(j?.message || "Gagal mengambil data.");

      setRows(Array.isArray(items) ? items : []);
      if (!items?.length) setMsg("Data Tidak Ditemukan untuk filter yang anda pilih.");
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setRows([]);
      setMsg(e?.message || "Gagal mengambil data.");
    } finally {
      setLoading(false);
    }
  };

  const clearFilter = () => {
    if (!meta) { setNoKec("0"); setNoKel("0"); }
    else { setNoKec(convertWilayahCode(meta.defaults.noKec)); setNoKel(convertWilayahCode(meta.defaults.noKel)); }
    setNik(""); setNoKk(""); setUserBenroll("");
    const t = todayISO();
    setStart(t); setEnd(t); // reset range
    setNikErr(null); setKkErr(null); setRangeErr(null);
    setRows([]); setMsg(null);
  };

  const kecOptions = mergeOptions(kecamatanOptions, true, "-- Pilih Kecamatan --");
  const kelOptions = mergeOptions(currentKelOptions, true, "-- Pilih Kelurahan --");

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-10 pt-6 text-gray-100 sm:px-6 md:px-8 md:pt-8">
      {/* glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-[-15%] h-[1100px] w-[1100px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[18%] bottom-[-20%] h-[1000px] w-[1000px] rounded-full bg-fuchsia-600/12 blur-[190px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl overflow-hidden">
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
            <h1 className="text-base font-semibold tracking-wide text-cyan-200">Monitoring — Checking List Perekaman KTP-EL</h1>
            <div className="ml-auto flex items-center gap-2">
              {total > 0 ? <span className="ml-auto text-xs text-cyan-200/80">Total: <span className="font-semibold text-cyan-100">{total}</span> data</span> : null}
              <div className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
                User: {(user as any)?.S_NAMA_LGKP ?? (user as any)?.S_USER_ID ?? "-"}
              </div>
              <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20">
                <RefreshCcw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
          </div>
        </header>

        {/* PANELS */}
        <div className="p-4 space-y-6">
          {/* Panel Filter */}
          <Panel title="Filter Perekaman (Rekam)">
            <form
              className="rounded-xl border border-cyan-800/40 bg-[#0c1220]/50 p-4 space-y-4"
              onSubmit={(e) => { e.preventDefault(); runSearch(); }}
            >
              {metaError ? (
                <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{metaError}</div>
              ) : null}

              {/* Baris 1: Kec/Kel */}
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex flex-col gap-1 w-full lg:w-[40%]">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
                      <input type="checkbox" checked readOnly className="lux-checkbox" /> Kecamatan
                    </label>
                    <SelectDark value={noKec} onChange={(e) => void handleKecamatanChange(e.target.value)} disabled={!allowSelectKecamatan || metaLoading} className="flex-1 min-w-[220px]">
                      {kecOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </SelectDark>
                  </div>
                </div>

                <div className="flex flex-col gap-1 w-full lg:w-[40%]">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
                      <input type="checkbox" checked readOnly className="lux-checkbox" /> Kelurahan
                    </label>
                    <SelectDark value={noKel} onChange={(e) => setNoKel(e.target.value)} disabled={!allowSelectKelurahan || noKec === "0" || kelurahanLoadingKey === noKec} className="flex-1 min-w-[220px]">
                      {mergeOptions(currentKelOptions, true, "-- Pilih Kelurahan --").map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </SelectDark>
                  </div>
                </div>
              </div>

              {/* Baris 2: NIK/KK */}
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex flex-col w-full lg:w-[40%]">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
                      <input type="checkbox" checked readOnly className="lux-checkbox" /> NIK
                    </label>
                    <input
                      inputMode="numeric"
                      pattern="\d{16}"
                      maxLength={16}
                      value={nik}
                      onChange={(e) => setNik(onlyDigits16(e.target.value))}
                      placeholder="Masukan NIK (16 digit)"
                      aria-invalid={!!nikErr}
                      title="Masukkan 16 digit angka"
                      className={`flex-1 min-w-[220px] rounded-lg border px-3 py-2 text-sm outline-none ${
                        nikErr ? "border-red-500/60 bg-red-500/10 text-red-100" : "border-cyan-800/40 bg-[#0c1220]/70 text-cyan-100 focus:border-cyan-400/60"
                      }`}
                    />
                  </div>
                  {nikErr ? <small className="text-red-300 mt-1">{nikErr}</small> : null}
                </div>

                <div className="flex flex-col w-full lg:w-[40%]">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
                      <input type="checkbox" checked readOnly className="lux-checkbox" /> No KK
                    </label>
                    <input
                      inputMode="numeric"
                      pattern="\d{16}"
                      maxLength={16}
                      value={noKk}
                      onChange={(e) => setNoKk(onlyDigits16(e.target.value))}
                      placeholder="Masukan No KK (16 digit)"
                      aria-invalid={!!kkErr}
                      title="Masukkan 16 digit angka"
                      className={`flex-1 min-w-[220px] rounded-lg border px-3 py-2 text-sm outline-none ${
                        kkErr ? "border-red-500/60 bg-red-500/10 text-red-100" : "border-cyan-800/40 bg-[#0c1220]/70 text-cyan-100 focus:border-cyan-400/60"
                      }`}
                    />
                  </div>
                  {kkErr ? <small className="text-red-300 mt-1">{kkErr}</small> : null}
                </div>
              </div>

              {/* Baris 3: Tanggal/User + Actions */}
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex flex-col w-full lg:w-[40%]">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
                      <input type="checkbox" checked readOnly className="lux-checkbox" /> Tanggal Rekam
                    </label>

                    {/* ⟵ NEW: DateRangePopup + label DD-MM-YYYY */}
                    <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                      <DateRangePopup
                        start={start}
                        end={end}
                        onChange={(s, e) => { setStart(s); setEnd(e); }}
                        months={2}
                        minWidth={700}
                      />
                      <span hidden className="text-xs text-cyan-200/70">{labelRange(start, end)}</span>
                    </div>
                  </div>
                  {(!nik && !noKk && rangeErr) ? <small className="text-red-300 mt-1">{rangeErr}</small> : null}
                </div>

                <div className="flex items-center gap-3 w-full lg:w-[40%]">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" /> User Benroll
                  </label>
                  <input
                    value={userBenroll}
                    onChange={(e) => setUserBenroll(e.target.value)}
                    placeholder="Masukan Username"
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

              {msg ? <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100" aria-live="polite">{msg}</div> : null}
            </form>
          </Panel>

          {/* Panel Data */}
          <Panel title="DATA REKAM">
            {rows.length ? (
              <JQDataTable
                id="dt-rekam"
                data={rows as any[]}
                minWidth={1200}
                pageLength={50}
                tableClassName="dt-cyberpunk"
                columns={[
                  { data: null, title: "No", className: "dt-body-center", render: (_:any, __:any, ___:any, meta:any) => meta.row + 1, orderable:false, width:"60px" },
                  { data: (r:any)=>r.NO_KEC, title:"No Kec", className:"dt-body-center", width:"90px" },
                  { data: "NIK", title:"NIK", className:"dt-body-center", width:"170px",
                    render: (val:any, type:any) => {
                      const nik = String(val ?? "").trim();
                      if (type === "display") return `<span style="color:rgba(255,63,173,.02)">,</span><span>${nik}</span>`;
                      return nik;
                    }
                  },
                  { data: (r:any)=>r.NAMA_LGKP, title:"Nama Lengkap", width:"220px" },
                  { data: (r:any)=>r.PETUGAS_REKAM, title:"Petugas Rekam", className:"dt-body-center", width:"160px" },
                  { data: (r:any)=>r.TGL_REKAM, title:"Tanggal Rekam", className:"dt-body-center", width:"140px" },
                  { data: (r:any)=>r.JAM_REKAM ?? "", title:"Jam Rekam", className:"dt-body-center", width:"110px" },
                  { data: (r:any)=>r.STATUS_KTP, title:"Status E-KTP", className:"dt-body-center", width:"160px" },
                  { data: (r:any)=>r.NAMA_KEC, title:"Nama Kecamatan", width:"180px" },
                  { data: (r:any)=>r.NAMA_KEL, title:"Nama Kelurahan", width:"200px" },
                ]}
                options={{
                  deferRender:true, autoWidth:false, scrollX:true, stripeClasses:[],
                  lengthMenu:[[10,25,50,100],[10,25,50,100]],
                  dom:"<'dt-top-bar flex items-center justify-between gap-3'<'dt-left flex items-center gap-2'Bl><'dt-right ml-auto'f>>rt<'dt-bottom-bar flex items-center justify-between gap-3'<'dt-info'i><'dt-paging'p>>",
                  language:{ search:"", searchPlaceholder:"Search…", lengthMenu:"Tampilkan _MENU_ data", info:"Menampilkan _START_–_END_ dari _TOTAL_ data", infoEmpty:"Menampilkan 0 data", paginate:{ previous:"‹", next:"›" }, zeroRecords:"Tidak ada data yang sesuai" },
                  buttons:[
                    { extend:"copy", text:"Copy", exportOptions:{ format:{ body:(d:any)=>stripHtml(d) } } },
                    { extend:"csvHtml5", text:"CSV", bom:true, exportOptions:{ format:{ body: bodyCsv } } },
                    { 
                      extend: "excelHtml5",
                      text: "Excel",
                      exportOptions: {
                        format: { body: bodyXlsxWithComma } // ⟵ hanya Excel yang ditambah koma
                      }
                    },
                    { extend:"print", text:"Print", exportOptions:{ format:{ body:(d:any)=>stripHtml(d) } } },
                  ],
                  order:[[5,"asc"],[6,"asc"],[3,"asc"]],
                  initComplete: function () {
                    const api = this.api();
                    ensureFooter(api, `
                      <tr>
                        <th colspan="9" style="text-align:center; font-weight:600;">Jumlah</th>
                        <th style="text-align:right; font-weight:600;"></th>
                      </tr>
                    `);
                  },
                  footerCallback: function (_row:any, data:any) {
                    const total = data.length;
                    const api = this.api();
                    const tableNode = api.table().node();
                    let tfoot = tableNode.querySelector("tfoot");
                    if (!tfoot) { tfoot = document.createElement("tfoot"); tableNode.appendChild(tfoot); }
                    tfoot.innerHTML = `
                      <tr>
                        <th colspan="9" style="text-align:center;font-weight:600;">Jumlah</th>
                        <th style="text-align:right;font-weight:600;">${(total||0).toLocaleString("id-ID")}</th>
                      </tr>
                    `;
                    const scrollFoot = (tableNode.closest('.dt-scroll') as HTMLElement)?.querySelector('.dt-scroll-foot tfoot');
                    if (scrollFoot) (scrollFoot as HTMLElement).innerHTML = tfoot.innerHTML;
                  }
                }}
              />
            ) : (
              <div className="px-2 py-6 text-sm text-cyan-200/80">{loading ? "Memuat…" : "Tidak ada data. Tentukan filter lalu tekan Search."}</div>
            )}
          </Panel>
        </div>
      </section>
    </div>
  );
}

/* === UI Bits === */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <div className="p-3">{children}</div>
    </section>
  );
}
