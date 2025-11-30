// FILE: src/app/inputkehilangan/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarClock, CheckCircle2, Loader2, RefreshCcw, Search, ShieldCheck, Trash2 } from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import JQDataTable from "@/components/datatable/JQDataTable";
import DateRangePopup from "@/components/ui/DateRangePopup";

type Row = {
  noKec: string;
  nik: string;
  noKk: string;
  namaLengkap: string;
  reqDate: string;
  reqBy: string;
  alasanPengajuan: string;
  noKehilangan: string;
  namaKecamatan: string;
  namaKelurahan: string;
  alamat: string;
  rt: string;
  rw: string;
  kodePos: string;
};

type ListResponse = { success: boolean; data?: { items: Row[]; count: number }; message?: string };
type UpdateResponse = { success: boolean; message?: string };

const TITLE = "Detail Pengajuan eKTP Hilang";
const toLocalIso = (d: Date) => `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
const toDMY = (iso: string) => iso.split("-").reverse().join("-");

export default function InputKehilanganPage() {
  const today = useMemo(() => toLocalIso(new Date()), []);
  const [startIso, setStartIso] = useState(today);
  const [endIso, setEndIso] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalNik, setModalNik] = useState("");
  const [modalNo, setModalNo] = useState("");
  const containerRef = useRef<HTMLElement | null>(null);

  const rangeLabel = useMemo(() => `${toDMY(startIso)} - ${toDMY(endIso)}`, [startIso, endIso]);

  const columns = useMemo(
    () => [
      { data: null, title: "No", render: (_: any, __: any, ___: any, meta: any) => meta.row + 1 },
      { data: "nik", title: "NIK" },
      { data: "noKk", title: "No KK" },
      { data: "namaLengkap", title: "Nama Lengkap" },
      { data: "reqDate", title: "Req Date" },
      { data: "reqBy", title: "Req By" },
      { data: "alasanPengajuan", title: "Alasan" },
      {
        data: null,
        title: "Action",
        orderable: false,
        render: (_: any, __: any, row: Row) =>
          `<button class="btn-update-no inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/25 transition" data-update-nik="${row.nik}" data-update-no="${row.noKehilangan || ""}">Update</button>`,
      },
      { data: "noKehilangan", title: "No Kehilangan" },
      { data: "namaKecamatan", title: "Nama Kecamatan" },
      { data: "namaKelurahan", title: "Nama Kelurahan" },
    ],
    []
  );

  const detachTableClick = () => {
    if (containerRef.current) {
      containerRef.current.removeEventListener("click", onTableClick as any);
      containerRef.current = null;
    }
  };

  async function fetchList(startOverride?: string, endOverride?: string) {
    const start = startOverride ?? startIso;
    const end = endOverride ?? endIso;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setError("Rentang tanggal tidak valid");
      setRows([]);
      return;
    }
    if (startDate > endDate) {
      setError("Tanggal awal tidak boleh melebihi tanggal akhir");
      setRows([]);
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/req/ektp/kehilangan/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: toDMY(start), end: toDMY(end) }),
      });
      const json = (await res.json().catch(() => ({}))) as ListResponse;
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat daftar");
      setRows(Array.isArray(json.data?.items) ? json.data!.items : []);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchList();
  }, []);

  const handleUpdateClick = (nik: string, no: string) => {
    setModalNik(nik);
    setModalNo(no === "-" ? "" : no);
    setModalOpen(true);
  };

  const handleApiReady = (api: any | null) => {
    if (!api) {
      detachTableClick();
      return;
    }
    const container = api.table().container() as HTMLElement;
    if (containerRef.current && containerRef.current !== container) {
      containerRef.current.removeEventListener("click", onTableClick as any);
    }
    containerRef.current = container;
    container.addEventListener("click", onTableClick as any);
  };

  const onTableClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const btn = target.closest("[data-update-nik]") as HTMLElement | null;
    if (!btn) return;
    const nik = btn.getAttribute("data-update-nik") || "";
    const no = btn.getAttribute("data-update-no") || "";
    handleUpdateClick(nik, no);
  };

  useEffect(() => {
    return () => {
      detachTableClick();
    };
  }, []);

  // Enter to search (kecuali modal terbuka)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !modalOpen && !loading && !submitting) {
        e.preventDefault();
        void fetchList();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, loading, submitting]);

  async function submitUpdate() {
    const nik = modalNik.replace(/\D/g, "").slice(0, 16);
    const no = modalNo.trim().toUpperCase();
    if (nik.length !== 16) {
      setError("NIK tidak valid");
      return;
    }
    if (!no) {
      setError("No kehilangan wajib diisi");
      return;
    }
    if (no.length < 6) {
      setError("No kehilangan terlalu pendek");
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/req/ektp/kehilangan/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nik, noKehilangan: no }),
      });
      const json = (await res.json().catch(() => ({}))) as UpdateResponse;
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menyimpan no kehilangan");
      setMessage(json.message || "Berhasil disimpan");
      setModalOpen(false);
      await fetchList();
    } catch (e: any) {
      setError(e?.message || "Gagal menyimpan");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClear() {
    const todayIso = toLocalIso(new Date());
    setStartIso(todayIso);
    setEndIso(todayIso);
    setRows([]);
    setMessage(null);
    setError(null);
    void fetchList(todayIso, todayIso);
  }

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-14 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[-25%] h-[820px] w-[820px] rounded-full bg-cyan-500/15 blur-[200px]" />
        <div className="absolute right-[8%] bottom-[-20%] h-[780px] w-[780px] rounded-full bg-fuchsia-600/15 blur-[180px]" />
      </div>

      <SettingPageHeader
        lead="Request eKTP"
        title={TITLE}
        description="Pantau pengajuan eKTP karena kehilangan, lalu catat nomor surat kehilangan."
        badges={
          <>
            <span className="rounded-full border border-cyan-400/50 bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-100">
              Rentang: {rangeLabel}
            </span>
          </>
        }
      />

      <section className="rounded-3xl border border-cyan-900/50 bg-[#05070d]/70 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        <div className="border-b border-cyan-900/40 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <DateRangePopup
              start={startIso}
              end={endIso}
              onChange={(s, e) => {
                setStartIso(s);
                setEndIso(e);
              }}
              months={2}
              minWidth={660}
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchList()}
                disabled={loading || submitting}
                className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={loading || submitting}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-white/5 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
              <button
                type="button"
                onClick={() => void fetchList()}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-60"
                disabled={loading || submitting}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Reload
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          {message ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
              <CheckCircle2 className="h-4 w-4" />
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-xs text-cyan-200/70">
            <CalendarClock className="h-4 w-4" />
            <span>
              {"Menampilkan pengajuan hilang (STEP_PROC <> C) dalam rentang tanggal request. Aksi \"Update\" akan menyimpan nomor kehilangan ke pengajuan terbaru per NIK."}
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-cyan-900/50 bg-[#0a0d15]/70 shadow-inner shadow-cyan-500/10">
            {loading ? (
              <div className="px-4 py-6 text-center text-cyan-100/70">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                <p className="mt-2 text-xs">Memuat data...</p>
              </div>
            ) : (
              <div className="p-4">
                <JQDataTable
                  data={rows}
                  columns={columns}
                  pageLength={50}
                  tableClassName="dt-cyberpunk"
                  onApiReady={handleApiReady}
                  options={{
                    columnDefs: [{ className: "dt-left", targets: "_all" }],
                    createdRow: (_row: any, _data: any, _idx: number) => {},
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-[#0b0f1c] p-5 shadow-[0_16px_40px_rgba(0,0,0,.55)]">
            <div className="flex items-center gap-2 text-cyan-100">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
              <h3 className="text-sm font-semibold">Update No Kehilangan</h3>
            </div>
            <p className="mt-2 text-xs text-cyan-200/70">NIK: {modalNik}</p>

            <div className="mt-4 space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/60">No Kehilangan</label>
              <input
                value={modalNo}
                onChange={(e) => setModalNo(e.target.value.toUpperCase())}
                placeholder="Masukkan no kehilangan (min. 6 karakter)"
                className="w-full rounded-lg border border-cyan-700/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-cyan-800/50 bg-white/5 px-3 py-2 text-sm text-cyan-100 hover:bg-white/10"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => void submitUpdate()}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-50 shadow-[0_0_18px_#22c55e33] transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Simpan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
