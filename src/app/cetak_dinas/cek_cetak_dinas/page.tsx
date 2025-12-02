"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Loader2, Search, Trash2 } from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import { DataShell, LoadingBlank } from "@/components/ui/LoadingOverlay";

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
};

function sanitizeNikInput(raw: string) {
  return raw.replace(/[^0-9,]/g, "").replace(/,+/g, ",").replace(/(^,|,$)/g, "");
}

export default function CekCetakDinasPage() {
  const [nikInput, setNikInput] = useState("");
  const [namaInput, setNamaInput] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const columns = [
    { data: null, title: "No", className: "dt-body-center", render: (_: any, __: any, ___: any, meta: any) => meta.row + 1, width: "60px" },
    { data: "nama", title: "Nama" },
    { data: "nik", title: "NIK" },
    { data: "noKec", title: "No Kec" },
    { data: "namaKec", title: "Nama Kec" },
    { data: "tglCetak", title: "Tanggal Cetak" },
    { data: "reqBy", title: "Request" },
    { data: "receiveBy", title: "Receive" },
  ];

  const handleSearch = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const body: any = {};
      const nikSanitized = sanitizeNikInput(nikInput);
      if (nikSanitized) body.nik = nikSanitized;
      const namaSanitized = namaInput.trim().toUpperCase();
      if (namaSanitized) body.nama = namaSanitized;

      const res = await fetch("/api/cetak_dinas/cek_cetak_dinas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      const items: Row[] = json?.data?.items ?? json?.items ?? [];
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal mengambil data.");
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
    setNikInput("");
    setNamaInput("");
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
        lead="Pencarian Cetak Dinas"
        title="Cek Cetak Dinas"
        description="Cari data cetak dinas berdasarkan NIK (pisahkan dengan koma) atau nama."
      />

      <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_24px_#00ffff22] space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">NIK (opsional)</label>
            <input
              value={nikInput}
              onChange={(e) => setNikInput(sanitizeNikInput(e.target.value))}
              placeholder="Pisahkan dengan koma"
              className="mt-1 w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Nama (opsional)</label>
            <input
              value={namaInput}
              onChange={(e) => setNamaInput(e.target.value.toUpperCase())}
              placeholder="Nama lengkap / sebagian"
              className="mt-1 w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSearch()}
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
          <span className="ml-auto rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
            Total: <span className="font-semibold text-cyan-50">{rows.length}</span>
          </span>
        </div>

        {message ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">{message}</div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl overflow-hidden">
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">Data Cetak Dinas</p>
              <h1 className="text-lg font-semibold text-cyan-100">Hasil Pencarian</h1>
            </div>
          </div>
        </header>

        <div className="p-4">
          <DataShell loading={loading} hasData={rows.length > 0}>
            <JQDataTable
              id="dt-cek-cetak-dinas"
              data={rows as any[]}
              minWidth={900}
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
