"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
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
  isValid: number;
  isSelf: boolean;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  data?: { items?: Row[]; recordsTotal?: number; recordsFiltered?: number };
};

const isoToDMY = (iso?: string) => {
  if (!iso || iso.split("-").length !== 3) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

export default function AbsensiVerifikasiPage() {
  const { user } = useSession();
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
    title: "Verifikasi Daily",
    message: "",
  });
  const [confirm, setConfirm] = useState<{
    open: boolean;
    target: Row | null;
    loading: boolean;
  }>({ open: false, target: null, loading: false });

  const [reject, setReject] = useState<{
    open: boolean;
    target: Row | null;
    message: string;
    loading: boolean;
    error: string | null;
  }>({ open: false, target: null, message: "", loading: false, error: null });

  const tableContainerRef = useRef<HTMLElement | null>(null);

  const pendingCount = useMemo(() => rows.filter((r) => r.isValid === 0).length, [rows]);

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
        data: null,
        title: "Aksi",
        orderable: false,
        className: "dt-body-center",
        width: "180px",
        render: (_: any, __: any, row: Row) => {
          const disabled = row.isSelf ? "opacity-60 cursor-not-allowed" : "";
          const safeLabel = (row.activity || row.tanggalLabel || "").replace(/"/g, "&quot;");
          if (row.isSelf) {
            return `
              <span class="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-50 ${disabled}">
                Waiting Approval
              </span>
            `;
          }
          return `
            <div class="flex items-center justify-center gap-2">
              <button class="btn-abs-v-accept inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-50 hover:bg-emerald-500/20 ${disabled}"
                data-daily-id="${row.id}" data-daily-label="${safeLabel}" data-action="accept" ${row.isSelf ? "disabled" : ""}>
                Terima
              </button>
              <button class="btn-abs-v-reject inline-flex items-center gap-1 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-1 text-xs text-rose-50 hover:bg-rose-500/20 ${disabled}"
                data-daily-id="${row.id}" data-daily-label="${safeLabel}" data-action="reject" ${row.isSelf ? "disabled" : ""}>
                Tolak
              </button>
            </div>
          `;
        },
      },
      { data: "nama", title: "Nama Lengkap", width: "180px" },
      { data: "activity", title: "Aktivitas", width: "180px" },
      { data: "description", title: "Keterangan", width: "220px" },
      {
        data: "tanggal",
        title: "Tanggal",
        className: "dt-body-center",
        width: "120px",
        render: (_: any, __: any, row: Row) => row.tanggalLabel,
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
    const btn = target.closest("[data-action]") as HTMLElement | null;
    if (!btn) return;
    const id = Number(btn.getAttribute("data-daily-id") || "0");
    const label = btn.getAttribute("data-daily-label") || "";
    const action = btn.getAttribute("data-action");
    if (!id || Number.isNaN(id) || !action) return;
    const row = rows.find((r) => r.id === id);
    if (!row || row.isSelf) return;
    if (action === "accept") {
      setConfirm({ open: true, target: row, loading: false });
    } else if (action === "reject") {
      setReject({ open: true, target: row, message: "", loading: false, error: null });
    }
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
        isValid: Number(item.isValid ?? item.IS_VALID ?? 0),
        isSelf: Boolean(item.isSelf ?? false),
      };
    });

  const fetchRows = useCallback(async (withOverlay = true) => {
    setMessage(null);
    setError(null);
    withOverlay ? setLoading(true) : setReloading(true);
    try {
      const res = await fetch("/api/report/absensi-v", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
      if (!mapped.length) setMessage("Tidak ada data menunggu verifikasi.");
    } catch (e: any) {
      const msg = e?.message || "Gagal memuat data verifikasi";
      setRows([]);
      setError(msg);
      setModal({
        open: true,
        kind: "error",
        title: "Verifikasi Daily",
        message: msg,
      });
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }, []);

  const performAccept = async () => {
    if (!confirm.target) return;
    setConfirm((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/report/absensi-v/${confirm.target.id}/accept`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memverifikasi aktivitas");
      setModal({
        open: true,
        kind: "success",
        title: "Verifikasi",
        message: json.message || "Aktivitas diverifikasi.",
      });
      await fetchRows(false);
    } catch (e: any) {
      const msg = e?.message || "Gagal memverifikasi aktivitas";
      setModal({
        open: true,
        kind: "error",
        title: "Verifikasi",
        message: msg,
      });
    } finally {
      setConfirm({ open: false, target: null, loading: false });
    }
  };

  const performReject = async () => {
    if (!reject.target) return;
    if (!reject.message || reject.message.trim().length < 10) {
      setReject((prev) => ({ ...prev, error: "Isi pesan minimal 10 karakter." }));
      return;
    }
    setReject((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(`/api/report/absensi-v/${reject.target.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reject.message }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menolak aktivitas");
      setModal({
        open: true,
        kind: "success",
        title: "Penolakan",
        message: json.message || "Aktivitas ditolak.",
      });
      await fetchRows(false);
    } catch (e: any) {
      const msg = e?.message || "Gagal menolak aktivitas";
      setModal({
        open: true,
        kind: "error",
        title: "Penolakan",
        message: msg,
      });
    } finally {
      setReject({ open: false, target: null, message: "", loading: false, error: null });
    }
  };

  useEffect(() => {
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

      {confirm.open && confirm.target && (
        <NeonModal
          open={confirm.open}
          kind="confirm"
          title="Verifikasi Daily?"
          message={`Aktivitas "${confirm.target.activity}" akan diverifikasi.`}
          confirmText={confirm.loading ? "Memproses..." : "Ya, verifikasi"}
          cancelText="Batal"
          loading={confirm.loading}
          onConfirm={() => void performAccept()}
          onClose={() => {
            if (confirm.loading) return;
            setConfirm({ open: false, target: null, loading: false });
          }}
        />
      )}

      {reject.open && reject.target ? (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-rose-400/30 bg-[#0f0a14]/95 p-5 shadow-[0_0_40px_rgba(255,0,102,0.25)]">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-rose-500/20 p-2 text-rose-100">
                <ThumbsDown className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-rose-50">Tolak Aktivitas</h3>
                <p className="text-sm text-rose-100/80">
                  Beri alasan singkat (min. 10 karakter) untuk menolak aktivitas
                  <span className="font-semibold text-rose-50"> "{reject.target.activity}"</span>.
                </p>
                <textarea
                  rows={3}
                  className="mt-3 w-full rounded-xl border border-rose-400/40 bg-white/5 px-3 py-2 text-sm text-rose-50 outline-none ring-0 focus:border-rose-300/70"
                  placeholder="Contoh: Deskripsi tidak sesuai, mohon revisi."
                  value={reject.message}
                  onChange={(e) => setReject((prev) => ({ ...prev, message: e.target.value }))}
                  disabled={reject.loading}
                />
                <div className="mt-1 text-xs text-rose-100/70">
                  {reject.message.length} karakter | minimal 10
                </div>
                {reject.error ? <div className="mt-1 text-xs text-amber-300">{reject.error}</div> : null}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-white/5"
                    disabled={reject.loading}
                    onClick={() => setReject({ open: false, target: null, message: "", loading: false, error: null })}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-400/60 bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-50 hover:bg-rose-500/30 disabled:opacity-60"
                    disabled={reject.loading}
                    onClick={() => void performReject()}
                  >
                    {reject.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
                    Tolak & Kirim
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[-18%] h-[900px] w-[900px] rounded-full bg-cyan-500/12 blur-[220px]" />
        <div className="absolute right-[12%] bottom-[-18%] h-[860px] w-[860px] rounded-full bg-fuchsia-600/10 blur-[200px]" />
      </div>

      <SettingPageHeader
        lead="Verifikasi"
        title="Verifikasi Daily Report"
        description="Pantau dan verifikasi daily report yang menunggu persetujuan. Aksi hanya tersedia untuk aktivitas milik user lain."
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
        <div className="flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50 shadow-[0_10px_30px_rgba(16,185,129,0.15)]">
          <ThumbsUp className="h-5 w-5" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-100/70">Siap Verifikasi</p>
            <div className="text-lg font-semibold">{pendingCount}</div>
            <div className="text-xs text-emerald-100/70">Menunggu persetujuan</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-white/5 px-4 py-3 text-sm text-cyan-50 shadow-[0_10px_30px_rgba(0,255,255,0.08)]">
          <ShieldCheck className="h-5 w-5 text-cyan-300" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/70">Total Data</p>
            <div className="text-lg font-semibold">{rows.length}</div>
            <div className="text-xs text-cyan-200/70">Baris di tabel</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_28px_#00ffff22] space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-700/40 bg-white/5 px-3 py-2 text-xs text-cyan-200/80">
            <AlertCircle className="h-4 w-4" /> Data otomatis difilter: IS_VALID = 0 dan Anda tercatat sebagai verifikator.
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
            <h1 className="text-lg font-semibold text-cyan-100">Data Menunggu</h1>
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
              id="dt-absensi-v"
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
                order: [[5, "desc"]],
              }}
            />
          </DataShell>
        </div>
      </section>
    </div>
  );
}
