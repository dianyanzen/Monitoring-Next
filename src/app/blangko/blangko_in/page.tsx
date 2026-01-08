"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCcw, Save, Trash2 } from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";

type Summary = { MASUK: number; KELUAR: number; RUSAK: number; SISA: number };
type HistoryItem = { TANGGAL: string; JUMLAH: number; KET: string; CREATED_BY: string };

const toDMY = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

export default function BlangkoInPage() {
  const [tanggal, setTanggal] = useState(() => toDMY(new Date()));
  const [jumlah, setJumlah] = useState("0");
  const [keterangan, setKeterangan] = useState("");
  const [summary, setSummary] = useState<Summary>({ MASUK: 0, KELUAR: 0, RUSAK: 0, SISA: 0 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [prefilled, setPrefilled] = useState<HistoryItem | null>(null);

  const totalInfo = useMemo(
    () => [
      { label: "Blangko Masuk", value: summary.MASUK, color: "text-emerald-300" },
      { label: "Blangko Keluar", value: summary.KELUAR, color: "text-amber-300" },
      { label: "Blangko Rusak", value: summary.RUSAK, color: "text-rose-300" },
      { label: "Sisa Blangko", value: summary.SISA, color: "text-cyan-300" },
    ],
    [summary]
  );

  const normalizeHistoryItem = (row: any): HistoryItem => ({
    TANGGAL:
      typeof row?.TANGGAL === "string"
        ? row.TANGGAL
        : typeof row?.tanggal === "string"
          ? row.tanggal
          : "-",
    JUMLAH: Number(row?.JUMLAH ?? row?.jumlah ?? 0) || 0,
    KET: typeof row?.KET === "string" ? row.KET : typeof row?.keterangan === "string" ? row.keterangan : "",
    CREATED_BY:
      typeof row?.CREATED_BY === "string"
        ? row.CREATED_BY
        : typeof row?.created_by === "string"
          ? row.created_by
          : "-",
  });

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/blangko/get_allin_data", { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat data blangko");
      const data = json.data ?? json;
      setSummary({
        MASUK: Number(data.MASUK ?? 0),
        KELUAR: Number(data.KELUAR ?? 0),
        RUSAK: Number(data.RUSAK ?? 0),
        SISA: Number(data.SISA ?? 0),
      });
    } catch (e: any) {
      setError(e?.message || "Gagal memuat data blangko");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (targetDate?: string) => {
    const tgl = targetDate && /^\d{2}-\d{2}-\d{4}$/.test(targetDate) ? targetDate : null;
    if (!tgl) return;

    setHistoryLoading(true);
    try {
      const res = await fetch("/api/blangko/get_hist_in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tanggal: tgl }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat histori blangko");
      const data = json.data ?? json;
      const itemsRaw = data.items ?? data.history ?? [];
      const parsed = Array.isArray(itemsRaw) ? itemsRaw.map(normalizeHistoryItem) : [];
      setHistory(parsed);

      const todayRaw = data.today ?? data.existing ?? null;
      const todayNormalized = todayRaw ? normalizeHistoryItem(todayRaw) : null;
      if (todayNormalized && todayNormalized.TANGGAL === tgl) {
        setPrefilled(todayNormalized);
        setJumlah(String(todayNormalized.JUMLAH));
        setKeterangan(todayNormalized.KET);
      } else {
        setPrefilled(null);
      }
    } catch (e: any) {
      setError(e?.message || "Gagal memuat histori blangko");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void fetchSummary();
  }, []);

  useEffect(() => {
    if (!/^\d{2}-\d{2}-\d{4}$/.test(tanggal)) {
      setPrefilled(null);
      return;
    }
    void fetchHistory(tanggal);
  }, [tanggal]);

  const handleClear = () => {
    const today = toDMY(new Date());
    setTanggal(today);
    setJumlah("0");
    setKeterangan("");
    setMessage(null);
    setError(null);
    void Promise.all([fetchSummary(), fetchHistory(today)]);
  };

  const handleSave = async () => {
    const qty = Number(jumlah);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Input blangko harus lebih dari 0.");
      return;
    }
    if (!/^\d{2}-\d{2}-\d{4}$/.test(tanggal)) {
      setError("Tanggal tidak valid (DD-MM-YYYY).");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/blangko/doin_save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ blangko_masuk: qty, tanggal, keterangan }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menyimpan blangko");
      setMessage(json.message || "Berhasil disimpan");
      await Promise.all([fetchSummary(), fetchHistory(tanggal)]);
    } catch (e: any) {
      setError(e?.message || "Gagal menyimpan blangko");
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
        lead="Kendali Blangko"
        title="Blangko KTP Masuk"
        description="Input blangko KTP yang masuk dan lihat ringkasan tahun berjalan."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_24px_#00ffff22] lg:col-span-1">
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Tanggal</label>
              <input
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                placeholder="DD-MM-YYYY"
                className="mt-1 w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">KTP Masuk</label>
              <input
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value.replace(/[^\d-]/g, ""))}
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Keterangan</label>
              <textarea
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                className="mt-1 h-32 w-full resize-none rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
              />
            </div>

            {prefilled ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-50">
                Tanggal {prefilled.TANGGAL} sudah pernah diinput (
                {prefilled.JUMLAH.toLocaleString("id-ID")} blangko). Form otomatis terisi agar tidak dobel.
              </div>
            ) : null}

            {message ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-50">
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-50">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
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
                onClick={() => {
                  setLoading(true);
                  Promise.all([fetchSummary(), fetchHistory(tanggal)]).finally(() => setLoading(false));
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <RefreshCcw className="h-4 w-4" /> Reload
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-cyan-800/40 bg-[#0b0f1c]/70 p-5 shadow-[0_0_24px_#00ffff22] lg:col-span-2">
          <h3 className="text-sm font-semibold text-cyan-100">Ringkasan Blangko {new Date().getFullYear()}</h3>
          <p className="text-xs text-cyan-200/70">Sampai bulan {new Date().toLocaleString("id-ID", { month: "long" })}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {totalInfo.map((item) => (
              <div key={item.label} className="rounded-xl border border-cyan-700/30 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.15em] text-cyan-200/70">{item.label}</p>
                <p className={`mt-1 text-2xl font-bold ${item.color}`}>{loading ? "-" : item.value.toLocaleString("id-ID")}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_24px_#00ffff22]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-cyan-100">Histori Input Blangko (5 terbaru)</h3>
            <p className="text-xs text-cyan-200/70">Melihat catatan terakhir dan mencegah input ganda di tanggal yang sama.</p>
          </div>
          <button
            type="button"
            onClick={() => void fetchHistory(tanggal)}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
          >
            {historyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </button>
        </div>

        <div className="mt-3 overflow-auto rounded-xl border border-cyan-800/40">
          <table className="min-w-full text-sm text-cyan-100">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-cyan-200/70">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Tanggal</th>
                <th className="px-3 py-2 text-left">Jumlah</th>
                <th className="px-3 py-2 text-left">Input Oleh</th>
                <th className="px-3 py-2 text-left">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr>
                  <td className="px-3 py-3" colSpan={5}>
                    Memuat histori...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td className="px-3 py-3" colSpan={5}>
                    Belum ada histori blangko masuk.
                  </td>
                </tr>
              ) : (
                history.map((row, idx) => (
                  <tr key={`${row.TANGGAL}-${idx}`} className="border-t border-cyan-900/40">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2">{row.TANGGAL}</td>
                    <td className="px-3 py-2">{row.JUMLAH.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2">{row.CREATED_BY}</td>
                    <td className="px-3 py-2">{row.KET || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
