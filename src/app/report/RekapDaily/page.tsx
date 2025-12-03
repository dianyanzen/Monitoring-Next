"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivitySquare,
  AlertCircle,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import DateRangePopup from "@/components/ui/DateRangePopup";
import { DataShell } from "@/components/ui/LoadingOverlay";
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
  id: number;
  dailyId?: number;
  userId: string;
  userName?: string;
  tanggal: string; // ISO yyyy-mm-dd
  tanggalLabel: string;
  activity: string;
  description: string;
  start: string;
  end: string;
  jam: string;
  jumlah: number;
  menit: number;
  menitLabel: string;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  data?: { items?: Row[]; recordsTotal?: number; recordsFiltered?: number };
};

const isoToday = () => new Date().toISOString().slice(0, 10);
const isoToDMY = (iso?: string) => {
  if (!iso || iso.split("-").length !== 3) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

export default function RekapDailyPage() {
  const { user } = useSession();
  const [start, setStart] = useState(() => isoToday());
  const [end, setEnd] = useState(() => isoToday());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const tableContainerRef = useRef<HTMLElement | null>(null);

  const rangeInvalid = useMemo(() => {
    const s = new Date(start);
    const e = new Date(end);
    return Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e;
  }, [start, end]);

  const summary = useMemo(() => {
    const totalJumlah = rows.reduce((acc, r) => acc + (Number(r.jumlah) || 0), 0);
    const totalMenit = rows.reduce((acc, r) => acc + (Number(r.menit) || 0), 0);
    return { totalJumlah, totalMenit };
  }, [rows]);

  const columns = useMemo(
    () => [
      {
        data: null,
        title: "No",
        className: "dt-body-center",
        orderable: false,
        width: "55px",
        render: (_: any, __: any, ___: any, meta: any) => meta.row + 1,
      },
      { data: "userId", title: "User ID", width: "120px" },
      { data: "tanggalLabel", title: "Tanggal", width: "120px" },
      { data: "activity", title: "Aktivitas", width: "180px" },
      { data: "description", title: "Deskripsi", width: "240px" },
      { data: "jam", title: "Jam", width: "140px" },
      { data: "jumlah", title: "Jumlah", className: "dt-body-center", width: "80px" },
      { data: "menitLabel", title: "Menit Aktivitas", className: "dt-body-center", width: "120px" },
      {
        data: null,
        title: "Action",
        orderable: false,
        className: "dt-body-center",
        width: "120px",
        render: (_: any, __: any, row: Row) =>
          `<button class="btn-delete-daily inline-flex items-center gap-2 rounded-lg border border-rose-400/60 bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-50 transition hover:bg-rose-500/25" data-daily-id="${row.id}" data-daily-label="${row.activity || row.tanggalLabel}">Delete</button>`,
      },
    ],
    []
  );

  const detachTableClick = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.removeEventListener("click", onTableClick as any);
      tableContainerRef.current = null;
    }
  };

  const onTableClick = (ev: MouseEvent) => {
    const target = ev.target as HTMLElement;
    const btn = target.closest("[data-daily-id]") as HTMLElement | null;
    if (!btn) return;
    const id = Number(btn.getAttribute("data-daily-id") || "0");
    const label = btn.getAttribute("data-daily-label") || "";
    if (!id || Number.isNaN(id)) return;
    void handleDelete(id, label);
  };

  const handleApiReady = (api: any | null) => {
    if (!api) {
      detachTableClick();
      return;
    }
    const container = api.table().container() as HTMLElement;
    if (tableContainerRef.current && tableContainerRef.current !== container) {
      tableContainerRef.current.removeEventListener("click", onTableClick as any);
    }
    tableContainerRef.current = container;
    container.addEventListener("click", onTableClick as any);
  };

  const mapRows = (items: any[]): Row[] =>
    items.map((item, idx) => {
      const tanggalIso = item.tanggal || item.TANGGAL || item.TANGGAL_ISO || "";
      const startAct = item.start || item.start_activity || item.startActivity || "";
      const endAct = item.end || item.end_activity || item.endActivity || "";
      const menitRaw = item.menit ?? item.MINUTE_TOTAL ?? item.minute_total;
      return {
        id: Number(item.id ?? item.dailyId ?? item.DAILY_ID ?? idx + 1),
        dailyId: Number(item.dailyId ?? item.DAILY_ID ?? idx + 1),
        userId: item.userId || item.USER_ID || user?.S_USER_ID || "",
        userName: item.userName || item.NAMA_DPN || "",
        tanggal: tanggalIso,
        tanggalLabel: item.tanggalLabel || item.TANGGAL_DMY || isoToDMY(tanggalIso) || "-",
        activity: item.activity || item.ACTIVITY || "LAINNYA",
        description: item.description || item.DESCRIPTION || "-",
        start: startAct,
        end: endAct,
        jam: item.jam || `${startAct} - ${endAct}`.trim(),
        jumlah: Number(item.jumlah ?? item.NUMBER_ACTIVITY ?? 0),
        menit: Number(menitRaw ?? 0),
        menitLabel: item.menitLabel || item.MINUTE_LABEL || `${Number(menitRaw ?? 0)} Menit`,
      };
    });

  const fetchRows = async (withOverlay = true) => {
    if (rangeInvalid) {
      setError("Rentang tanggal tidak valid");
      setRows([]);
      return;
    }
    setMessage(null);
    setError(null);
    withOverlay ? setLoading(true) : setReloading(true);
    try {
      const res = await fetch("/api/report/rekap-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ start, end }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Gagal memuat rekap daily");
      }
      const rawItems = Array.isArray(json.data?.items)
        ? json.data.items!
        : Array.isArray(json.data)
        ? (json.data as any[])
        : [];
      const mapped = mapRows(rawItems);
      setRows(mapped);
      if (!mapped.length) setMessage("Tidak ada data untuk rentang ini.");
    } catch (e: any) {
      setRows([]);
      setError(e?.message || "Gagal memuat rekap daily");
    } finally {
      setLoading(false);
      setReloading(false);
    }
  };

  const handleDelete = async (id: number, label: string) => {
    const note = label ? `"${label}"` : `ID ${id}`;
    const sure = window.confirm(`Apakah Anda yakin ingin menghapus daily report ${note}?`);
    if (!sure) return;
    setDeletingId(id);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/report/rekap-daily/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menghapus daily report");
      setMessage(json.message || "Daily report berhasil dihapus");
      await fetchRows(false);
    } catch (e: any) {
      setError(e?.message || "Gagal menghapus daily report");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    void fetchRows();
    return () => detachTableClick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rangeLabel = `${isoToDMY(start)} s/d ${isoToDMY(end)}`;

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[12%] top-[-18%] h-[900px] w-[900px] rounded-full bg-cyan-500/12 blur-[220px]" />
        <div className="absolute right-[10%] bottom-[-18%] h-[860px] w-[860px] rounded-full bg-fuchsia-600/10 blur-[200px]" />
      </div>

      <SettingPageHeader
        lead="Daily Report"
        title="Rekap Daily Activity"
        description="Lihat dan kelola rekap daily report Anda langsung di dalam Monalisa tanpa perlu membuka halaman legacy."
      />

      <section className="grid gap-3 rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_28px_#00ffff22] md:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-white/5 px-4 py-3 text-sm text-cyan-50 shadow-[0_10px_30px_rgba(0,255,255,0.08)]">
          <Sparkles className="h-5 w-5 text-amber-300" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">User</p>
            <div className="font-semibold">{user?.S_NAMA_LGKP || "-"}</div>
            <div className="text-xs text-cyan-200/70">{user?.S_USER_ID || "-"}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-white/5 px-4 py-3 text-sm text-cyan-50 shadow-[0_10px_30px_rgba(0,255,255,0.08)]">
          <Clock3 className="h-5 w-5 text-cyan-300" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Total Menit</p>
            <div className="text-lg font-semibold">{summary.totalMenit} menit</div>
            <div className="text-xs text-cyan-200/70">Akumulasi durasi aktivitas</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-white/5 px-4 py-3 text-sm text-cyan-50 shadow-[0_10px_30px_rgba(0,255,255,0.08)]">
          <ActivitySquare className="h-5 w-5 text-emerald-300" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Total Aktivitas</p>
            <div className="text-lg font-semibold">{summary.totalJumlah}</div>
            <div className="text-xs text-cyan-200/70">Jumlah aktivitas di tabel</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_28px_#00ffff22] space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <DateRangePopup
              start={start}
              end={end}
              months={2}
              minWidth={720}
              onChange={(s, e) => {
                setStart(s);
                setEnd(e);
              }}
            />
            <span className="inline-flex items-center gap-2 rounded-lg border border-cyan-700/40 bg-white/5 px-3 py-2 text-xs text-cyan-200/80">
              <CalendarRange className="h-4 w-4" /> {rangeLabel}
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchRows()}
              disabled={loading || rangeInvalid}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Mencari..." : "Search"}
            </button>
            <button
              type="button"
              onClick={() => void fetchRows(false)}
              disabled={reloading || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-white/5 px-4 py-2 text-sm text-cyan-100/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {reloading ? "Reload..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => {
                const today = isoToday();
                setStart(today);
                setEnd(today);
                setRows([]);
                setMessage(null);
                setError(null);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-50 hover:bg-amber-500/20"
            >
              <Trash2 className="h-4 w-4" /> Clear
            </button>
          </div>
        </div>

        {rangeInvalid ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
            <AlertCircle className="h-4 w-4" /> Periksa kembali rentang tanggal.
          </div>
        ) : null}
        {message ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
            <CheckCircle2 className="h-4 w-4" /> {message}
          </div>
        ) : null}
        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl overflow-hidden">
        <header className="flex flex-wrap items-center gap-3 border-b border-cyan-900/50 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">Rekap Daily Activity</p>
            <h1 className="text-lg font-semibold text-cyan-100">Data Rekap</h1>
          </div>
          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
            Total: <span className="font-semibold text-cyan-50">{rows.length}</span>
          </span>
          {deletingId ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-[11px] text-rose-100/80">
              <Loader2 className="h-3 w-3 animate-spin" /> Menghapus...
            </span>
          ) : null}
        </header>

        <div className="p-4">
          <DataShell loading={loading || reloading} hasData={rows.length > 0}>
            <JQDataTable
              id="dt-rekap-daily"
              data={rows as any[]}
              minWidth={1100}
              pageLength={50}
              tableClassName="dt-cyberpunk"
              columns={columns}
              onApiReady={handleApiReady}
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
                order: [[2, "desc"]],
              }}
            />
          </DataShell>
        </div>
      </section>
    </div>
  );
}
