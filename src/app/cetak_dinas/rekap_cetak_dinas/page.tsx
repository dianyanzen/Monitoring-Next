"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CalendarRange, Loader2, Search, Trash2 } from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import { DataShell, LoadingBlank } from "@/components/ui/LoadingOverlay";
import DateRangePopup from "@/components/ui/DateRangePopup";

// Penting untuk tombol Excel di DataTable
import JSZip from "jszip";
if (typeof window !== "undefined") (window as any).JSZip = JSZip;

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => <LoadingBlank message="Menyiapkan tabel" subtext="harap tunggu" />,
});

type Row = {
  no: number;
  nama: string;
  nik: string;
  noKec: string;
  namaKec: string;
  tglCetak: string;
  reqBy: string;
  receiveBy: string;
  createdBy: string;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const isoToDMY = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}-${m}-${y}`;
};

export default function RekapCetakDinasPage() {
  const [start, setStart] = useState(() => iso(new Date()));
  const [end, setEnd] = useState(() => iso(new Date()));
  const [rangeErr, setRangeErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setRangeErr(end >= start ? null : "Rentang tanggal tidak valid");
  }, [start, end]);

  const columns = [
    { data: null, title: "No", className: "dt-body-center", render: (_: any, __: any, ___: any, meta: any) => meta.row + 1, width: "60px" },
    { data: "nama", title: "Nama" },
    { data: "nik", title: "NIK" },
    { data: "noKec", title: "No Kec" },
    { data: "namaKec", title: "Nama Kec" },
    { data: "tglCetak", title: "Tanggal Cetak" },
    { data: "reqBy", title: "Request" },
    { data: "receiveBy", title: "Receive" },
    { data: "createdBy", title: "Petugas Cetak" },
  ];

  const handleSearch = async () => {
    if (rangeErr) {
      setMessage("Perbaiki rentang tanggal terlebih dulu.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const body = {
        tgl_start: isoToDMY(start),
        tgl_end: isoToDMY(end),
      };
      const res = await fetch("/api/cetak_dinas/rekap_cetak_dinas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal mengambil rekap cetak dinas.");
      const items: Row[] = json?.data?.items ?? json?.items ?? [];
      setRows(Array.isArray(items) ? items : []);
      if (!items?.length) setMessage("No data available");
    } catch (e: any) {
      setRows([]);
      setMessage(e?.message || "Gagal mengambil data.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    const t = iso(new Date());
    setStart(t);
    setEnd(t);
    setRangeErr(null);
    setRows([]);
    setMessage(null);
  };

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[12%] top-[-20%] h-[900px] w-[900px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[10%] bottom-[-18%] h-[860px] w-[860px] rounded-full bg-fuchsia-600/12 blur-[200px]" />
      </div>

      <SettingPageHeader
        lead="Rekap Cetak Dinas"
        title="Rekap Cetak Dinas"
        description="Lihat rekap cetak dinas per rentang tanggal cetak."
      />

      <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_24px_#00ffff22] space-y-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
              <input type="checkbox" checked readOnly className="lux-checkbox" /> Tanggal Cetak
            </label>
            <div className="flex items-center gap-2">
              <DateRangePopup
                start={start}
                end={end}
                onChange={(s, e) => {
                  setStart(s);
                  setEnd(e);
                }}
                months={2}
                minWidth={700}
              />
              <span className="rounded-lg border border-cyan-700/40 bg-white/5 px-3 py-2 text-xs text-cyan-200/80 flex items-center gap-2">
                <CalendarRange className="h-4 w-4" /> {isoToDMY(start)} s/d {isoToDMY(end)}
              </span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={loading || !!rangeErr}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Mencari..." : "Search"}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-white/5 px-4 py-2 text-sm text-cyan-100/80 hover:bg-white/10"
            >
              <Trash2 className="h-4 w-4" /> Clear
            </button>
            <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
              Total: <span className="font-semibold text-cyan-50">{rows.length}</span>
            </span>
          </div>
        </div>
        {rangeErr ? <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">{rangeErr}</div> : null}
        {message ? <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">{message}</div> : null}
      </section>

      <section className="rounded-2xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl overflow-hidden">
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">Rekap Cetak Dinas</p>
              <h1 className="text-lg font-semibold text-cyan-100">Data Rekap</h1>
            </div>
          </div>
        </header>

        <div className="p-4">
          <DataShell loading={loading} hasData={rows.length > 0}>
            <JQDataTable
              id="dt-rekap-cetak-dinas"
              data={rows as any[]}
              minWidth={1000}
              pageLength={50}
              tableClassName="dt-cyberpunk"
              columns={columns}
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
                  { extend: "copy", text: "Copy" },
                  { extend: "csvHtml5", text: "CSV", bom: true },
                  { extend: "excelHtml5", text: "Excel" },
                  { extend: "print", text: "Print" },
                ],
                order: [[1, "asc"]],
              }}
            />
          </DataShell>
        </div>
      </section>
    </div>
  );
}
