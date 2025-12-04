"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Loader2, RefreshCcw } from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import { DataShell } from "@/components/ui/LoadingOverlay";
import NeonModal from "@/components/ui/NeonModal";
import { useSession } from "@/contexts/session";

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => (
    <div className="px-4 py-5 text-sm text-cyan-100/70">
      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
      Menyiapkan tabel...
    </div>
  ),
});

type Row = {
  no: number;
  userId: string;
  nama: string;
  aktivitas: string;
  task: string;
  jumlahAktivitas: string;
};

const todayMonthYear = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

export default function LaporanDailyClient() {
  useSession(); // ensure session context
  const [period, setPeriod] = useState(() => todayMonthYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: "Laporan Daily",
    message: "",
  });

  const columns = useMemo(
    () => [
      { data: "no", title: "No", className: "dt-body-center", width: "50px" },
      { data: "userId", title: "User ID", width: "120px" },
      { data: "nama", title: "Nama", width: "180px" },
      { data: "aktivitas", title: "Kategori Input", className: "dt-body-center", width: "140px" },
      { data: "task", title: "Jumlah Task", className: "dt-body-center", width: "120px" },
      { data: "jumlahAktivitas", title: "Jumlah Aktivitas", className: "dt-body-center", width: "140px" },
      {
        data: null,
        title: "Action",
        className: "dt-body-center",
        width: "110px",
        render: (_: unknown, __: unknown, row: Row) => {
          const url = `/report/laporandaily/${encodeURIComponent(row.userId)}?period=${encodeURIComponent(period)}`;
          return `<a class="inline-flex items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20" href="${url}" target="_blank" rel="noopener">Detail</a>`;
        },
      },
    ],
    [period]
  );

  const fetchRows = useCallback(
    async (withOverlay = true) => {
      setError(null);
      setMessage(null);
      withOverlay ? setLoading(true) : setReloading(true);
      try {
        const res = await fetch("/api/report/laporandaily", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tanggal: period }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat laporan daily");
        const items: Row[] = Array.isArray(json.data) ? json.data : [];
        setRows(items);
        if (!items.length) setMessage("Tidak ada data untuk periode ini.");
      } catch (e: any) {
        const msg = e?.message || "Gagal memuat laporan daily";
        setError(msg);
        setRows([]);
        setModal({ open: true, title: "Laporan Daily", message: msg });
      } finally {
        setLoading(false);
        setReloading(false);
      }
    },
    [period]
  );

  useEffect(() => {
    void fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void fetchRows();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fetchRows]);

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      {modal.open && (
        <NeonModal
          open={modal.open}
          title={modal.title}
          message={modal.message}
          onClose={() => setModal((prev) => ({ ...prev, open: false }))}
        />
      )}

      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[-18%] h-[900px] w-[900px] rounded-full bg-cyan-500/12 blur-[220px]" />
        <div className="absolute right-[12%] bottom-[-18%] h-[860px] w-[860px] rounded-full bg-fuchsia-600/10 blur-[200px]" />
      </div>

      <SettingPageHeader
        lead="Report"
        title="Rekap Laporan Activity"
        description="Ringkasan daily activity per user untuk periode tertentu."
      />

      <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_28px_#00ffff22] space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Tanggal (MM-YYYY)</label>
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-32 rounded-lg border border-cyan-700/40 bg-white/5 px-3 py-2 text-sm text-cyan-100 outline-none ring-0"
              placeholder="MM-YYYY"
            />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchRows()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {loading ? "Memuat..." : "Refresh"}
            </button>
          </div>
        </div>
        {message ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
            <Calendar className="h-4 w-4" /> {message}
          </div>
        ) : null}
        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
            <Calendar className="h-4 w-4" /> {error}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl overflow-hidden">
        <header className="flex flex-wrap items-center gap-3 border-b border-cyan-900/50 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">Rekap Activity</p>
            <h1 className="text-lg font-semibold text-cyan-100">Data Rekap</h1>
          </div>
          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
            Total: <span className="font-semibold text-cyan-50">{rows.length}</span>
          </span>
          {reloading ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
              <Loader2 className="h-3 w-3 animate-spin" /> Memuat...
            </span>
          ) : null}
        </header>
        <div className="p-4">
          <DataShell loading={loading || reloading} hasData={rows.length > 0}>
            <JQDataTable
              id="dt-laporan-daily"
              data={rows as any[]}
              minWidth={1100}
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
                dom:
                  "<'dt-top-bar flex items-center justify-between gap-3'<'dt-left flex items-center gap-2'Bl><'dt-right ml-auto'f>>" +
                  "rt" +
                  "<'dt-bottom-bar flex items-center justify-between gap-3'<'dt-info'i><'dt-paging'p>>",
                language: {
                  search: "",
                  searchPlaceholder: "Search...",
                  lengthMenu: "Tampilkan _MENU_ data",
                  info: "Menampilkan _START_-_END_ dari _TOTAL_ data",
                  infoEmpty: "Menampilkan 0 data",
                  paginate: { previous: "<", next: ">" },
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
