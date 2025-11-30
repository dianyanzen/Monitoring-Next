// FILE: src/app/reqktphilang/page.tsx
"use client";

import { useMemo, useState } from "react";
import { AlertCircle, BadgeAlert, ClipboardCheck, Loader2, RefreshCcw, Search, Send, Trash2 } from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import JQDataTable from "@/components/datatable/JQDataTable";

const REQUEST_STATUS = 3; // hilang
const TITLE = "Request Pencetakan eKTP (Hilang)";

type Row = {
  noKec: string;
  nik: string;
  noKk: string;
  namaLengkap: string;
  statusEktp: string;
  tempatLahir: string;
  tanggalLahir: string;
  alamat: string;
  kodePos: string;
  rt: string;
  rw: string;
  reqDate: string;
  reqBy: string;
  printDate: string;
  printBy: string;
  alasanPengajuan: string;
  statusPengajuan: string;
  keteranganPengajuan: string;
  namaKecamatan: string;
  namaKelurahan: string;
};

type ApiListResponse = {
  success: boolean;
  data?: { items: Row[]; count: number };
  message?: string;
};

type ApiSubmitResponse = {
  success: boolean;
  data?: { inserted: number; requested: number };
  message?: string;
};

function sanitizeNikInput(value: string) {
  return value.replace(/[^\d,]/g, "").replace(/,+/g, ",");
}

function formatAddress(row: Row) {
  const parts = [row.alamat || "-", `RT ${row.rt || "-"} / RW ${row.rw || "-"}`, `Kode Pos ${row.kodePos || "-"}`];
  return parts.join(" • ");
}

function formatTtl(row: Row) {
  const tempat = row.tempatLahir?.trim() || "-";
  const tgl = row.tanggalLahir?.trim() || "-";
  return `${tempat}, ${tgl}`;
}

