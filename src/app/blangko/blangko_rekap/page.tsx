"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCcw, Search, Trash2 } from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import DateRangePopup from "@/components/ui/DateRangePopup";
import { DataShell, LoadingBlank } from "@/components/ui/LoadingOverlay";

// For Excel export
import JSZip from "jszip";
if (typeof window !== "undefined") (window as any).JSZip = JSZip;

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => <LoadingBlank message="Menyiapkan tabel" subtext="harap tunggu" />,
});

type Row = {
  NO_WIL: string;
  NAMA_WIL: string;
  AMBIL: number;
  RUSAK: number;
  PENGEMBALIAN: number;
  TOTAL: number;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const todayISO = () => iso(new Date());
const isoToDMY = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}-${m}-${y}`;
};
const toNumber = (v: any) => Number(v ?? 0) || 0;

export default function BlangkoRekapPage() {
  const [start, setStart] = useState<string>(todayISO());
  const [end, setEnd] = useState<string>(todayISO());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(
    () => [
      { data: "NO_WIL", title: "No Wil", className: "dt-body-center", width: "90px" },
      { data: "NAMA_WIL", title: "Nama Wilayah", width: "240px" },
      { data: "AMBIL", title: "Pengambilan", className: "dt-body-right", width: "140px", render: (val: any) => toNumber(val).toLocaleString("id-ID") },
      { data: "RUSAK", title: "Rusak", className: "dt-body-right", width: "140px", render: (val: any) => toNumber(val).toLocaleString("id-ID") },
      { data: "PENGEMBALIAN", title: "Pengembalian", className: "dt-body-right", width: "140px", render: (val: any) => toNumber(val).toLocaleString("id-ID") },
      { data: "TOTAL", title: "Total", className: "dt-body-right", width: "140px", render: (val: any) => toNumber(val).toLocaleString("id-ID") },
    ],
    []
  );

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        ambil: acc.ambil + toNumber(r.AMBIL),
        rusak: acc.rusak + toNumber(r.RUSAK),
        pengembalian: acc.pengembalian + toNumber(r.PENGEMBALIAN),
        total: acc.total + toNumber(r.TOTAL),
      }),
      { ambil: 0, rusak: 0, pengembalian: 0, total: 0 }
    );
  }, [rows]);

  const runSearch = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/blangko/rekap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ start: isoToDMY(start), end: isoToDMY(end) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat rekap blangko");
      const items: Row[] = json.data?.items ?? json.items ?? [];
      setRows(items);
      if (!items.length) setMessage("Data tidak ditemukan.");
    } catch (e: any) {
      setRows([]);
      setError(e?.message || "Gagal memuat rekap blangko");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    const t = todayISO();
    setStart(t);
    setEnd(t);
    setRows([]);
    setMessage(null);
    setError(null);
  };

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[-20%] h-[880px] w-[880px] rounded-full bg-cyan-500/20 blur-[220px]" />
        <div className="absolute right-[8%] bottom-[-18%] h-[820px] w-[820px] rounded-full bg-fuchsia-600/12 blur-[200px]" />
      </div>

      <SettingPageHeader lead="Kendali Blangko" title="Rekap Blangko KTP Keluar" description="Rekap pengambilan blangko per wilayah dalam rentang tanggal." />

      <section className="rounded-2xl border border-cyan-800/50 bg-[#0b0f1c]/80 p-4 shadow-[0_0_24px_#00ffff22]">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
            <input type="checkbox" checked readOnly className="lux-checkbox" /> Tanggal Pengambilan
          </label>
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

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={loading}
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
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                runSearch().finally(() => setLoading(false));
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
            >
              <RefreshCcw className="h-4 w-4" /> Reload
            </button>
          </div>
        </div>

        {message ? (
          <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">{message}</div>
        ) : null}
        {error ? (
          <div className="mt-3 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">{error}</div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-cyan-900/50 bg-[#0a0d15]/70 shadow-inner shadow-cyan-500/10 p-4">
          <DataShell loading={loading} hasData={rows.length > 0}>
            <JQDataTable
              id="dt-blangko-rekap"
              data={rows as any[]}
              minWidth={900}
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
                footerCallback: function () {
                  const table = this.api();
                  const footHtml = `
                    <tr>
                      <th colspan="4" style="text-align:right;">${totals.ambil.toLocaleString("id-ID")}</th>
                      <th style="text-align:right;">${totals.rusak.toLocaleString("id-ID")}</th>
                      <th style="text-align:right;">${totals.pengembalian.toLocaleString("id-ID")}</th>
                      <th style="text-align:right;">${totals.total.toLocaleString("id-ID")}</th>
                    </tr>
                  `;
                  let foot = table.table().footer();
                  if (!foot) {
                    foot = document.createElement("tfoot");
                    (table.table().node() as HTMLElement).appendChild(foot);
                  }
                  (foot as HTMLElement).innerHTML = footHtml;
                  const scrollFoot = (table.table().node() as HTMLElement).closest(".dt-scroll")?.querySelector(".dt-scroll-foot tfoot");
                  if (scrollFoot) (scrollFoot as HTMLElement).innerHTML = footHtml;
                },
              }}
            />
          </DataShell>
        </div>
      </section>
    </div>
  );
}
