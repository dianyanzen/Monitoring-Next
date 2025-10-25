// FILE: src/app/check/akte/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, Trash2, Download, Info, Rocket, RefreshCcw } from "lucide-react";
import { useSession } from "@/contexts/session";

type Row = {
  NO_DOC: string;
  NIK: string;
  NAMA_LGKP: string;
  JNS_AKTA: string;
  CERT_STATUS: string; // '-', '0','1','2','3','9','NF'
  JML_PENGAJUAN: string | number;
  REQ_DATE: string;
  REQ_BY: string;
  URL_DOKUMEN: string;
  URL_KK: string;
  URL_DATE: string;
  URL_DOWNLOAD: string;
  URL_REGISTER: string;
  APROVE_DATE: string;
};

const statusLabel = (code?: string) => {
  switch ((code || "-").trim()) {
    case "NF":  return { text: "NOMOR AKTA TIDAK DITEMUKAN", icon: Info };
    case "0":
    case "1":   return { text: "BELUM DISERTIFIKASI", icon: Info };
    case "2":   return { text: "PROSES PENERBITAN",  icon: Rocket };
    case "3":   return { text: "BELUM DIPUBLISH",    icon: Rocket };
    case "9":   return { text: "BELUM DIVERIFIKASI", icon: Info };
    case "-":   return { text: "-",                  icon: Info };
    default:    return { text: "SUDAH DIPUBLISH",    icon: CheckBadge as any };
  }
};

// fallback icon
function CheckBadge(props: any){
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} {...props}>
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none"/>
      <path d="M12 2l3 3 4 .5-1.5 3.5L19 13l-3 2-1 4-3-1-3 1-1-4-3-2 1.5-4L5 5.5 9 5l3-3z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  );
}

/** Bersihkan UI text:
 * - UPPERCASE
 * - hapus seluruh spasi/tab
 * - ijinkan -, /, ., koma, serta newline
 */
function cleanUIText(s: string) {
  return s
    .toUpperCase()
    .replace(/[ \t]+/g, "")
    .replace(/[^A-Z0-9\-\/\.,\r\n]/g, "");
}

/** Ubah isi textarea → querystring untuk API */
function toQuery(txt: string) {
  const payload = txt
    .toUpperCase()
    .replace(/[\r\n;]+/g, ",") // baris & semicolon → koma
    .replace(/[ \t]+/g, "")    // hapus spasi/tab
    .replace(/,{2,}/g, ",")
    .replace(/^,|,$/g, "");
  const p = new URLSearchParams();
  if (payload) p.set("noAkte", payload);
  return p.toString();
}

/** Bucket status utk filter UI */
type StatusBucket = "NF" | "BELUM" | "PROSES" | "PUBLISH";
function bucketStatus(code?: string): StatusBucket {
  const c = (code || "").trim().toUpperCase();
  if (c === "NF") return "NF";
  if (c === "2" || c === "3") return "PROSES";
  if (c === "0" || c === "1" || c === "9" || c === "-") return "BELUM";
  return "PUBLISH";
}

/** Semua jenis yang didukung (harus match dengan API) */
const ALL_JENIS = [
  "BAKAK",
  "KELAHIRAN",
  "KEMATIAN",
  "LAHIR_MATI",
  "TAU",
  "PGK",
  "PGS",
  "CERAI",
  "KAWIN",
] as const;
type Jenis = typeof ALL_JENIS[number];

