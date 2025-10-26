// FILE: src/app/check/kk/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, Trash2, Download, Rocket, Info, Printer, RefreshCcw } from "lucide-react";
import { useSession } from "@/contexts/session";

type Row = {
  NO_KK: string | number;
  NAMA_KEP: string;
  ALAMAT: string;
  NO_PROP: string | number;
  NO_KAB: string | number;
  NO_KEC: string | number;
  NO_KEL: string | number;
  JML_PENGAJUAN: string | number;
  NAMA_KEC: string;
  NAMA_KEL: string;
  NO_RT: string;
  NO_RW: string;
  KODE_POS: string;
  COUNT_KK: string | number;
  CERT_STATUS: string;
  REQ_DATE: string;
  REQ_BY: string;
  URL_DOKUMEN: string;
  URL_KK: string;
  URL_DATE: string;
  URL_DOWNLOAD: string;
  APROVE_DATE: string;
  PRINTED_DATE: string;
  PRINTED_BY: string;
};

const statusLabel = (code?: string) => {
  switch ((code || "-").trim()) {
    case "0":
    case "1": return { text: "BELUM DISERTIFIKASI", icon: Info };
    case "2":   return { text: "PROSES PENERBITAN",  icon: Rocket };
    case "3":   return { text: "BELUM DIPUBLISH",    icon: Rocket };
    case "9":   return { text: "BELUM DIVERIFIKASI", icon: Info };
    case "-":   return { text: "-",                  icon: Info };
    default:    return { text: "SUDAH DIPUBLISH",    icon: CheckBadge as any };
  }
};

// fallback ikon "published"
function CheckBadge(props: any){
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} {...props}>
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none"/>
      <path d="M12 2l3 3 4 .5-1.5 3.5L19 13l-3 2-1 4-3-1-3 1-1-4-3-2 1.5-4L5 5.5 9 5l3-3z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  );
}

function sanitizeNikCsv(v: string){ return v.replace(/[^\d,]/g, ""); }
function onlyDigits(v: string){ return v.replace(/[^\d]/g, ""); }
function handleNumberKeyDown(e: React.KeyboardEvent<HTMLInputElement>, allowComma=false){
  const { key, ctrlKey, metaKey } = e;
  if (ctrlKey || metaKey) return;
  const nav = ["Backspace","Delete","Tab","Enter","ArrowLeft","ArrowRight","Home","End"];
  if (nav.includes(key)) return;
  if (allowComma && key === ",") return;
  if (/^\d$/.test(key)) return;
  e.preventDefault();
}
function handleNumericPaste(
  e: React.ClipboardEvent<HTMLInputElement>,
  allowComma: boolean,
  setter: (v: string)=>void
){
  const clip = e.clipboardData?.getData("text") ?? "";
  const sanitized = allowComma ? sanitizeNikCsv(clip) : onlyDigits(clip);
  const input = e.currentTarget;
  const start = input.selectionStart ?? input.value.length;
  const end   = input.selectionEnd   ?? input.value.length;
  const newValue = input.value.slice(0,start) + sanitized + input.value.slice(end);
  e.preventDefault();
  setter(newValue);
  queueMicrotask(()=>{
    const caret = start + sanitized.length;
    input.setSelectionRange(caret, caret);
  });
}
function formatLeadingComma(v: string | number | null | undefined){
  const clean = (v ?? "").toString().trim();
  return clean ? `,${clean}` : "";
}

