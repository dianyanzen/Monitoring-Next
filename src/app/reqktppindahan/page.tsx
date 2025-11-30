// FILE: src/app/reqktppindahan/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import SelectDark from "@/components/ui/SelectDark";

type KecOption = { value: string; label: string };
type MetaPayload = {
  akses: { aksesKecamatan: number };
  defaults: { noKec: string };
  wilayah: { kecamatan: KecOption[] };
};
type MetaResponse = { success: boolean; data?: MetaPayload; message?: string };

type DetailPayload = {
  status: "pengajuan" | "demog" | "not_found";
  nik: string;
  nama: string;
  noKec: string;
  namaKec: string;
  reqDate: string | null;
};
type DetailResponse = { success: boolean; data?: DetailPayload; message?: string };

type ActionResponse = { success: boolean; data?: { affected: number }; message?: string };

const TITLE = "Request Pencetakan eKTP (Pindahan)";

const sanitizeNikInput = (v: string) => v.replace(/\D/g, "").slice(0, 16);

export default function ReqKtpPindahanPage() {
  const [nikInput, setNikInput] = useState("");
  const [namaInput, setNamaInput] = useState("");
  const [noKec, setNoKec] = useState("");
  const [reqDate, setReqDate] = useState<string | null>(null);
  const [status, setStatus] = useState<DetailPayload["status"] | "idle">("idle");

  const [meta, setMeta] = useState<{
    aksesKecamatan: number;
    defaultNoKec: string;
    kecamatan: KecOption[];
  }>({ aksesKecamatan: 0, defaultNoKec: "", kecamatan: [] });

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameDisabled = status !== "not_found";
  const kecLocked = status !== "not_found" || (meta.aksesKecamatan === 0 && !!meta.defaultNoKec);
  const canSave = status === "not_found" && namaInput.trim().length > 0 && (noKec || meta.defaultNoKec);
  const canUpdate = status === "pengajuan";
  const canDelete = status === "pengajuan";

  useEffect(() => {
    const controller = new AbortController();
    const fetchMeta = async () => {
      setLoadingMeta(true);
      try {
        const res = await fetch("/api/req/ektp/pindahan/meta", { cache: "no-store", credentials: "include", signal: controller.signal });
        const json = (await res.json().catch(() => ({}))) as MetaResponse;
        if (!res.ok || json.success === false || !json.data) {
          setError(json.message || "Gagal memuat metadata");
          return;
        }
        setMeta({
          aksesKecamatan: Number(json.data.akses?.aksesKecamatan ?? 0),
          defaultNoKec: json.data.defaults?.noKec ?? "",
          kecamatan: Array.isArray(json.data.wilayah?.kecamatan) ? json.data.wilayah.kecamatan : [],
        });
      } catch (e: any) {
        if (e?.name !== "AbortError") setError(e?.message || "Gagal memuat metadata");
      } finally {
        setLoadingMeta(false);
      }
    };
    void fetchMeta();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!noKec && meta.defaultNoKec) {
      setNoKec(meta.defaultNoKec);
    }
  }, [meta.defaultNoKec, noKec]);

  const statusBadge = useMemo(() => {
    if (status === "pengajuan") {
      return (
        <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          Sudah diajukan
        </span>
      );
    }
    if (status === "demog") {
      return (
        <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
          Sudah ada di database lokal
        </span>
      );
    }
    if (status === "not_found") {
      return (
        <span className="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-100">
          Siap diajukan
        </span>
      );
    }
    return null;
  }, [status]);

  const handleApplyDetail = (data: DetailPayload) => {
    setStatus(data.status);
    setNamaInput(data.nama || "");
    setNoKec(data.noKec || meta.defaultNoKec || "");
    setReqDate(data.reqDate ?? null);
    setMessage(null);
  };

  const handleClear = () => {
    setNikInput("");
    setNamaInput("");
    setNoKec(meta.defaultNoKec || "");
    setReqDate(null);
    setStatus("idle");
    setMessage(null);
    setError(null);
  };

  const fetchDetail = async (targetNik?: string) => {
    const nik = sanitizeNikInput(targetNik ?? nikInput);
    setNikInput(nik);
    setMessage(null);
    setError(null);
    if (nik.length !== 16) {
      setError("NIK wajib 16 digit");
      return;
    }
    setLoading(true);
    try {
      const qs = `?nik=${encodeURIComponent(nik)}`;
      const res = await fetch(`/api/req/ektp/pindahan/detail${qs}`, { cache: "no-store", credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as DetailResponse;
      if (!res.ok || json.success === false || !json.data) throw new Error(json.message || "Data tidak ditemukan");
      handleApplyDetail(json.data);
      setMessage(json.message || "Data ditemukan");
    } catch (e: any) {
      setError(e?.message || "Gagal memuat data");
      setStatus("idle");
      setReqDate(null);
    } finally {
      setLoading(false);
    }
  };

  const submit = async (action: "create" | "update" | "delete") => {
    const nik = sanitizeNikInput(nikInput);
    setNikInput(nik);
    setError(null);
    setMessage(null);
    if (nik.length !== 16) {
      setError("NIK wajib 16 digit");
      return;
    }
    if (action === "create" && !namaInput.trim()) {
      setError("Nama wajib diisi untuk pengajuan baru");
      return;
    }
    const targetKec = noKec || meta.defaultNoKec;
    if (action === "create" && !targetKec) {
      setError("Nomor kecamatan wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/req/ektp/pindahan/ajukan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nik,
          nama: namaInput.trim().toUpperCase(),
          noKec: targetKec,
          action,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as ActionResponse;
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memproses pengajuan");
      setMessage(json.message || "Berhasil diproses");
      await fetchDetail(nik);
    } catch (e: any) {
      setError(e?.message || "Gagal memproses pengajuan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-14 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[-25%] h-[820px] w-[820px] rounded-full bg-cyan-500/15 blur-[200px]" />
        <div className="absolute right-[8%] bottom-[-20%] h-[780px] w-[780px] rounded-full bg-fuchsia-600/15 blur-[180px]" />
      </div>

      <SettingPageHeader
        lead="Request eKTP"
        title={TITLE}
        description="Menu untuk pengajuan pencetakan eKTP bagi penduduk pindahan/luar daerah. Masukkan NIK, cek status, lalu ajukan atau kelola pengajuan yang sudah ada."
        badges={
          <>
            <span className="rounded-full border border-cyan-400/50 bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-100">
              Akses kecamatan: {meta.aksesKecamatan === 0 ? "Terbatas" : "Semua kecamatan"}
            </span>
            {statusBadge}
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
                  if (e.key === "Enter") void fetchDetail();
                }}
                placeholder="Masukkan NIK (16 digit)"
                className="flex-1 bg-transparent text-sm text-cyan-50 outline-none placeholder:text-cyan-200/60"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchDetail()}
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
                onClick={() => void fetchDetail(nikInput)}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-60"
                disabled={loading || submitting || nikInput.length !== 16}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Reload
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 px-5 py-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-cyan-900/50 bg-[#0a0d15]/70 p-5 shadow-inner shadow-cyan-500/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                <MapPin className="h-4 w-4" />
                Data Pengajuan
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/60">Nama Lengkap</label>
                  <input
                    value={namaInput}
                    onChange={(e) => setNamaInput(e.target.value.toUpperCase())}
                    readOnly={nameDisabled}
                    placeholder="Isi nama jika NIK belum terdaftar"
                    className="w-full rounded-xl border border-cyan-800/60 bg-[#0f1424] px-3 py-2 text-sm text-cyan-50 shadow-inner shadow-cyan-500/5 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/60">Kecamatan</label>
                  <SelectDark
                    value={noKec || meta.defaultNoKec || "0"}
                    onChange={(e) => setNoKec(e.target.value)}
                    disabled={kecLocked || loadingMeta}
                  >
                    <option value="">-- Pilih Kecamatan --</option>
                    {meta.kecamatan.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </SelectDark>
                  {status !== "not_found" && (noKec || meta.defaultNoKec) ? (
                    <p className="text-[11px] text-cyan-200/60">({noKec || meta.defaultNoKec}) {status === "demog" ? "Terkunci dari data lokal" : "Mengikuti pengajuan yang ada"}</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {reqDate ? (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-50">
                    <CalendarClock className="h-4 w-4" />
                    Pengajuan terakhir: {reqDate}
                  </div>
                ) : null}
                {status === "demog" ? (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-50">
                    <AlertCircle className="h-4 w-4" />
                    NIK sudah ada di database lokal. Pengajuan pindahan tidak diperlukan.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {message ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50 shadow-[0_0_18px_#22c55e33]">
                <CheckCircle2 className="h-4 w-4" />
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-50 shadow-[0_0_18px_#f59e0b33]">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            ) : null}

            <div className="rounded-2xl border border-cyan-900/50 bg-[#0a0d15]/70 p-4 shadow-inner shadow-cyan-500/10">
              <div className="mb-3 text-sm font-semibold text-cyan-100">Aksi</div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => void submit("create")}
                  disabled={!canSave || submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting && canSave ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Ajukan Baru
                </button>

                <button
                  type="button"
                  onClick={() => void submit("update")}
                  disabled={!canUpdate || submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting && canUpdate ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  Ajukan Ulang
                </button>

                <button
                  type="button"
                  onClick={() => void submit("delete")}
                  disabled={!canDelete || submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-pink-500/50 bg-pink-500/10 px-4 py-2 text-sm font-semibold text-pink-50 transition hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting && canDelete ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Hapus Pengajuan
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-cyan-800/50 bg-cyan-500/5 p-3 text-xs text-cyan-100/80">
                <p className="flex items-center gap-2">
                  <ShieldIcon />
                  Pengajuan pindahan hanya untuk NIK yang belum ada di database lokal. Nama dan kecamatan bisa diisi manual jika data tidak ditemukan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4 text-cyan-300"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 4 7v5c0 5 3.5 9 8 9s8-4 8-9V7l-8-4Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
