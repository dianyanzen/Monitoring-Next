"use client";

import { useMemo, useState } from "react";
import { AlertCircle, BadgeAlert, ClipboardCheck, Loader2, RefreshCcw, Search, Send, Trash2 } from "lucide-react";

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

function Badge({ label, tone }: { label: string; tone: "success" | "warn" | "muted" }) {
  const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold";
  const toneMap: Record<typeof tone, string> = {
    success: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40",
    warn: "bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/40",
    muted: "bg-cyan-500/10 text-cyan-100 ring-1 ring-cyan-500/30",
  };
  return <span className={`${base} ${toneMap[tone]}`}>{label}</span>;
}

function formatAddress(row: Row) {
  const parts = [
    row.alamat || "-",
    `RT ${row.rt || "-"} / RW ${row.rw || "-"}`,
    `Kode Pos ${row.kodePos || "-"}`,
  ];
  return parts.join(" • ");
}

function formatTtl(row: Row) {
  const tempat = row.tempatLahir?.trim() || "-";
  const tgl = row.tanggalLahir?.trim() || "-";
  return `${tempat}, ${tgl}`;
}

export default function ReqEktpPerubahanPage() {
  const [nikInput, setNikInput] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [rejectedRows, setRejectedRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingReject, setLoadingReject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ nikList: rows.map((r) => r.nik), reqstatus: 1 }),
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
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[-25%] h-[880px] w-[880px] rounded-full bg-cyan-500/20 blur-[210px]" />
        <div className="absolute right-[8%] bottom-[-20%] h-[820px] w-[820px] rounded-full bg-fuchsia-600/15 blur-[200px]" />
      </div>

      <header className="flex flex-wrap items-start gap-4">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-300/70">Request eKTP</p>
          <h1 className="text-lg font-semibold text-cyan-50">Request Pencetakan eKTP (Perubahan Elemen)</h1>
          <p className="text-sm text-cyan-100/70">
            Cari berdasarkan NIK (pisahkan dengan koma), lihat status, lalu ajukan pencetakan untuk data yang valid.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-50 shadow-[0_0_24px_#22d3ee33]">
            {summary.okCount} data siap diajukan
          </div>
          <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-50 shadow-[0_0_24px_#f59e0b33]">
            {summary.rejectCount} data ditolak
          </div>
        </div>
      </header>

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
              <p className="text-xs text-cyan-200/70">Data yang valid untuk diajukan pencetakan eKTP karena perubahan elemen.</p>
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-cyan-900/40">
                <thead className="bg-cyan-900/20 text-xs uppercase tracking-wide text-cyan-200/80">
                  <tr>
                    <th className="px-4 py-3 text-left">NIK</th>
                    <th className="px-4 py-3 text-left">Nama</th>
                    <th className="px-4 py-3 text-left">TTL</th>
                    <th className="px-4 py-3 text-left">Alamat</th>
                    <th className="px-4 py-3 text-left">Status eKTP</th>
                    <th className="px-4 py-3 text-left">Req</th>
                    <th className="px-4 py-3 text-left">Cetak</th>
                    <th className="px-4 py-3 text-left">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-900/30 text-sm text-cyan-50">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-cyan-100/70">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                        <p className="mt-2 text-xs">Memuat data...</p>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-cyan-100/70">
                        Tidak ada data.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.nik} className="hover:bg-cyan-500/5">
                        <td className="px-4 py-3 font-semibold text-cyan-50">{row.nik}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-cyan-50">{row.namaLengkap || "-"}</div>
                          <div className="text-[11px] text-cyan-200/70">
                            KK: {row.noKk || "-"} • Kecamatan: {row.namaKecamatan || "-"} • Kelurahan: {row.namaKelurahan || "-"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-cyan-100/80">{formatTtl(row)}</td>
                        <td className="px-4 py-3 text-cyan-100/80">{formatAddress(row)}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-cyan-50">{row.statusEktp || "-"}</div>
                        </td>
                        <td className="px-4 py-3 text-cyan-100/80">
                          <div className="text-sm">{row.reqDate || "-"}</div>
                          <div className="text-[11px] text-cyan-200/70">{row.reqBy || "-"}</div>
                          <div className="text-[11px] text-cyan-200/70">{row.alasanPengajuan || "-"}</div>
                        </td>
                        <td className="px-4 py-3 text-cyan-100/80">
                          <div className="text-sm">{row.printDate || "-"}</div>
                          <div className="text-[11px] text-cyan-200/70">{row.printBy || "-"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <Badge
                              label={row.statusPengajuan || "-"}
                              tone={row.statusPengajuan === "DICETAK" ? "success" : "muted"}
                            />
                            <div className="text-[11px] text-cyan-200/70">{row.keteranganPengajuan || "-"}</div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-amber-500/30">
                  <thead className="bg-amber-500/10 text-xs uppercase tracking-wide text-amber-100/80">
                    <tr>
                      <th className="px-4 py-3 text-left">NIK</th>
                      <th className="px-4 py-3 text-left">Nama</th>
                      <th className="px-4 py-3 text-left">TTL</th>
                      <th className="px-4 py-3 text-left">Alamat</th>
                      <th className="px-4 py-3 text-left">Status eKTP / Pengajuan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-500/20 text-sm text-amber-50">
                    {loadingReject ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-amber-100/80">
                          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                          <p className="mt-2 text-xs">Memuat data ditolak...</p>
                        </td>
                      </tr>
                    ) : rejectedRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-amber-100/80">
                          Tidak ada data ditolak.
                        </td>
                      </tr>
                    ) : (
                      rejectedRows.map((row) => (
                        <tr key={row.nik} className="hover:bg-amber-500/5">
                          <td className="px-4 py-3 font-semibold text-amber-50">{row.nik}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-amber-50">{row.namaLengkap || "-"}</div>
                            <div className="text-[11px] text-amber-100/80">
                              KK: {row.noKk || "-"} • Kecamatan: {row.namaKecamatan || "-"} • Kelurahan: {row.namaKelurahan || "-"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-amber-100/80">{formatTtl(row)}</td>
                          <td className="px-4 py-3 text-amber-100/80">{formatAddress(row)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <Badge label={row.statusEktp || "-"} tone="warn" />
                              <Badge label={row.statusPengajuan || "-"} tone="muted" />
                              <div className="text-[11px] text-amber-100/80">{row.keteranganPengajuan || "-"}</div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