export default function KKStatusPage(){
  const { user } = useSession();

  const [noKk, setNoKk]     = useState("");
  const [rows, setRows]     = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const total = rows.length;

  const noKecDefault = (user as any)?.S_NO_KEC ? String((user as any).S_NO_KEC) : "";
  const inputRef = useRef<HTMLInputElement>(null);

  const qs = useMemo(()=>{
    const p = new URLSearchParams();
    if (noKk) p.set("noKk", noKk);
    if (noKecDefault) p.set("noKec", noKecDefault);
    return p.toString();
  }, [noKk, noKecDefault]);

  async function search(){
    setError(null);
    if (!noKk.trim()){ setRows([]); return; }
    setLoading(true);
    try{
      const r = await fetch(`/api/check/kk/status?${qs}`, { credentials:"include" });
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
    setNoKk(""); setRows([]); setError(null); inputRef.current?.focus();
  }

  function handleExportCsv(){
    if (!rows.length) return;
    const headers = ["NO","NO_KK","NAMA_KEP","STATUS_KK","REQ_DATE","REQ_BY","APROVE_DATE","PRINTED_DATE","PRINTED_BY","JML_PENGAJUAN","NAMA_KEC","NAMA_KEL","NO_RW","NO_RT","ALAMAT","KODE_POS","URL_DOWNLOAD"];
    const lines = rows.map((r,i)=>[
      i+1, formatLeadingComma(r.NO_KK), r.NAMA_KEP??"", r.CERT_STATUS??"", r.REQ_DATE??"", r.REQ_BY??"", r.APROVE_DATE??"", r.PRINTED_DATE??"", r.PRINTED_BY??"", r.JML_PENGAJUAN??"", r.NAMA_KEC??"", r.NAMA_KEL??"", r.NO_RW??"", r.NO_RT??"", r.ALAMAT??"", r.KODE_POS??"", r.URL_DOWNLOAD??""
    ]);
    const csv = [headers, ...lines].map(line=>line.map(v=>{
      const s = String(v ?? "").replace(/"/g,'""'); return `"${s}"`;
    }).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.setAttribute("download", `check-kk-${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  useEffect(()=>{ inputRef.current?.focus(); }, []);

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-10 pt-6 text-gray-100 sm:px-6 md:px-8 md:pt-8">
      {/* glow kecil */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-[-15%] h-[1100px] w-[1100px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[18%] bottom-[-20%] h-[1000px] w-[1000px] rounded-full bg-fuchsia-600/12 blur-[190px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl overflow-hidden">
        {/* header lebih ringkas */}
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
            <h1 className="text-base font-semibold tracking-wide text-cyan-200">Monitoring — Status KK Siak Terdistribusi</h1>
            <div className="ml-auto flex items-center gap-2">
              {total > 0 ? (
                <span className="ml-auto text-xs text-cyan-200/80">
                  Total: <span className="font-semibold text-cyan-100">{total}</span> data
                </span>
              ) : null}
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

        {/* toolbar compact (seperti history) */}
        <div className="px-5 pb-2 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
              <input type="checkbox" checked readOnly className="lux-checkbox" />
              NO KK
            </label>

           <input
              ref={inputRef}
              className="w-[260px] rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              placeholder="Masukkan Nomor KK"
              value={noKk}
              autoFocus
              onChange={(e)=>setNoKk(sanitizeNikCsv(e.target.value))}
              onKeyDown={(e)=>handleNumberKeyDown(e,true)}
              onPaste={(e)=>handleNumericPaste(e,true,setNoKk)}
              onKeyUp={(e)=>{ if(e.key==="Enter") search(); }}
            />
            <label className="text-xs text-cyan-100 opacity-70">No KK (boleh banyak, pisahkan dengan koma)</label>

            {/* info kecamatan (optional, kecil & disabled) */}
            {noKecDefault ? (
              <input
                disabled
                hidden
                value={`Kec: ${noKecDefault}`}
                className="w-[140px] rounded-lg border border-cyan-800/40 bg-black/30 px-3 py-1.5 text-[12px] text-cyan-300/80"
              />
            ) : null}

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={search}
                disabled={loading}
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
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!rows.length}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}
        </div>

        {/* tabel (padding & font diperkecil) */}
        <div className="p-4">
          <div className="overflow-hidden rounded-xl border border-cyan-800/40 bg-black/30">
            <div className="overflow-x-auto" aria-busy={loading} aria-live="polite">
              <table className="min-w-full divide-y divide-cyan-800/60 text-[13px] text-cyan-100/90">
                <thead className="bg-cyan-500/10 text-[11px] uppercase tracking-wide text-cyan-200">
                  <tr>
                    <th className="px-3 py-2 text-center">No</th>
                    <th className="px-3 py-2 text-center">No KK</th>
                    <th className="px-3 py-2 text-left">Nama Kep</th>
                    <th className="px-3 py-2 text-center">Status KK</th>
                    <th className="px-3 py-2 text-left">Request TTE</th>
                    <th className="px-3 py-2 text-left">Print KK</th>
                    <th className="px-3 py-2 text-left">Nama Kec</th>
                    <th className="px-3 py-2 text-left">Nama Kel</th>
                    <th className="px-3 py-2 text-center">RW</th>
                    <th className="px-3 py-2 text-center">RT</th>
                    <th className="px-3 py-2 text-left">Alamat</th>
                    <th className="px-3 py-2 text-center">Kode Pos</th>
                    <th className="px-3 py-2 text-center">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-900/60">
                  {loading && rows.length===0 ? (
                    <tr>
                      <td colSpan={13} className="px-3 py-8">
                        <div className="flex items-center justify-center gap-3 text-sm text-cyan-200/80">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Mengambil data…
                        </div>
                      </td>
                    </tr>
                  ) : rows.length===0 ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-cyan-200/70" colSpan={13}>
                        Belum ada data yang ditampilkan.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, i) => {
                      const S = statusLabel(r.CERT_STATUS);
                      const StatusIcon = S.icon;
                      const canRepush   = r.CERT_STATUS === "2" || r.CERT_STATUS === "3";
                      const canDownload = !["1","2","3"].includes((r.CERT_STATUS||"").trim()) && r.URL_DOWNLOAD && r.URL_DOWNLOAD !== "-";
                      const kkCsv = formatLeadingComma(r.NO_KK);

                      return (
                        <tr key={`${r.NO_KK}-${i}`} className="transition hover:bg-cyan-500/10">
                          <td className="px-3 py-2 text-center text-[12px] text-cyan-100/70">{i+1}</td>
                          <td className="px-3 py-2 text-center font-mono">
                            {kkCsv ? (
                              <>
                                <span className="opacity-60">,</span>
                                <span>{kkCsv.slice(1)}</span>
                              </>
                            ) : <span>{String(r.NO_KK)}</span>}
                          </td>
                          <td className="px-3 py-2">{r.NAMA_KEP}</td>

                          <td className="px-3 py-2 text-center space-y-1.5">
                            <div className="inline-flex items-center gap-2 text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10">
                              <StatusIcon className="opacity-80" size={12} />
                              <span className="font-semibold text-cyan-200">{S.text}</span>
                            </div>
                            {canRepush ? (
                              <button
                                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border border-cyan-800/40"
                                onClick={()=>window.open(`/check/kk/push?no_kk=${encodeURIComponent(String(r.NO_KK))}`,"_blank")}
                              >
                                <Rocket size={12} /> Ajukan Ulang
                              </button>
                            ) : null}
                          </td>

                          <td className="px-3 py-2 text-[12px] text-cyan-100/80">
                            {Number(r.JML_PENGAJUAN||0)>0 ? (
                              <div className="flex items-center gap-2"><Rocket size={12}/> Di Ajukan {r.JML_PENGAJUAN}x</div>
                            ) : null}
                            <div className="flex items-center gap-2"><Info size={12}/> Request Date : {r.REQ_DATE}</div>
                            <div className="flex items-center gap-2"><Info size={12}/> Request By : {r.REQ_BY}</div>
                            {r.APROVE_DATE !== "-" ? (
                              <div className="flex items-center gap-2"><Printer size={12}/> Di Aprove {r.APROVE_DATE}</div>
                            ) : null}
                          </td>

                          <td className="px-3 py-2 text-[12px] text-cyan-100/80">
                            <div className="flex items-center gap-2"><Printer size={12}/> Print Date : {r.PRINTED_DATE}</div>
                            <div className="ml-5 text-cyan-200/70">Print By : {r.PRINTED_BY}</div>
                            {Number(r.COUNT_KK||0)!==0 && r.PRINTED_BY!=="-" ? (
                              <div className="ml-5 text-emerald-300/80">Dicetak {r.COUNT_KK}x</div>
                            ) : null}
                          </td>

                          <td className="px-3 py-2 text-[12px]">{r.NAMA_KEC}</td>
                          <td className="px-3 py-2 text-[12px]">{r.NAMA_KEL}</td>
                          <td className="px-3 py-2 text-center text-[12px]">{r.NO_RW}</td>
                          <td className="px-3 py-2 text-center text-[12px]">{r.NO_RT}</td>
                          <td className="px-3 py-2 text-[12px]">{r.ALAMAT}</td>
                          <td className="px-3 py-2 text-center text-[12px]">{r.KODE_POS}</td>

                          <td className="px-3 py-2 text-center">
                            {canDownload ? (
                              <button
                                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border border-cyan-800/40"
                                onClick={()=>window.open(r.URL_DOWNLOAD,"_blank")}
                              >
                                <Download size={12}/> DOWNLOAD
                              </button>
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
