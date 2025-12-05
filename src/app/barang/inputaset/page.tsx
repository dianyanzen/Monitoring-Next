"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save, Undo2 } from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";

type ApiResp<T> = { success?: boolean; message?: string; data?: T };

export default function BarangInputAsetPage() {
  const [jenis, setJenis] = useState("");
  const [satuan, setSatuan] = useState("");
  const [harga, setHarga] = useState("0");
  const [keterangan, setKeterangan] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setJenis("");
    setSatuan("");
    setHarga("0");
    setKeterangan("");
    setMessage(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!jenis.trim()) return setError("Jenis aset wajib diisi.");
    if (!satuan.trim()) return setError("Satuan wajib diisi.");
    if (!Number(harga)) return setError("Harga wajib diisi.");

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        action: "create",
        jenis_barang: jenis.toUpperCase(),
        satuan: satuan.toUpperCase(),
        harga_satuan: Number(harga),
        keterangan: keterangan.toUpperCase(),
      };
      const res = await fetch("/api/barang/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResp<any>;
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menyimpan aset");
      setMessage(json.message || "Berhasil menyimpan aset");
      resetForm();
    } catch (e: any) {
      setError(e?.message || "Gagal menyimpan aset");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-14 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[-25%] h-[820px] w-[820px] rounded-full bg-cyan-500/12 blur-[200px]" />
        <div className="absolute right-[8%] bottom-[-20%] h-[780px] w-[780px] rounded-full bg-fuchsia-600/10 blur-[180px]" />
      </div>

      <SettingPageHeader
        lead="Aset"
        title="Input Aset"
        description="Form ringkas untuk menambah master aset (jenis/satuan/harga/keterangan) seperti versi legacy."
      />

      <section className="rounded-3xl border border-cyan-900/60 bg-[#0b0f1f]/80 p-6 shadow-[0_0_32px_#00ffff22] backdrop-blur-xl">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-2 text-sm text-cyan-100/80">
            <span className="text-cyan-200">Jenis Aset</span>
            <input
              value={jenis}
              onChange={(e) => setJenis(e.target.value)}
              className="w-full rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
              placeholder="Contoh: KOMPUTER DESKTOP"
            />
          </label>

          <label className="space-y-2 text-sm text-cyan-100/80">
            <span className="text-cyan-200">Satuan</span>
            <input
              value={satuan}
              onChange={(e) => setSatuan(e.target.value)}
              className="w-full rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
              placeholder="UNIT / SET / PCS"
            />
          </label>

          <label className="space-y-2 text-sm text-cyan-100/80">
            <span className="text-cyan-200">Harga Satuan</span>
            <input
              value={harga}
              onChange={(e) => setHarga(e.target.value)}
              className="w-full rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
              inputMode="numeric"
              placeholder="0"
            />
          </label>

          <label className="sm:col-span-2 lg:col-span-3 space-y-2 text-sm text-cyan-100/80">
            <span className="text-cyan-200">Keterangan</span>
            <textarea
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              className="h-24 w-full rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
              placeholder="Catatan tambahan"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-white/5 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-white/10"
          >
            <Undo2 className="h-4 w-4" />
            Reset
          </button>
        </div>

        {error ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-50">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-50">
            <CheckCircle2 className="h-4 w-4" />
            {message}
          </div>
        ) : null}
      </section>
    </div>
  );
}
