// FILE: src/app/dashboard/userrekam/[user]/page.tsx
"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FileSpreadsheet, FileText, Search, Trash2 } from "lucide-react";
import DateRangePopup from "@/components/ui/DateRangePopup";

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => <div className="px-2 py-6 text-sm text-cyan-200/80">Memuat tabel…</div>,
});

type AnyRow = Record<string, unknown>;
type KecRow = { NAMA_KEC: string | null; JML: number | null };
type KelRow = { NAMA_KEC: string | null; NAMA_KEL: string | null; JML: number | null };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const todayISO = () => iso(new Date());
const toDisp = (s: string) => { const [y,m,d] = s.split("-"); return `${d}-${m}-${y}`; };
const monthEdges = (d = new Date()) => {
  const s = new Date(d.getFullYear(), d.getMonth(), 1);
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: iso(s), end: iso(e) };
};

const unwrap = (x: any): any[] => {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.data)) return x.data;
  if (Array.isArray(x?.data?.data)) return x.data.data;
  return [];
};

function ensureFooter(api: any, html: string): HTMLTableSectionElement {
  const table = api.table();
  let foot = table.footer() as HTMLTableSectionElement | null;
  if (!foot) {
    foot = document.createElement("tfoot");
    foot.innerHTML = html;
    (table.node() as HTMLElement).appendChild(foot);
  }
  return foot;
}

type ExportBodyFormatter = (data: any, row: number, col: number) => string;

const stripHtml = (input: any) => String(input ?? "").replace(/<[^>]+>/g, "");