export default function ReqEktpHilangPage() {
  const [nikInput, setNikInput] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [rejectedRows, setRejectedRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingReject, setLoadingReject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(
    () => [
      { data: null, title: "No", render: (_: any, __: any, ___: any, meta: any) => meta.row + 1 },
      { data: "noKec", title: "No Kec" },
      { data: "nik", title: "NIK" },
      { data: "noKk", title: "No KK" },
      { data: "namaLengkap", title: "Nama Lengkap" },
      { data: "statusEktp", title: "Status eKTP" },
      { data: "tempatLahir", title: "Tempat/Tgl Lahir", render: (_: any, __: any, row: Row) => formatTtl(row) },
      { data: "alamat", title: "Alamat", render: (_: any, __: any, row: Row) => formatAddress(row) },
      { data: "reqDate", title: "Req Date" },
      { data: "reqBy", title: "Req By" },
      { data: "printDate", title: "Print Date" },
      { data: "printBy", title: "Print By" },
      { data: "alasanPengajuan", title: "Alasan Pengajuan" },
      {
        data: "statusPengajuan",
        title: "Status Pengajuan",
        render: (data: any) =>
          `<span class="inline-flex items-center rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-100">${data || "-"}</span>`,
      },
      { data: "keteranganPengajuan", title: "Keterangan" },
      { data: "namaKecamatan", title: "Nama Kecamatan" },
      { data: "namaKelurahan", title: "Nama Kelurahan" },
    ],
    []
  );

  const columnsReject = useMemo(
    () => [
      { data: null, title: "No", render: (_: any, __: any, ___: any, meta: any) => meta.row + 1 },
      { data: "noKec", title: "No Kec" },
      { data: "nik", title: "NIK" },
      { data: "noKk", title: "No KK" },
      { data: "namaLengkap", title: "Nama Lengkap" },
      { data: "tempatLahir", title: "Tempat/Tgl Lahir", render: (_: any, __: any, row: Row) => formatTtl(row) },
      { data: "alamat", title: "Alamat", render: (_: any, __: any, row: Row) => formatAddress(row) },
      { data: "statusEktp", title: "Status eKTP" },
      { data: "reqDate", title: "Req Date" },
      { data: "reqBy", title: "Req By" },
      { data: "printDate", title: "Print Date" },
      { data: "printBy", title: "Print By" },
      { data: "alasanPengajuan", title: "Alasan Pengajuan" },
      {
        data: "statusPengajuan",
        title: "Status Pengajuan",
        render: (data: any) =>
          `<span class="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-50">${data || "-"}</span>`,
      },
      { data: "keteranganPengajuan", title: "Keterangan" },
      { data: "namaKecamatan", title: "Nama Kecamatan" },
      { data: "namaKelurahan", title: "Nama Kelurahan" },
    ],
    []
  );

  async function fetchList(targetNik?: string) {
    const nik = sanitizeNikInput(targetNik ?? nikInput).trim();
    setNikInput(nik);
    if (!nik) {
      setRows([]);
      setRejectedRows([]);
      return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);
    setLoadingReject(true);
    try {
      const qs = `?nik=${encodeURIComponent(nik)}`;
      const [resOk, resReject] = await Promise.all([
        fetch(`/api/req/ektp/perubahan/list${qs}`, { cache: "no-store", credentials: "include" }),
        fetch(`/api/req/ektp/perubahan/list-ditolak${qs}`, { cache: "no-store", credentials: "include" }),
      ]);

      const okJson = (await resOk.json().catch(() => ({}))) as ApiListResponse;
      const rejectJson = (await resReject.json().catch(() => ({}))) as ApiListResponse;

      if (!resOk.ok || okJson.success === false) throw new Error(okJson.message || "Gagal memuat list pengajuan");
      if (!resReject.ok || rejectJson.success === false) throw new Error(rejectJson.message || "Gagal memuat list ditolak");

      setRows(Array.isArray(okJson.data?.items) ? okJson.data!.items : []);
      setRejectedRows(Array.isArray(rejectJson.data?.items) ? rejectJson.data!.items : []);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat data");
      setRows([]);
      setRejectedRows([]);
    } finally {
      setLoading(false);
      setLoadingReject(false);
    }
  }

  function handleClear() {
    setNikInput("");
    setRows([]);
    setRejectedRows([]);
    setMessage(null);
    setError(null);
  }

  async function handleSubmit() {
    if (!rows.length) {
      setError("Belum ada data yang bisa diajukan.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/req/ektp/perubahan/ajukan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nikList: rows.map((r) => r.nik), reqstatus: REQUEST_STATUS }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiSubmitResponse;
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Pengajuan gagal dikirim");
      }
      setMessage(json.message || "Pengajuan berhasil dikirim");
      await fetchList(nikInput);
    } catch (e: any) {
      setError(e?.message || "Pengajuan gagal dikirim");
    } finally {
      setSubmitting(false);
    }
  }

  const summary = useMemo(() => {
    return {
      okCount: rows.length,
      rejectCount: rejectedRows.length,
    };
  }, [rows.length, rejectedRows.length]);

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-14 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[-25%] h-[880px] w-[880px] rounded-full bg-cyan-500/20 blur-[210px]" />
        <div className="absolute right-[8%] bottom-[-20%] h-[820px] w-[820px] rounded-full bg-fuchsia-600/15 blur-[200px]" />
      </div>

      <SettingPageHeader
        lead="Request eKTP"
        title={TITLE}
        description="Cari berdasarkan NIK (pisahkan dengan koma), lihat status, lalu ajukan pencetakan untuk data yang valid."
        badges={
          <>
            <span className="rounded-full border border-cyan-400/50 bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-100">
              {summary.okCount} siap diajukan
            </span>
            <span className="rounded-full border border-amber-400/50 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-100">
              {summary.rejectCount} ditolak
            </span>
          </>
        }
      />

      <section className="rounded-3xl border border-cyan-900/50 bg-[#05070d]/70 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        <div className="border-b border-cyan-900/40 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-2xl border border-cyan-800/60 bg-white/5 px-3 py-2 shadow-inner shadow-cyan-500/10">
              <Search className="h-4 w-4 text-cyan-400" />
              <input
                value={nikInput}
                onChange={(e) => setNikInput(sanitizeNikInput(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void fetchList();
                }}
                placeholder="Masukkan NIK, pisahkan dengan koma"
                className="flex-1 bg-transparent text-sm text-cyan-50 outline-none placeholder:text-cyan-200/60"
              />
            </div>

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
                onClick={() => void fetchList(nikInput)}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-60"
                disabled={loading || submitting}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Reload
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          {message ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
              <ClipboardCheck className="h-4 w-4" />
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1">
              <h2 className="mb-2 text-sm font-semibold text-cyan-100">List Pengajuan</h2>
              <p className="text-xs text-cyan-200/70">Data yang valid untuk diajukan pencetakan eKTP karena hilang.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || loading || rows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-50 shadow-[0_0_18px_#22c55e33] transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Ajukan Pencetakan
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-cyan-900/50 bg-[#0a0d15]/70 shadow-inner shadow-cyan-500/10">
            {loading ? (
              <div className="px-4 py-6 text-center text-cyan-100/70">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                <p className="mt-2 text-xs">Memuat data...</p>
              </div>
            ) : (
              <div className="p-4">
                <JQDataTable data={rows} columns={columns} pageLength={50} tableClassName="dt-cyberpunk" />
              </div>
            )}
          </div>

          <div className="mt-10 space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-[0_0_24px_#f59e0b22]">
            <div className="flex items-center gap-2 text-amber-50">
              <BadgeAlert className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">List Ditolak</h3>
                <p className="text-xs text-amber-100/80">Data yang tidak dapat diajukan (status rekam belum siap / diblokir).</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-amber-500/30 bg-[#0a0d15]/70">
              {loadingReject ? (
                <div className="px-4 py-6 text-center text-amber-100/80">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  <p className="mt-2 text-xs">Memuat data ditolak...</p>
                </div>
              ) : (
                <div className="p-4">
                  <JQDataTable data={rejectedRows} columns={columnsReject} pageLength={50} tableClassName="dt-cyberpunk" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
