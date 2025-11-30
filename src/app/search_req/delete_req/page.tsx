"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Loader2, RefreshCcw, Search, Trash2, XCircle } from "lucide-react";
import { DataShell, LoadingBlank } from "@/components/ui/LoadingOverlay";

// For Excel export
import JSZip from "jszip";
if (typeof window !== "undefined") (window as any).JSZip = JSZip;

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => <LoadingBlank message="Menyiapkan tabel" subtext="harap tunggu" />,
});

type Row = {
  NO_KEC: string;
  NIK: string;
  NAMA_LENGKAP: string;
  CURRENT_STATUS_CODE: string;
  REQ_DATE: string;
  REQ_BY: string;
  PRINTED_DATE: string;
  PRINTED_BY: string;
  STATUS_PENGAJUAN: string;
  KETERANGAN_STATUS: string;
  NAMA_KEC: string;
  NAMA_KEL: string;
};

const sanitizeNikInput = (value: string) => value.replace(/[^\d,]/g, "").replace(/,+/g, ",").replace(/(^,|,$)/g, "");

export default function DeleteReqPage() {
  const [nikInput, setNikInput] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const columns = useMemo(
    () => [
      { data: null, title: "No", className: "dt-body-center", render: (_: any, __: any, ___: any, meta: any) => meta.row + 1, orderable: false, width: "60px" },
      { data: "NIK", title: "NIK", className: "dt-body-center", width: "170px", render: (val: any, type: any) => (type === "display" ? `<span style="color:rgba(255,63,173,.02)">,</span><span>${val}</span>` : val) },
      { data: "NAMA_LENGKAP", title: "Nama Lengkap", width: "220px" },
      { data: "CURRENT_STATUS_CODE", title: "Status KTP", className: "dt-body-center", width: "140px" },
      { data: "REQ_DATE", title: "Req Date", className: "dt-body-center", width: "120px" },
      { data: "REQ_BY", title: "Req By", className: "dt-body-center", width: "120px" },
      { data: "PRINTED_DATE", title: "Print Date", className: "dt-body-center", width: "120px" },
      { data: "PRINTED_BY", title: "Print By", className: "dt-body-center", width: "120px" },
      { data: "STATUS_PENGAJUAN", title: "Status Pengajuan", className: "dt-body-center", width: "150px" },
      { data: "KETERANGAN_STATUS", title: "Keterangan Pengajuan", className: "dt-body-center", width: "180px" },
      { data: "NAMA_KEC", title: "Nama Kecamatan", width: "180px" },
      { data: "NAMA_KEL", title: "Nama Kelurahan", width: "200px" },
    ],
    []
  );

  const runSearch = async () => {
    const nik = sanitizeNikInput(nikInput);
    setNikInput(nik);
    if (!nik) {
      setError("NIK wajib diisi (boleh koma).");
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/search_req/delete_req", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nik }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal mengambil data");
      const items = Array.isArray(json.data?.items) ? json.data.items : json.items ?? [];
      setRows(items);
      if (!items.length) setMessage("Data tidak ditemukan.");
    } catch (e: any) {
      setRows([]);
      setError(e?.message || "Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  };

  const runDelete = async () => {
    if (!rows.length) {
      setError("Tidak ada data untuk dihapus.");
      return;
    }
    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      const nikList = rows.map((r) => r.NIK).join(",");
      const res = await fetch("/api/search_req/do_delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nik: nikList }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menghapus pengajuan");
      setMessage(json.message || "Berhasil menghapus pengajuan");
      setRows([]);
    } catch (e: any) {
      setError(e?.message || "Gagal menghapus pengajuan");
    } finally {
      setDeleting(false);
    }
  };

  const clearAll = () => {
    setNikInput("");
    setRows([]);
    setMessage(null);
    setError(null);
  };

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
              <h1 className="text-lg font-semibold text-cyan-100">Delete Pengajuan Bermasalah</h1>
              <p className="text-sm text-cyan-200/70">Masukkan NIK (pisahkan dengan koma) untuk menampilkan pengajuan yang akan dihapus.</p>
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
          <section className="rounded-xl border border-cyan-800/40 bg-[#0c1220]/50 p-4 space-y-3">
            <form
              className="flex flex-wrap items-center gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void runSearch();
              }}
            >
              <label className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-[#0c1220]/70 px-4 py-2 text-sm text-cyan-100">
                <input type="checkbox" checked readOnly className="lux-checkbox" /> NIK
              </label>
              <input
                value={nikInput}
                onChange={(e) => setNikInput(sanitizeNikInput(e.target.value))}
                placeholder="Masukkan NIK, pisahkan dengan koma (maks 1000)"
                className="flex-1 min-w-[320px] rounded-lg border border-cyan-800/60 bg-[#0c1220]/70 px-3 py-2 text-sm text-cyan-100 outline-none focus:border-cyan-400/60"
              />

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading || deleting}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {loading ? "Mencari..." : "Search"}
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-white/5 px-4 py-2 text-sm text-cyan-100/80 hover:bg-white/10"
                >
                  <Trash2 className="h-4 w-4" /> Clear
                </button>
              </div>
            </form>

            {message ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                <XCircle className="h-4 w-4" />
                {error}
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-[0_0_24px_#f59e0b22] space-y-3">
            <div className="flex items-center gap-2 text-amber-50">
              <XCircle className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">Perhatian sebelum hapus</h3>
                <p className="text-xs text-amber-100/80">Sistem akan menghapus semua pengajuan (STEP_PROC &lt;&gt; C) untuk NIK yang tampil di tabel.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void runDelete()}
              disabled={deleting || loading || rows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-500/50 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-50 shadow-[0_0_18px_#f43f5e33] transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Hapus Pengajuan
            </button>
          </section>

          <section className="rounded-2xl border border-cyan-900/50 bg-[#0a0d15]/70 shadow-inner shadow-cyan-500/10 p-4">
            <DataShell loading={loading} hasData={rows.length > 0}>
              <JQDataTable
                id="dt-delete-req"
                data={rows as any[]}
                minWidth={1400}
                pageLength={100}
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
                  order: [[4, "desc"]],
                }}
              />
            </DataShell>
          </section>
        </div>
      </section>
    </div>
  );
}