const createCsvFormatter = (stringCols: number[] = []): ExportBodyFormatter => {
  const targets = new Set(stringCols);
  return (data, _row, col) => {
    const text = stripHtml(data).replace(/^[,\s]+/, "");
    if (!text) return "";
    if (!targets.has(col)) return text;
    return '="' + text.replace(/"/g, '""') + '"';
  };
};

const createExcelFormatter = (stringCols: number[] = [], prefix = "\u200B"): ExportBodyFormatter => {
  const targets = new Set(stringCols);
  return (data, _row, col) => {
    const text = stripHtml(data).replace(/^[,\s]+/, "");
    if (!text) return "";
    return targets.has(col) ? `${prefix}${text}` : text;
  };
};

const defaultExportFormatter: ExportBodyFormatter = (data) => stripHtml(data).replace(/^[,\s]+/, "");

const buildButtons = (
  filename: string | (() => string),
  formatters?: Partial<Record<"copy" | "csv" | "excel" | "print", ExportBodyFormatter>>,
) => {
  const getName = typeof filename === "function" ? filename : () => filename;
  return [
    {
      extend: "copyHtml5",
      text: "Copy",
      exportOptions: { format: { body: formatters?.copy ?? defaultExportFormatter } },
    },
    {
      extend: "csvHtml5",
      text: "CSV",
      bom: true,
      filename: () => getName(),
      exportOptions: { format: { body: formatters?.csv ?? defaultExportFormatter } },
    },
    {
      extend: "excelHtml5",
      text: "Excel",
      filename: () => getName(),
      exportOptions: { format: { body: formatters?.excel ?? defaultExportFormatter } },
    },
    {
      extend: "print",
      text: "Print",
      exportOptions: { format: { body: formatters?.print ?? defaultExportFormatter } },
    },
  ];
};

export default function userrekamDetailPage() {
  const { user } = useParams<{ user: string }>();
  const searchParams = useSearchParams();
  const [start, setStart] = useState(() => searchParams.get("start") ?? todayISO());
  const [end, setEnd] = useState(() => searchParams.get("end") ?? todayISO());
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [kec, setKec] = useState<KecRow[]>([]);
  const [kel, setKel] = useState<KelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const detailTableApiRef = useRef<any | null>(null);
  const exportMetaRef = useRef({ user, start, end });

  useEffect(() => {
    exportMetaRef.current = { user, start, end };
  }, [user, start, end]);

  const onDetailTableReady = useCallback((api: any | null) => {
    detailTableApiRef.current = api;
  }, []);

  const triggerExport = useCallback(
    (type: "csv" | "excel") => {
      if (!rows.length) return;
      const api = detailTableApiRef.current;
      if (!api || typeof api.button !== "function") return;
      const target = type === "csv" ? ".buttons-csv" : ".buttons-excel";
      const button = api.button(target);
      if (button && typeof button.trigger === "function") {
        button.trigger();
      }
    },
    [rows.length],
  );

  const label = useMemo(() => `(${toDisp(start)} - ${toDisp(end)})`, [start, end]);

  const load = useCallback(async (s?: string, e?: string) => {
    const startDate = s || start;
    const endDate = e || end;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);

    try {
      const [d, rkec, rkel] = await Promise.all([
        fetch(`/api/dashboard/userrekam/detail?user=${encodeURIComponent(user)}&start=${startDate}&end=${endDate}`, { cache:"no-store", signal: ac.signal }).then(r=>r.json()),
        fetch(`/api/dashboard/userrekam/detail/kec?user=${encodeURIComponent(user)}&start=${startDate}&end=${endDate}`, { cache:"no-store", signal: ac.signal }).then(r=>r.json()),
        fetch(`/api/dashboard/userrekam/detail/kel?user=${encodeURIComponent(user)}&start=${startDate}&end=${endDate}`, { cache:"no-store", signal: ac.signal }).then(r=>r.json()),
      ]);

      setRows(unwrap(d));
      setKec(unwrap(rkec));
      setKel(unwrap(rkel));
    } catch {
      if (!ac.signal.aborted) { setRows([]); setKec([]); setKel([]); }
    } finally {
      if (!ac.signal.aborted) { setLoading(false); setFirstLoad(false); }
    }
  }, [user, start, end]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (end < start) setEnd(start); }, [start, end]);

  function onClear() { const t = todayISO(); setStart(t); setEnd(t); }

  const csvFormatter = useMemo(() => createCsvFormatter([1, 2]), []);
  const excelFormatter = useMemo(() => createExcelFormatter([1, 2]), []);
  const detailButtons = useMemo(
    () =>
      buildButtons(
        () => {
          const meta = exportMetaRef.current;
          return `detail_${meta.user}_${meta.start}_${meta.end}`;
        },
        {
          csv: csvFormatter,
          excel: excelFormatter,
        },
      ),
    [csvFormatter, excelFormatter],
  );
  const detailOptions = useMemo(
    () => ({
      deferRender: true,
      order: [],
      buttons: detailButtons,
      initComplete: function () {
        const api = this.api();
        ensureFooter(
          api,
          `<tr>
            <th width="80%" colspan="20" style="text-align:center">Jumlah</th>
            <th width="20%" style="text-align:right"></th>
          </tr>`,
        );
      },
      footerCallback: function (_row: any, data: any) {
        const total = data.length;
        const api = this.api();
        const foot = ensureFooter(
          api,
          `<tr>
            <th width="80%" colspan="20" style="text-align:center">Jumlah</th>
            <th width="20%" style="text-align:right"></th>
          </tr>`,
        );
        const last = foot.querySelector("th:last-child");
        if (last) last.textContent = total.toLocaleString("id-ID");
      },
    }),
    [detailButtons],
  );

  return (
    <div className="page-userktp relative px-8 pb-8 pt-6 md:pt-8 text-gray-200 space-y-8 mt-5">
      {/* glow bg */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-15%] left-[15%] w-[1100px] h-[1100px] bg-cyan-500/15 blur-[220px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[18%] w-[1000px] h-[1000px] bg-fuchsia-600/12 blur-[190px] rounded-full" />
      </div>

      <section className="rounded-2xl border border-cyan-800/40 bg-[#0b0b1a]/80 backdrop-blur-xl shadow-[0_0_34px_#00ffff22] overflow-hidden">
        {/* header */}
        <header className="px-5 py-4 border-b border-cyan-900/50 flex items-center gap-3">
          <Link href="/dashboard/userrekam" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/20 bg-white/5 hover:bg-white/10 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="ml-auto flex items-center gap-2 text-cyan-200">
            <span className="text-sm opacity-80">Detail Perekaman:</span>
            <span className="px-2 py-1 rounded-md border border-cyan-400/40 bg-cyan-600/20 text-cyan-100 font-semibold shadow-[0_0_10px_#00ffff44]">
              {user}
            </span>
          </div>
        </header>

        {/* toolbar */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex flex-wrap items-center gap-3">
              <DateRangePopup start={start} end={end} onChange={(s,e)=>{setStart(s); setEnd(e);}} minWidth={700} months={2} />
              <span className="text-xs text-cyan-200/70">{label}</span>
              <div className="flex items-center gap-2">
                <Chip onClick={() => { const t=todayISO(); setStart(t); setEnd(t); }}>Today</Chip>
                <Chip onClick={() => { const d=new Date(); d.setDate(d.getDate()-1); const y=iso(d); setStart(y); setEnd(y); }}>Yesterday</Chip>
                <Chip onClick={() => { const to=todayISO(); const d=new Date(); d.setDate(d.getDate()-6); const fr=iso(d); setStart(fr); setEnd(to); }}>Last 7d</Chip>
                <Chip onClick={() => { const {start:ms,end:me}=monthEdges(); setStart(ms); setEnd(me); }}>This Month</Chip>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => load(start, end)} data-overlay-on-click className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600/25 hover:bg-cyan-600/40 border border-cyan-400/40 text-sm shadow-[0_0_14px_#00ffff55] transition-colors">
                <Search className="w-4 h-4" /> {loading && !firstLoad ? "Loading…" : "Search"}
              </button>
              <button onClick={onClear} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/20 text-sm transition-colors">
                <Trash2 className="w-4 h-4" /> Clear
              </button>
              <button onClick={() => triggerExport("csv")} disabled={!rows.length} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-cyan-400/30 text-sm transition-colors disabled:opacity-50">
                <FileText className="w-4 h-4" /> Export CSV
              </button>
              <button onClick={() => triggerExport("excel")} disabled={!rows.length} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-cyan-400/30 text-sm transition-colors disabled:opacity-50">
                <FileSpreadsheet className="w-4 h-4" /> Export Excel
              </button>
            </div>
          </div>
        </div>

        {/* panels */}
        <div className="p-4 space-y-6">
          {/* PER KECAMATAN */}
          <Panel title="PER KECAMATAN">
            {!!kec.length ? (
              <JQDataTable
                id="dt-kec"
                data={kec as any[]}
                minWidth={700}
                pageLength={25}
                tableClassName="dt-cyberpunk"
                columns={[
                  { data: null, title: "No", className: "dt-body-center",
                    render: (_:any, __:any, ___:any, meta:any) => meta.row + 1,
                    orderable: false, width: "64px"
                  },
                  { data: (r:any)=>r.NAMA_KEC ?? r.nama_kec, title:"Kecamatan", className:"dt-body-center" },
                  { data: (r:any)=>r.JML ?? r.jml, title:"Jumlah", className:"dt-body-right",
                    render:(v:any)=>v==null?"":Number(v).toLocaleString("id-ID"),
                  },
                ]}
                options={{
                  deferRender: true,
                  order: [[2,"desc"]],
                  initComplete: function () {
                    const api = this.api();
                    ensureFooter(api, `
                      <tr>
                        <th colspan="2" style="text-align:center; font-weight:600;">Jumlah</th>
                        <th style="text-align:right; font-weight:600;"></th>
                      </tr>
                    `);
                  },
                  footerCallback: function (_row:any, data:any) {
                    const total = data.reduce((a:number,b:any)=>a+(Number(b?.JML ?? b?.jml)||0),0);
                    const api = this.api();
                    const tableNode = api.table().node();
                    let tfoot = tableNode.querySelector("tfoot");
                    if (!tfoot) { tfoot = document.createElement("tfoot"); tableNode.appendChild(tfoot); }
                    tfoot.innerHTML = `
                      <tr>
                        <th colspan="2" style="text-align:center;font-weight:600;">Jumlah</th>
                        <th style="text-align:right;font-weight:600;">${total.toLocaleString("id-ID")}</th>
                      </tr>
                    `;
                    const scrollFoot = tableNode.closest('.dt-scroll')?.querySelector('.dt-scroll-foot tfoot');
                    if (scrollFoot) scrollFoot.innerHTML = tfoot.innerHTML;
                  }
                }}
              />
            ) : (
              <div className="px-2 py-6 text-sm text-cyan-200/80">
                {firstLoad ? "Memuat…" : `Tidak ada data pada rentang ${label}.`}
              </div>
            )}
          </Panel>

          {/* PER KELURAHAN */}
          <Panel title="PER KELURAHAN">
            {!!kel.length ? (
              <JQDataTable
                id="dt-kel"
                data={kel as any[]}
                minWidth={900}
                pageLength={25}
                tableClassName="dt-cyberpunk"
                columns={[
                  { data: null, title: "No", className: "dt-body-center",
                    render: (_:any, __:any, ___:any, meta:any) => meta.row + 1,
                    orderable: false, width: "64px"
                  },
                  { data: (r:any)=>r.NAMA_KEC ?? r.nama_kec, title:"Kecamatan", className:"dt-body-center" },
                  { data: (r:any)=>r.NAMA_KEL ?? r.nama_kel, title:"Kelurahan", className:"dt-body-center" },
                  { data: (r:any)=>r.JML ?? r.jml, title:"Jumlah", className:"dt-body-right",
                    render:(v:any)=>v==null?"":Number(v).toLocaleString("id-ID"),
                  },
                ]}
                options={{
                  deferRender: true,
                  order: [[3,"desc"]], // kolom JML
                  initComplete: function () {
                    const api = this.api();
                    ensureFooter(api, `
                      <tr>
                        <th colspan="3" style="text-align:center; font-weight:600;">Jumlah</th>
                        <th style="text-align:right; font-weight:600;"></th>
                      </tr>
                    `);
                  },
                  footerCallback: function (_row:any, data:any) {
                    const total = data.reduce((a:number,b:any)=>a+(Number(b?.JML ?? b?.jml)||0),0);
                    const api = this.api();
                    const tableNode = api.table().node();
                    let tfoot = tableNode.querySelector("tfoot");
                    if (!tfoot) { tfoot = document.createElement("tfoot"); tableNode.appendChild(tfoot); }
                    tfoot.innerHTML = `
                      <tr>
                        <th colspan="3" style="text-align:center;font-weight:600;">Jumlah</th>
                        <th style="text-align:right;font-weight:600;">${total.toLocaleString("id-ID")}</th>
                      </tr>
                    `;
                    const scrollFoot = tableNode.closest('.dt-scroll')?.querySelector('.dt-scroll-foot tfoot');
                    if (scrollFoot) scrollFoot.innerHTML = tfoot.innerHTML;
                  }
                }}
              />
            ) : (
              <div className="px-2 py-6 text-sm text-cyan-200/80">
                {firstLoad ? "Memuat…" : `Tidak ada data pada rentang ${label}.`}
              </div>
            )}
          </Panel>

          {/* DATA DETAIL */}
          <Panel title="DATA DETAIL">
            {rows.length ? (
              <JQDataTable
                id="dt-main"
                data={rows as any[]}
                minWidth={1800}
                pageLength={25}
                tableClassName="dt-cyberpunk"
                columns={[
                  { data: null, title: "No", className: "dt-body-center",
                    render: (_:any, __:any, ___:any, meta:any) => meta.row + 1,
                    orderable: false, width: "60px"
                  },
                  {
                    data: (r: any) => {
                      const id = r.CHIP_ID ?? r.chip_id;
                      if (!id) return "";
                      return `
                        <span style="color:rgba(255,63,173,.02)">,</span>
                        <span>${id}</span>
                      `;
                    },
                    title: "Chip ID",
                    className: "dt-body-center",
                    render: (data: any, type: any) => {
                      if (type === "display") return data;
                      const plainId = data?.replace(/<[^>]+>/g, "").trim();
                      return plainId || "";
                    }
                  },
                  {
                    data: (r: any) => {
                      const nik = r.NIK ?? r.nik;
                      if (!nik) return "";
                      return `
                        <span style="color:rgba(255,63,173,.02)">,</span>
                        <span>${nik}</span>
                      `;
                    },
                    title: "Nik",
                    className: "dt-body-center",
                    render: (data: any, type: any) => {
                      if (type === "display") return data;
                      const plainNik = data?.replace(/<[^>]+>/g, "").trim();
                      return plainNik || "";
                    }
                  },
                  { data: (r:any)=>r.NAMA_LENGKAP ?? r.nama_lengkap, title:"Nama Lengkap", className:"dt-body-center" },
                  { data: (r:any)=>r.TGL_LHR ?? r.tgl_lhr, title:"Tanggal Lahir", className:"dt-body-center" },
                  { data: (r:any)=>r.UMUR ?? r.umur, title:"Umur", className:"dt-body-right",
                    render:(v:any)=>v==null?"":Number(v).toLocaleString("id-ID") },
                  { data: (r:any)=>r.CURRENT_STATUS_CODE ?? r.current_status_code, title:"Status E-KTP", className:"dt-body-center" },
                  { data: (r:any)=>r.NAMA_KEC ?? r.nama_kec, title:"Nama Kecamatan", className:"dt-body-center" },
                  { data: (r:any)=>r.NAMA_KEL ?? r.nama_kel, title:"Nama Kelurahan", className:"dt-body-center" },
                  { data: (r:any)=>r.PRINTED_DATE ?? r.printed_date, title:"Print Date", className:"dt-body-center" },
                  { data: (r:any)=>r.PRINTED_HR ?? r.printed_hr, title:"Print Hour", className:"dt-body-center" },
                  { data: (r:any)=>r.PRINTED_BY ?? r.printed_by, title:"Print By" },
                  { data: (r:any)=>r.REQ_DATE ?? r.req_date, title:"Req Date", className:"dt-body-center" },
                  { data: (r:any)=>r.REQ_BY ?? r.req_by, title:"Req By" },
                  { data: (r:any)=>r.ALAMAT ?? r.alamat, title:"Alamat" },
                  { data: (r:any)=>r.RW ?? r.rw, title:"Rw", className:"dt-body-center" },
                  { data: (r:any)=>r.RT ?? r.rt, title:"Rt", className:"dt-body-center" },
                  { data: (r:any)=>r.KODE_POS ?? r.kode_pos, title:"Kode Pos", className:"dt-body-center" },
                  { data: (r:any)=>r.AGAMA ?? r.agama, title:"Agama", className:"dt-body-center" },
                  { data: (r:any)=>r.STAT_KWN ?? r.stat_kwn, title:"Status Kawin", className:"dt-body-center" },
                  { data: (r:any)=>r.JENIS_PKRJN ?? r.jenis_pkrjn, title:"Jenis Pekerjaan", className:"dt-body-center" },
                ]}
                options={detailOptions}
                onApiReady={onDetailTableReady}
              />
            ) : (
              <div className="px-2 py-6 text-sm text-cyan-200/80">
                {firstLoad ? "Memuat…" : `Tidak ada data pada rentang ${label}.`}
              </div>
            )}
          </Panel>
        </div>
      </section>
    </div>
  );
}

/* === UI Bits === */
function Chip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="chip text-xs px-2.5 py-1 rounded-md border border-cyan-700/40 bg-cyan-600/10 hover:bg-cyan-600/20 transition-colors">
      {children}
    </button>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <div className="px-4 py-2 border-b border-white/10 text-cyan-200 font-semibold">{title}</div>
      <div className="p-3">{children}</div>
    </section>
  );
}
