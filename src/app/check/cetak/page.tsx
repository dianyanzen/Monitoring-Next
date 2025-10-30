// FILE: src/app/check/cetak/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, RefreshCcw, Trash2 } from "lucide-react";
import { useSession } from "@/contexts/session";
import SelectDark from "@/components/ui/SelectDark";
import DateRangePopup from "@/components/ui/DateRangePopup";
import { DataShell, LoadingBlank } from "@/components/ui/LoadingOverlay";

// Penting untuk excelHtml5
import JSZip from "jszip";
if (typeof window !== "undefined") (window as any).JSZip = JSZip;

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => <LoadingBlank message="Menyiapkan tabel" subtext="harap tunggu" />,
});

type Row = {
  NIK: string;
  NAMA_LGKP: string;
  TMPT_LHR: string;
  TGL_LHR: string; // DD-MM-YYYY
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
  TGL_CETAK: string; // DD-MM-YYYY
  REQ_DATE: string;  // DD-MM-YYYY | '-' 
  REQ_BY: string;    // '-' allowed
  PROC_BY: string;   // Alasan Pengajuan / 'PINDAHAN' / '-'
  STEP_PROC?: string;
  DIS_DT?: string;   // DD-MM-YYYY
  DIS_BY?: string;
  PETUGAS_CETAK: string;
};

type WilayahOption = { value: string; label: string };
type MetaState = {
  akses: { aksesKecamatan: number; aksesKelurahan: number };
  defaults: { noProp: string; noKab: string; noKec: string; noKel: string };
  wilayah: { kecamatan: WilayahOption[]; kelurahan: WilayahOption[] };
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
const isSensitiveCol = (col: number) => col === 2 || col === 5;
const bodyCsv = (data: any, _row: number, col: number) => {
  const t = stripHtml(data).replace(/^[,\s]+/, "");
  return isSensitiveCol(col) ? '="' + t.replace(/"/g, '""') + '"' : t;
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

/* ===== State ===== */
export default function CetakPage() {
  const { user } = useSession();

  const [meta, setMeta] = useState<MetaState | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [kecamatanOptions, setKecamatanOptions] = useState<WilayahOption[]>([]);
  const [kelurahanCache, setKelurahanCache] = useState<Record<string, WilayahOption[]>>({});
  const [kelurahanLoadingKey, setKelurahanLoadingKey] = useState<string | null>(null);

  const [noKec, setNoKec] = useState<string>("0");
  const [noKel, setNoKel] = useState<string>("0");
  const [userBcard, setUserBcard] = useState<string>("");

  const [start, setStart] = useState<string>(todayISO());
  const [end, setEnd] = useState<string>(todayISO());

  const [rangeErr, setRangeErr] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const total = rows.length;

  // load meta wilayah (pakai endpoint KTP-el yang sudah ada)
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

  // validasi tanggal (wajib)
  useEffect(() => { setRangeErr(end >= start ? null : "Rentang tanggal tidak valid"); }, [start, end]);

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

      // pakai ISO dari picker, convert ke DD-MM-YYYY untuk API
      body.tgl_start = isoToDMY(start);
      body.tgl_end   = isoToDMY(end);

      const usrTrim = userBcard.trim();
      if (usrTrim) body.user = usrTrim;

      const res = await fetch(`/api/check/cetak`, {
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
    setUserBcard("");
    const t = todayISO();
    setStart(t); setEnd(t);
    setRangeErr(null);
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
            <h1 className="text-base font-semibold tracking-wide text-cyan-200">
              Monitoring — Checking List <span className="font-bold">Sudah Cetak</span> KTP-EL
            </h1>
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
          <Panel title="Filter Sudah Cetak (Cetak)">
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

              {/* Baris 2: Tanggal/User + Actions */}
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex flex-col w-full lg:w-[40%]">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
                      <input type="checkbox" checked readOnly className="lux-checkbox" /> Tanggal Cetak
                    </label>

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
                  {rangeErr ? <small className="text-red-300 mt-1">{rangeErr}</small> : null}
                </div>

                <div className="flex items-center gap-3 w-full lg:w-[40%]">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" /> User BCard
                  </label>
                  <input
                    value={userBcard}
                    onChange={(e) => setUserBcard(e.target.value)}
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
          <Panel title="DATA SUDAH CETAK">
            <DataShell loading={loading} hasData={rows.length > 0}>
              <JQDataTable
                id="dt-cetak"
                data={rows as any[]}
                minWidth={1400}
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
                  { data: (r:any)=>r.PETUGAS_CETAK, title:"Petugas Cetak", className:"dt-body-center", width:"160px" },
                  { data: (r:any)=>r.TGL_CETAK, title:"Tanggal Cetak", className:"dt-body-center", width:"140px" },
                  { data: (r:any)=>r.REQ_BY ?? "-", title:"Petugas Pengajuan", className:"dt-body-center", width:"160px" },
                  { data: (r:any)=>r.REQ_DATE ?? "-", title:"Tanggal Pengajuan", className:"dt-body-center", width:"140px" },
                  { data: (r:any)=>r.PROC_BY ?? "-", title:"Alasan Pengajuan", className:"dt-body-center", width:"160px" },
                  { data: (r:any)=>r.DIS_BY ?? "-", title:"Petugas Distribusi", className:"dt-body-center", width:"160px" },
                  { data: (r:any)=>r.DIS_DT ?? "-", title:"Tanggal Distribusi", className:"dt-body-center", width:"140px" },
                  { data: (r:any)=>r.ALAMAT, title:"Alamat", width:"240px" },
                  { data: (r:any)=>r.NO_RW, title:"Rw", className:"dt-body-center", width:"80px" },
                  { data: (r:any)=>r.NO_RT, title:"Rt", className:"dt-body-center", width:"80px" },
                  { data: (r:any)=>r.KODE_POS, title:"Kode Pos", className:"dt-body-center", width:"100px" },
                  { data: (r:any)=>r.STATUS_KAWIN, title:"Status Kawin", className:"dt-body-center", width:"140px" },
                  { data: (r:any)=>r.PEKERJAAN, title:"Jenis Pekerjaan", className:"dt-body-center", width:"160px" },
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
                      exportOptions: { format: { body: bodyXlsxWithComma } } // hanya Excel yang diawali koma untuk kolom sensitif
                    },
                    { extend:"print", text:"Print", exportOptions:{ format:{ body:(d:any)=>stripHtml(d) } } },
                  ],
                  order:[[5,"desc"],[17,"asc"],[18,"asc"]],
                  initComplete: function () {
                    const api = this.api();
                    ensureFooter(api, `
                      <tr>
                        <th colspan="18" style="text-align:center; font-weight:600;">Jumlah</th>
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
                        <th colspan="18" style="text-align:center;font-weight:600;">Jumlah</th>
                        <th style="text-align:right;font-weight:600;">${(total||0).toLocaleString("id-ID")}</th>
                      </tr>
                    `;
                    const scrollFoot = (tableNode.closest('.dt-scroll') as HTMLElement)?.querySelector('.dt-scroll-foot tfoot');
                    if (scrollFoot) (scrollFoot as HTMLElement).innerHTML = tfoot.innerHTML;
                  }
                }}
              />
            </DataShell>
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
      <header className="px-3 py-2 border-b border-white/10 text-sm text-cyan-200/90 font-semibold">{title}</header>
      <div className="p-3">{children}</div>
    </section>
  );
}
