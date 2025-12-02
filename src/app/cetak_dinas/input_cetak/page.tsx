"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCcw, Save, Search, Trash2 } from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";

type NikData = {
  isExists?: boolean;
  nik?: string;
  nama?: string;
  noKec?: string;
  namaKec?: string;
};

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

const toDMY = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const today = () => toDMY(new Date());

function sanitizeNikInput(raw: string) {
  return raw.replace(/[^\d]/g, "").slice(0, 16);
}

export default function InputCetakDinasPage() {
  const [nik, setNik] = useState("");
  const [nama, setNama] = useState("");
  const [noKec, setNoKec] = useState("0");
  const [namaKec, setNamaKec] = useState("");
  const [requestBy, setRequestBy] = useState("");
  const [receiveBy, setReceiveBy] = useState("");
  const [tanggal, setTanggal] = useState(today);

  const [loadingNik, setLoadingNik] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [namaLocked, setNamaLocked] = useState(true);

  const nikFilled = useMemo(() => nik.length === 16, [nik]);

  useEffect(() => {
    setTanggal(today());
  }, []);

  const clearForm = () => {
    setNik("");
    setNama("");
    setNoKec("0");
    setNamaKec("");
    setRequestBy("");
    setReceiveBy("");
    setTanggal(today());
    setMessage(null);
    setError(null);
    setNamaLocked(true);
  };

  const handleLookup = async () => {
    const cleanNik = sanitizeNikInput(nik);
    setNik(cleanNik);
    if (cleanNik.length !== 16) {
      setError("Input NIK harus 16 digit.");
      return;
    }
    setLoadingNik(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/cetak_dinas/get_nik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nik: cleanNik }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResponse<NikData>;
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal mengambil data NIK.");
      const data = (json.data ?? json) as NikData;
      if (data?.isExists) {
        setNama(data.nama ?? "");
        setNoKec(data.noKec ?? "0");
        setNamaKec(data.namaKec ?? "");
        setNamaLocked(true);
        setMessage("Data ditemukan, siap disimpan.");
      } else {
        setNama(data?.nama ?? "");
        setNoKec(data?.noKec ?? "0");
        setNamaKec(data?.namaKec ?? "LUAR DOMISILI");
        setNamaLocked(false);
        setMessage("Data tidak ditemukan, lengkapi nama secara manual.");
      }
    } catch (e: any) {
      setError(e?.message || "Gagal mengambil data NIK.");
    } finally {
      setLoadingNik(false);
    }
  };

  const validate = () => {
    const issues: string[] = [];
    if (nik.length !== 16) issues.push("NIK harus 16 digit.");
    if (!nama.trim()) issues.push("Nama tidak boleh kosong.");
    if (!requestBy.trim()) issues.push("Request By tidak boleh kosong.");
    if (!receiveBy.trim()) issues.push("Receive By tidak boleh kosong.");
    if (issues.length) {
      setError(issues.join(" "));
      return false;
    }
    setError(null);
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        nik,
        nama: nama.trim(),
        no_kec: Number(noKec) || 0,
        nama_kec: namaKec,
        request_by: requestBy.trim().toUpperCase(),
        receive: receiveBy.trim().toUpperCase(),
        tanggal,
      };
      const res = await fetch("/api/cetak_dinas/do_save_cetak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menyimpan data.");
      const successMsg = json.message || "Data berhasil disimpan.";
      clearForm();
      setMessage(successMsg);
    } catch (e: any) {
      setError(e?.message || "Gagal menyimpan data.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[12%] top-[-20%] h-[900px] w-[900px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[10%] bottom-[-18%] h-[860px] w-[860px] rounded-full bg-fuchsia-600/12 blur-[200px]" />
      </div>

      <SettingPageHeader
        lead="Kendali Cetak Dinas"
        title="Input Cetak Dinas"
        description="Masukkan NIK untuk mengambil data, lengkapi petugas, lalu simpan kendali cetak dinas."
      />

      <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_24px_#00ffff22]">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">NIK</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  value={nik}
                  onChange={(e) => setNik(sanitizeNikInput(e.target.value))}
                  onKeyUp={(e) => {
                    const val = sanitizeNikInput((e.target as HTMLInputElement).value);
                    if (val.length === 16 && e.key === "Enter") void handleLookup();
                  }}
                  maxLength={16}
                  inputMode="numeric"
                  className="flex-1 rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  placeholder="16 digit"
                />
                <button
                  type="button"
                  onClick={() => void handleLookup()}
                  disabled={loadingNik}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-600/50 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingNik ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {loadingNik ? "Mencari..." : "Cari"}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Nama</label>
              <input
                value={nama}
                onChange={(e) => setNama(e.target.value.toUpperCase())}
                readOnly={namaLocked}
                className="mt-1 w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30 disabled:opacity-70"
                placeholder="Nama lengkap"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Kecamatan</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  value={namaKec || "-- Pilih Kecamatan --"}
                  readOnly
                  className="flex-1 rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none opacity-80"
                />
                <span className="rounded-lg border border-cyan-700/40 bg-white/5 px-3 py-2 text-xs text-cyan-200/80">No: {noKec || "0"}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Request By</label>
                <input
                  value={requestBy}
                  onChange={(e) => setRequestBy(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Received By</label>
                <input
                  value={receiveBy}
                  onChange={(e) => setReceiveBy(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSave();
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Tanggal Cetak</label>
                <input
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  placeholder="DD-MM-YYYY"
                  className="mt-1 w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => setTanggal(today())}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-700/40 bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-white/10"
                >
                  <RefreshCcw className="h-4 w-4" /> Hari ini
                </button>
              </div>
            </div>

            {message ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-50">
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-50">
                <AlertTriangle className="h-4 w-4" /> {error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || loadingNik}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-50 shadow-[0_0_18px_#22c55e33] transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
              <button
                type="button"
                onClick={clearForm}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-white/5 px-4 py-2 text-sm text-cyan-100 hover:bg-white/10"
              >
                <Trash2 className="h-4 w-4" /> Clear
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
