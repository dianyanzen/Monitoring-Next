"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
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
  nama: string;
  activity: string;
  description: string;
  tanggal: string;
  tanggalLabel: string;
  status: number; // 0 menunggu, 1 setuju, 2 tolak
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  data?: { items?: Row[]; recordsTotal?: number; recordsFiltered?: number };
};

type UserOption = { id: string; label: string };

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

const statusLabel = (v: number) => {
  if (v === 1) return "Disetujui";
  if (v === 2) return "Ditolak";
  return "Menunggu";
};

const statusClass = (v: number) => {
  if (v === 1) return "border-emerald-400/60 bg-emerald-500/15 text-emerald-50";
  if (v === 2) return "border-rose-400/60 bg-rose-500/15 text-rose-50";
  return "border-amber-300/60 bg-amber-400/15 text-amber-50";
};

export default function AbsensiVrPage() {
  const { user } = useSession();
  const [start, setStart] = useState(() => isoMonthStart());
  const [end, setEnd] = useState(() => isoToday());
  const [rows, setRows] = useState<Row[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState("0");
  const [status, setStatus] = useState("3"); // 3 = semua
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
    title: "Verifikasi Daily Report",
    message: "",
  });
  const tableContainerRef = useRef<HTMLElement | null>(null);

  const rangeInvalid = useMemo(() => {
    const s = new Date(start);
    const e = new Date(end);
    return Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e;
  }, [start, end]);

  const columns = useMemo(
    () => [
      {
        data: null,
        title: "#",
        className: "dt-body-center",
        orderable: false,
        width: "50px",
        render: (_: any, __: any, ___: any, meta: any) => meta.row + 1,
      },
      {
        data: "status",
        title: "Validasi Atasan",
        className: "dt-body-center",
        width: "160px",
        render: (val: any) => {
          const v = Number(val ?? 0);
          return `<span class="inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(v)}">${statusLabel(v)}</span>`;
        },
      },
      { data: "tanggal", title: "Tanggal", className: "dt-body-center", width: "110px", render: (_: any, __: any, row: Row) => row.tanggalLabel },
      { data: "nama", title: "Nama Lengkap", width: "180px" },
      { data: "activity", title: "Aktivitas", width: "180px" },
      { data: "description", title: "Keterangan", width: "220px" },
    ],
    []
  );

  const detachTableClick = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.removeEventListener("click", onTableClick as any);
      tableContainerRef.current = null;
    }
  };

  const onTableClick = (_ev: MouseEvent) => {
    // reserved for future actions (lihat alasan tolak)
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
      const tanggalIso = item.tanggal || item.CREATED_DT_ISO || "";
      return {
        id: Number(item.id ?? item.DAILY_ID ?? idx + 1),
        userId: item.userId || item.USER_ID || "",
        nama: item.nama || item.NAMA_LGKP || "-",
        activity: item.activity || item.ACTIVITY || "-",
        description: item.description || item.DESCRIPTION || "-",
        tanggal: tanggalIso,
        tanggalLabel: item.tanggalLabel || item.CREATED_DT_DMY || isoToDMY(tanggalIso) || "-",
        status: Number(item.status ?? item.IS_VALID ?? 0),
      };
    });

  const fetchRows = useCallback(async (withOverlay = true) => {
    if (rangeInvalid) {
      setError("Rentang tanggal tidak valid");
      setRows([]);
      return;
    }
    setMessage(null);
    setError(null);
    withOverlay ? setLoading(true) : setReloading(true);
    try {
      const res = await fetch("/api/report/absensi-vr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          start,
          end,
          userId: selectedUser,
          status,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Gagal memuat data verifikasi");
      }
      const rawItems = Array.isArray(json.data?.items)
        ? json.data.items!
        : Array.isArray(json.data)
        ? (json.data as any[])
        : [];
      const mapped = mapRows(rawItems);
      setRows(mapped);
      if (!mapped.length) setMessage("Tidak ada data untuk filter ini.");
    } catch (e: any) {
      const msg = e?.message || "Gagal memuat data verifikasi";
      setRows([]);
      setError(msg);
      setModal({
        open: true,
        kind: "error",
        title: "Verifikasi Daily Report",
        message: msg,
      });
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }, [end, rangeInvalid, selectedUser, start, status]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/report/absensi-vr/users", { method: "GET", credentials: "include" });
      if (!res.ok) return;
      const json = await res.json().catch(() => ({}));
      const items: any[] = json?.data?.items ?? json?.items ?? [];
      const opts: UserOption[] = Array.isArray(items)
        ? items.map((it) => ({ id: String(it.id ?? ""), label: String(it.label ?? "").trim() || String(it.id ?? "") }))
        : [];
      setUserOptions(opts);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
    void fetchRows();
    return () => detachTableClick();
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
        lead="Verifikasi"
        title="Verifikasi Daily Report (Filter)"
        description="Filter daily report berdasarkan tanggal, petugas, dan status verifikasi."
      />

      <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_28px_#00ffff22] space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Tanggal Aktivitas</p>
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
              {rangeLabel}
            </span>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Petugas</p>
            <select
              className="w-full rounded-lg border border-cyan-700/50 bg-white/5 px-3 py-2 text-sm text-cyan-100 outline-none ring-0"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="0">-- Semua Petugas --</option>
              {userOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Status Verifikasi</p>
            <select
              className="w-full rounded-lg border border-cyan-700/50 bg-white/5 px-3 py-2 text-sm text-cyan-100 outline-none ring-0"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="3">-- Semua Status --</option>
              <option value="0">1. Belum Diverifikasi</option>
              <option value="1">2. Sudah Diverifikasi</option>
              <option value="2">3. Ditolak</option>
            </select>
          </div>
        </div>

        {rangeInvalid ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
            <AlertCircle className="h-4 w-4" /> Periksa kembali rentang tanggal.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-700/40 bg-white/5 px-3 py-2 text-xs text-cyan-200/80">
            <Sparkles className="h-4 w-4" /> Filter otomatis tanpa reload halaman legacy.
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
                setSelectedUser("0");
                setStatus("3");
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
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">Verifikasi Daily Report</p>
            <h1 className="text-lg font-semibold text-cyan-100">Data Filter</h1>
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
              id="dt-absensi-vr"
              data={rows as any[]}
              minWidth={1100}
              pageLength={100}
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
