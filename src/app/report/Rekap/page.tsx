"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCcw,
  Search,
  Sparkles,
} from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import DateRangePopup from "@/components/ui/DateRangePopup";
import { DataShell } from "@/components/ui/LoadingOverlay";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";
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
  userId: string;
  nama?: string;
  tanggal: string; // ISO yyyy-mm-dd
  tanggalLabel: string;
  jamMasuk: string;
  jamKeluar: string;
  ip: string;
  sumber: string;
  keterangan: string;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  data?: any;
  recordsTotal?: number;
  recordsFiltered?: number;
};

const isoToday = () => new Date().toISOString().slice(0, 10);
const isoMonthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const isoToDMY = (iso?: string) => {
  if (!iso || iso.split("-").length !== 3) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

const normalizeIso = (raw?: string) => {
  if (!raw) return "";
  const parts = raw.split("-");
  if (parts.length === 3) {
    if (parts[0].length === 4) return raw; // already yyyy-mm-dd
    const [d, m, y] = parts;
    return `${y}-${m}-${d}`;
  }
  return raw;
};

export default function RekapAbsensiPage() {
  const { user } = useSession();
  const [start, setStart] = useState(() => isoMonthStart());
  const [end, setEnd] = useState(() => isoToday());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    open: boolean;
    kind: ModalKind;
    title: string;
    message: string;
  }>({
    open: false,
    kind: "info",
    title: "Rekap Absensi",
    message: "",
  });

  const rangeInvalid = useMemo(() => {
    const s = new Date(start);
    const e = new Date(end);
    return Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e;
  }, [start, end]);

  const summary = useMemo(() => {
    const totalRows = rows.length;
    const hadir = rows.filter((r) => r.jamMasuk && r.jamMasuk !== "-").length;
    return { totalRows, hadir };
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
      { data: "nama", title: "Nama Lengkap", width: "180px" },
      { data: "tanggalLabel", title: "Tanggal", width: "120px" },
      { data: "jamMasuk", title: "Jam Masuk", className: "dt-body-center", width: "110px" },
      { data: "jamKeluar", title: "Jam Keluar", className: "dt-body-center", width: "110px" },
      { data: "ip", title: "IP", width: "140px" },
      { data: "sumber", title: "Sumber", width: "140px" },
      { data: "keterangan", title: "Keterangan", width: "160px" },
    ],
    []
  );

  const mapRows = (items: any[]): Row[] =>
    items.map((item, idx) => {
      const tanggalIso = normalizeIso(item.tanggal || item.DAY || item.day || "");
      return {
        id: Number(item.id ?? idx + 1),
        userId: item.userId || item.USER_ID || user?.S_USER_ID || "",
        nama: item.nama || item.nama_lgkp || item.NAMA_LGKP || user?.S_NAMA_LGKP || "-",
        tanggal: tanggalIso,
        tanggalLabel: isoToDMY(tanggalIso) || item.tanggalLabel || item.DAY || "-",
        jamMasuk: item.jamMasuk || item.jam_masuk || item.JAM_MASUK || "-",
        jamKeluar: item.jamKeluar || item.jam_keluar || item.JAM_KELUAR || "-",
        ip: item.ip || item.IP || item.ipAddress || "-",
        sumber: item.sumber || item.SUMBER || item.source || "Monitoring",
        keterangan: item.keterangan || item.KETERANGAN || "-",
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
      const res = await fetch("/api/report/rekap-absensi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ start, end, userId: user?.S_USER_ID }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Gagal memuat rekap absensi");
      }
      const rawItems = Array.isArray(json.data)
        ? json.data
        : Array.isArray((json.data as any)?.items)
        ? (json.data as any).items
        : [];
      const mapped = mapRows(rawItems);
      setRows(mapped);
      if (!mapped.length) setMessage("Tidak ada data untuk rentang ini.");
    } catch (e: any) {
      const msg = e?.message || "Gagal memuat rekap absensi";
      setRows([]);
      setError(msg);
      setModal({
        open: true,
        kind: "error",
        title: "Rekap Absensi",
        message: msg,
      });
    } finally {
      setLoading(false);
      setReloading(false);
    }
  };

  useEffect(() => {
    void fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rangeLabel = `${isoToDMY(start)} s/d ${isoToDMY(end)}`;

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      {modal.open && (
        <NeonModal
          open={modal.open}
          kind={modal.kind}
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
        lead="Absensi"
        title="Rekap Absensi"
        description="Lihat rekap jam masuk/keluar harian tanpa perlu membuka halaman legacy."
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
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Total Kehadiran</p>
            <div className="text-lg font-semibold">{summary.hadir} hari</div>
            <div className="text-xs text-cyan-200/70">Baris dengan jam masuk terisi</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-white/5 px-4 py-3 text-sm text-cyan-50 shadow-[0_10px_30px_rgba(0,255,255,0.08)]">
          <Activity className="h-5 w-5 text-emerald-300" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Total Data</p>
            <div className="text-lg font-semibold">{summary.totalRows}</div>
            <div className="text-xs text-cyan-200/70">Jumlah baris di tabel</div>
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
                setStart(isoMonthStart());
                setEnd(today);
                setRows([]);
                setMessage(null);
                setError(null);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-50 hover:bg-amber-500/20"
            >
              <RefreshCcw className="h-4 w-4" /> Clear
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
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">Rekap Absensi</p>
            <h1 className="text-lg font-semibold text-cyan-100">Data Rekap</h1>
          </div>
          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
            Total: <span className="font-semibold text-cyan-50">{rows.length}</span>
          </span>
        </header>

        <div className="p-4">
          <DataShell loading={loading || reloading} hasData={rows.length > 0}>
            <JQDataTable
              id="dt-rekap-absensi"
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
                order: [[3, "desc"]],
              }}
            />
          </DataShell>
        </div>
      </section>
    </div>
  );
}
