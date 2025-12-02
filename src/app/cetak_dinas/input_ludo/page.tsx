"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCcw, Save, Trash2 } from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";

const toDMY = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

function sanitizeNumber(raw: string) {
  return raw.replace(/[^\d]/g, "");
}

export default function InputLudoDinasPage() {
  const [jumlah, setJumlah] = useState("0");
  const [tanggal, setTanggal] = useState(toDMY(new Date()));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLudo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cetak_dinas/get_ludo", { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat data ludo.");
      const j = json?.data?.jum_ludo ?? json?.jum_ludo ?? 0;
      setJumlah(String(j));
      setMessage(null);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat data ludo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLudo();
  }, []);

  const handleClear = () => {
    setTanggal(toDMY(new Date()));
    setMessage(null);
    setError(null);
    void fetchLudo();
  };

  const validate = () => {
    if (!jumlah || Number(jumlah) < 0) {
      setError("Jumlah tidak boleh kosong atau negatif.");
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
      const res = await fetch("/api/cetak_dinas/do_save_ludo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ jml: Number(jumlah) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menyimpan data ludo.");
      setMessage(json.message || "Data Berhasil Di Simpan");
      await fetchLudo();
    } catch (e: any) {
      setError(e?.message || "Gagal menyimpan data ludo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[-20%] h-[880px] w-[880px] rounded-full bg-cyan-500/20 blur-[220px]" />
        <div className="absolute right-[8%] bottom-[-18%] h-[820px] w-[820px] rounded-full bg-fuchsia-600/12 blur-[200px]" />
      </div>

      <SettingPageHeader
        lead="Kendali Cetak Dinas"
        title="Input Ludo Dinas"
        description="Input jumlah cetak LUDO harian dan simpan ke monitoring."
      />

      <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_24px_#00ffff22] max-w-4xl">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Jumlah Cetak</label>
              <input
                value={jumlah}
                onChange={(e) => setJumlah(sanitizeNumber(e.target.value))}
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Tanggal Cetak</label>
              <input
                value={tanggal}
                readOnly
                className="mt-1 w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none opacity-80"
              />
            </div>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">{message}</div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">{error}</div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-50 shadow-[0_0_18px_#22c55e33] transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-white/5 px-4 py-2 text-sm text-cyan-100 hover:bg-white/10"
          >
            <Trash2 className="h-4 w-4" /> Clear
          </button>
          <button
            type="button"
            onClick={() => void fetchLudo()}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
          >
            <RefreshCcw className="h-4 w-4" /> Reload
          </button>
        </div>
      </section>
    </div>
  );
}