export default function AkteStatusPage(){
  const { user } = useSession();

  const [noAkte, setNoAkte] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FILTER STATES
  const [only3273, setOnly3273] = useState(false);
  const [jenisOn, setJenisOn] = useState<Record<Jenis, boolean>>(
    () => ALL_JENIS.reduce((acc, j) => ((acc[j] = true), acc), {} as Record<Jenis, boolean>)
  );
  const [statusOn, setStatusOn] = useState<Record<StatusBucket, boolean>>({
    NF: true, BELUM: true, PROSES: true, PUBLISH: true,
  });

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const qs = useMemo(()=>toQuery(noAkte), [noAkte]);

  async function search(){
    setError(null);
    if (!qs){ setRows([]); return; }
    setLoading(true);
    try{
      const r = await fetch(`/api/check/akte/status?${qs}`, { credentials:"include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`);
      setRows(j?.data?.items ?? []);
    }catch(e:any){
      setRows([]);
      setError(e?.message || "Gagal memuat data.");
    }finally{
      setLoading(false);
    }
  }

  function clearAll(){
    setNoAkte("");
    setRows([]);
    setError(null);
    inputRef.current?.focus();
  }

  // FILTERED ROWS
  const filteredRows = useMemo(()=>{
    return rows.filter(r => {
      // 1) 3273- only?
      if (only3273 && !String(r.NO_DOC || "").startsWith("3273-")) return false;

      // 2) Jenis on/off
      const j = (r.JNS_AKTA || "").toUpperCase() as Jenis;
      if (ALL_JENIS.includes(j as Jenis)) {
        if (!jenisOn[j as Jenis]) return false;
      } else {
        // Jika ada jenis tak terduga, treat sebagai BAKAK (paling longgar)
        if (!jenisOn["BAKAK"]) return false;
      }

      // 3) Status on/off
      const b = bucketStatus(r.CERT_STATUS);
      if (!statusOn[b]) return false;

      return true;
    });
  }, [rows, only3273, jenisOn, statusOn]);

  // COUNTS
  const total = rows.length;
  const nfCount = rows.reduce((n, r) => n + (r.CERT_STATUS === "NF" ? 1 : 0), 0);

  useEffect(()=>{ inputRef.current?.focus(); }, []);

  // Helpers UI
  function toggleJenis(j: Jenis){ setJenisOn(prev => ({ ...prev, [j]: !prev[j] })); }
  function setAllJenis(v: boolean){
    const next = {} as Record<Jenis, boolean>;
    ALL_JENIS.forEach(j => next[j] = v);
    setJenisOn(next);
  }
  function toggleStatus(s: StatusBucket){ setStatusOn(prev => ({ ...prev, [s]: !prev[s] })); }

  // Placeholder & legend
  const placeholder = [
    "Masukkan banyak nomor akta (pisah baris atau koma).",
    "Didukung (sesuai data BSRE):",
    "- AKTA KELAHIRAN / BAKAK :",
    "- AKTA KEMATIAN / LAHIR MATI:",
    "- TANPA ASAL USUL (TAU) :",
    "- PENGAKUAN / PENGESAHAN :",
    "- PERCERAIAN / PERKAWINAN :"
  ].join("\n");

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-10 pt-6 text-gray-100 sm:px-6 md:px-8 md:pt-8">
      {/* glow kecil */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-[-15%] h-[1100px] w-[1100px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[18%] bottom-[-20%] h-[1000px] w-[1000px] rounded-full bg-fuchsia-600/12 blur-[190px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl overflow-hidden">
        {/* Header */}
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
            <h1 className="text-base font-semibold tracking-wide text-cyan-200">
              Monitoring — Status Akta Terdistribusi
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
          </div>
        </header>

        {/* Toolbar: Input + Filters */}
        <div className="px-5 pb-2 pt-4 space-y-4">
          {/* Input */}
          <div className="flex flex-wrap items-start gap-3">
            <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
              <input type="checkbox" checked readOnly className="accent-cyan-500" />
              No Akta
            </label>

            <div className="flex-1 min-w-[1000px]">
              <textarea
                ref={inputRef}
                rows={8}
                value={noAkte}
                onChange={(e)=>setNoAkte(cleanUIText(e.target.value))}
                onPaste={(e)=>{
                  e.preventDefault();
                  const txt = e.clipboardData?.getData("text") || "";
                  setNoAkte(cleanUIText(txt));
                }}
                onKeyUp={(e)=>{ if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) search(); }}
                placeholder={placeholder}
                className="w-full rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              />
              <p className="mt-2 text-[11px] text-cyan-200/70">
                Tips: Tempel langsung dari Excel/Word. Spasi akan otomatis dihilangkan. Tekan <kbd className="rounded bg-cyan-500/20 px-1">Ctrl/⌘</kbd>+<kbd className="rounded bg-cyan-500/20 px-1">Enter</kbd> untuk mencari.
              </p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={search}
                disabled={loading || !toQuery(noAkte)}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-600/25 px-4 py-2 text-sm shadow-[0_0_14px_#00ffff55] transition-colors hover:bg-cyan-600/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? "Loading…" : "Search"}
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100 transition-colors hover:bg-[#0c1220]/90"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-xl border border-cyan-800/40 bg-black/20 p-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* 3273-only */}
              <button
                type="button"
                onClick={()=>setOnly3273(v => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs border ${only3273 ? "border-cyan-400 bg-cyan-500/20 text-cyan-100" : "border-cyan-800/50 text-cyan-200 hover:bg-cyan-500/10"}`}
              >
                {only3273 ? "✓ " : ""}Hanya 3273-
              </button>

              {/* Jenis chips */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-cyan-200/70">Jenis:</span>
                {ALL_JENIS.map(j => (
                  <button
                    key={j}
                    type="button"
                    onClick={()=>toggleJenis(j)}
                    className={`px-3 py-1.5 rounded-lg text-xs border ${jenisOn[j] ? "border-cyan-400 bg-cyan-500/20 text-cyan-100" : "border-cyan-800/50 text-cyan-200 hover:bg-cyan-500/10"}`}
                    title={j}
                  >
                    {jenisOn[j] ? "✓ " : ""}{j}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={()=>setAllJenis(true)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-cyan-800/50 text-cyan-200 hover:bg-cyan-500/10"
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={()=>setAllJenis(false)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-cyan-800/50 text-cyan-200 hover:bg-cyan-500/10"
                >
                  Kosongkan
                </button>
              </div>

              {/* Status chips */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-cyan-200/70">Status:</span>
                {(["NF","BELUM","PROSES","PUBLISH"] as StatusBucket[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={()=>toggleStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs border ${statusOn[s] ? "border-cyan-400 bg-cyan-500/20 text-cyan-100" : "border-cyan-800/50 text-cyan-200 hover:bg-cyan-500/10"}`}
                    title={s}
                  >
                    {statusOn[s] ? "✓ " : ""}{s}
                  </button>
                ))}
              </div>

              {/* Summary */}
              <div className="ml-auto text-[11px] text-cyan-200/80">
                Total: <span className="font-semibold text-cyan-100">{total}</span> •
                NF: <span className="font-semibold text-cyan-100">{nfCount}</span> •
                Tersaring: <span className="font-semibold text-cyan-100">{filteredRows.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="p-4">
          <div className="overflow-hidden rounded-xl border border-cyan-800/40 bg-black/30">
            <div className="overflow-x-auto" aria-busy={loading} aria-live="polite">
              <table className="min-w-full divide-y divide-cyan-800/60 text-[13px] text-cyan-100/90">
                <thead className="bg-cyan-500/10 text-[11px] uppercase tracking-wide text-cyan-200">
                  <tr>
                    <th className="px-3 py-2 text-center">No</th>
                    <th className="px-3 py-2 text-center">No Akta</th>
                    <th className="px-3 py-2 text-center">Nama Lengkap</th>
                    <th className="px-3 py-2 text-center">Jenis Akta</th>
                    <th className="px-3 py-2 text-center">Status Akta</th>
                    <th className="px-3 py-2 text-left">Request TTE</th>
                    <th className="px-3 py-2 text-center">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-900/60">
                  {loading && rows.length===0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8">
                        <div className="flex items-center justify-center gap-3 text-sm text-cyan-200/80">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Mengambil data…
                        </div>
                      </td>
                    </tr>
                  ) : filteredRows.length===0 ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-cyan-200/70" colSpan={7}>
                        {rows.length ? "Tidak ada data sesuai filter." : "Belum ada data yang ditampilkan."}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r, i) => {
                      const S = statusLabel(r.CERT_STATUS);
                      const StatusIcon = S.icon;
                      const canDownload =
                        r.CERT_STATUS !== "NF" &&
                        !["1","2","3"].includes((r.CERT_STATUS||"").trim()) &&
                        r.URL_DOWNLOAD && r.URL_DOWNLOAD !== "-";
                      return (
                        <tr key={`${r.NO_DOC}-${i}`} className="transition hover:bg-cyan-500/10">
                          <td className="px-3 py-2 text-center text-[12px] text-cyan-100/70">{i+1}</td>
                          <td className="px-3 py-2 text-center font-mono">{r.NO_DOC}</td>
                          <td className="px-3 py-2 text-center">{r.NAMA_LGKP}</td>
                          <td className="px-3 py-2 text-center">{r.JNS_AKTA}</td>

                          {/* STATUS */}
                          <td className="px-3 py-2 text-center">
                            <div className="inline-flex items-center gap-2 text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10">
                              <StatusIcon className="opacity-80" size={12} />
                              <span className="font-semibold text-cyan-200">{S.text}</span>
                            </div>
                          </td>

                          {/* REQUEST TTE */}
                          <td className="px-3 py-2 text-[12px] text-cyan-100/80">
                            {Number(r.JML_PENGAJUAN||0)>0 ? (
                              <div className="flex items-center gap-2"><Rocket size={12}/> Di Ajukan {r.JML_PENGAJUAN}x</div>
                            ) : null}
                            <div className="flex items-center gap-2"><Info size={12}/> Request Date : {r.REQ_DATE}</div>
                            <div className="flex items-center gap-2"><Info size={12}/> Request By : {r.REQ_BY}</div>
                            {r.APROVE_DATE !== "-" ? (
                              <div className="flex items-center gap-2"><Info size={12}/> Di Aprove {r.APROVE_DATE}</div>
                            ) : null}
                          </td>

                          {/* DOWNLOAD */}
                          <td className="px-3 py-2 text-center">
                            {canDownload ? (
                              <div className="flex flex-col items-center gap-1">
                                <button
                                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border border-cyan-800/40"
                                  onClick={()=>window.open(r.URL_DOWNLOAD,"_blank")}
                                >
                                  <Download size={12}/> KUTIPAN
                                </button>
                                {r.URL_REGISTER !== "-" ? (
                                  <button
                                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border border-cyan-800/40"
                                    onClick={()=>window.open(r.URL_REGISTER,"_blank")}
                                  >
                                    <Download size={12}/> REGISTER
                                  </button>
                                ) : null}
                              </div>
                            ) : "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
