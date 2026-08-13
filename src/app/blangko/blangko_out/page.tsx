"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCcw, Save, Trash2 } from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import TypeableSelect from "@/components/ui/TypeableSelect";

type Wilayah = { NO_WIL: string; NAMA_WIL: string };
type HistDist = { NO_KEC: string; NAMA_KEC: string; PENERIMA: string; UPDATE_DT: string };
type HistKec = { NO_KEC: string; NAMA_KEC: string; UPDATE_DT: string };
type PrrSfe = { sisa_prr: string; sisa_sfe: string };

const todayDMY = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

export default function BlangkoOutPage() {
  const [tab, setTab] = useState<"master" | "distribusi" | "prr">("master");

  const [noKecReq, setNoKecReq] = useState("0");
  const [tanggal, setTanggal] = useState(todayDMY);
  const [pengambilan, setPengambilan] = useState("0");
  const [rusak, setRusak] = useState("0");
  const [pengembalian, setPengembalian] = useState("0");

  const [tanggalDis, setTanggalDis] = useState(todayDMY);
  const [penerima, setPenerima] = useState("");
  const [noKecDis, setNoKecDis] = useState("0");

  const [wilayah, setWilayah] = useState<Wilayah[]>([]);
  const [histDist, setHistDist] = useState<HistDist[]>([]);
  const [histKec, setHistKec] = useState<HistKec[]>([]);
  const [summary, setSummary] = useState<{ pengambilan: number; rusak: number; pengembalian: number; total: number }>({
    pengambilan: 0,
    rusak: 0,
    pengembalian: 0,
    total: 0,
  });
  const [prrSfe, setPrrSfe] = useState<PrrSfe>({ sisa_prr: "0", sisa_sfe: "0" });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingDis, setSavingDis] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchWilayah = async () => {
    try {
      const res = await fetch("/api/blangko/get_will", { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      const items: Wilayah[] = json.data?.items ?? json.items ?? [];
      const withDinas = items.length ? items : [];
      setWilayah(withDinas);
      if (withDinas.length) {
        setNoKecReq(withDinas[0].NO_WIL ?? "0");
        setNoKecDis(withDinas[0].NO_WIL ?? "0");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSummary = async () => {
    if (!/^\d{2}-\d{2}-\d{4}$/.test(tanggal)) return;
    try {
      const res = await fetch("/api/blangko/get_all_data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tanggal }),
      });
      const json = await res.json().catch(() => ({}));
      const data = json.data ?? json;
      setSummary({
        pengambilan: Number(data.AMBIL ?? data.pengambilan ?? 0),
        rusak: Number(data.RUSAK ?? data.rusak ?? 0),
        pengembalian: Number(data.PENGEMBALIAN ?? data.pengembalian ?? 0),
        total: Number(data.TOTAL ?? data.total ?? 0),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPrefill = async () => {
    if (!/^\d{2}-\d{2}-\d{4}$/.test(tanggal)) return;
    try {
      const res = await fetch("/api/blangko/get_data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ no_kec: Number(noKecReq || 0), tanggal }),
      });
      const json = await res.json().catch(() => ({}));
      const data = json.data ?? json;
      setPengambilan(String(data.AMBIL ?? data.pengambilan ?? 0));
      setRusak(String(data.RUSAK ?? data.rusak ?? 0));
      setPengembalian(String(data.PENGEMBALIAN ?? data.pengembalian ?? 0));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistKec = async () => {
    try {
      const res = await fetch("/api/blangko/get_histkec_dist", { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      setHistKec(json.data?.items ?? json.items ?? []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistDist = async (kec: string) => {
    const noKec = Number(kec || 0) || 0;
    if (!noKec) {
      setHistDist([]);
      return;
    }
    try {
      const res = await fetch("/api/blangko/get_hist_dist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ no_kec: noKec }),
      });
      const json = await res.json().catch(() => ({}));
      setHistDist(json.data?.items ?? json.items ?? []);
    } catch (e) {
      console.error(e);
    }
  };

const fetchPrrSfe = async () => {
  try {
      const [prrRes, sfeRes] = await Promise.all([
        fetch("/api/dashboard/m3", { cache: "no-store" }),
        fetch("/api/dashboard/m4", { cache: "no-store" }),
      ]);
      const prrJson = await prrRes.json().catch(() => ({}));
      const sfeJson = await sfeRes.json().catch(() => ({}));
      setPrrSfe({
        sisa_prr: prrJson.data?.sisa_prr ?? prrJson.sisa_prr ?? "0",
        sisa_sfe: sfeJson.data?.sisa_sfe ?? sfeJson.sisa_sfe ?? "0",
      });
  } catch (e) {
    console.error(e);
  }
};

  useEffect(() => {
    void fetchWilayah();
    void fetchSummary();
    void fetchPrefill();
    void fetchHistKec();
    void fetchPrrSfe();
  }, []);

  useEffect(() => {
    void fetchHistDist(noKecDis);
  }, [noKecDis]);

  const handleClearMaster = () => {
    setTanggal(todayDMY());
    setPengambilan("0");
    setRusak("0");
    setPengembalian("0");
    setMessage(null);
    setError(null);
    void fetchSummary();
    void fetchPrefill();
  };

  const handleClearDis = () => {
    setTanggalDis(todayDMY());
    setPenerima("");
    setMessage(null);
    setError(null);
    void fetchHistDist(noKecDis);
  };

  const handleSaveMaster = async () => {
    const ambil = Number(pengambilan);
    const rsk = Number(rusak);
    const kembali = Number(pengembalian);
    if (!/^\d{2}-\d{2}-\d{4}$/.test(tanggal)) {
      setError("Tanggal tidak valid.");
      return;
    }
    if (!Number.isFinite(ambil) || ambil <= 0) {
      setError("Pengambilan harus lebih dari 0.");
      return;
    }
    if (rsk < 0 || kembali < 0) {
      setError("Nilai tidak boleh negatif.");
      return;
    }
    if (rsk + kembali > ambil) {
      setError("Pengembalian + rusak tidak boleh melebihi pengambilan.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/blangko/do_save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          no_kec: Number(noKecReq || 0),
          tanggal,
          pengambilan: ambil,
          rusak: rsk,
          pengembalian: kembali,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menyimpan blangko keluar");
      setMessage(json.message || "Berhasil disimpan");
      await Promise.all([fetchSummary(), fetchPrefill(), fetchHistKec()]);
    } catch (e: any) {
      setError(e?.message || "Gagal menyimpan blangko keluar");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDistribusi = async () => {
    const noKec = Number(noKecDis || 0) || 0;
    if (!noKec) {
      setError("Pilih kecamatan penerima.");
      return;
    }
    if (!/^\d{2}-\d{2}-\d{4}$/.test(tanggalDis)) {
      setError("Tanggal distribusi tidak valid.");
      return;
    }
    if (!penerima.trim()) {
      setError("Penerima wajib diisi.");
      return;
    }
    setSavingDis(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/blangko/do_save_dis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          no_kec: noKec,
          tanggal: tanggalDis,
          penerima: penerima.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menyimpan distribusi");
      setMessage(json.message || "Distribusi berhasil disimpan");
      await Promise.all([fetchHistDist(noKecDis), fetchHistKec()]);
    } catch (e: any) {
      setError(e?.message || "Gagal menyimpan distribusi");
    } finally {
      setSavingDis(false);
    }
  };

  const masterSummary = useMemo(
    () => [
      { label: "Pengambilan", value: summary.pengambilan, color: "text-cyan-200" },
      { label: "Rusak", value: summary.rusak, color: "text-amber-200" },
      { label: "Pengembalian", value: summary.pengembalian, color: "text-emerald-200" },
      { label: "Yang Dibawa", value: summary.total, color: "text-fuchsia-200" },
    ],
    [summary]
  );

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[-20%] h-[880px] w-[880px] rounded-full bg-cyan-500/20 blur-[220px]" />
        <div className="absolute right-[8%] bottom-[-18%] h-[820px] w-[820px] rounded-full bg-fuchsia-600/12 blur-[200px]" />
      </div>

      <SettingPageHeader lead="Kendali Blangko" title="Blangko KTP Keluar & Distribusi" description="Catat pengeluaran dan distribusi blangko KTP." />

      <div className="rounded-2xl border border-cyan-800/50 bg-[#0b0f1c]/80 p-4 shadow-[0_0_24px_#00ffff22]">
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "master" ? "bg-cyan-600 text-black" : "bg-white/5 text-cyan-100"}`}
            onClick={() => setTab("master")}
          >
            Pengeluaran Blangko E-KTP
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "distribusi" ? "bg-cyan-600 text-black" : "bg-white/5 text-cyan-100"}`}
            onClick={() => setTab("distribusi")}
          >
            Distribusi Keping
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "prr" ? "bg-cyan-600 text-black" : "bg-white/5 text-cyan-100"}`}
            onClick={() => setTab("prr")}
          >
            Update Dashboard
          </button>
        </div>

        {message ? (
          <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">{message}</div>
        ) : null}
        {error ? (
          <div className="mt-3 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">{error}</div>
        ) : null}

        {tab === "master" ? (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_24px_#00ffff22]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" />
                    Request
                  </label>
                  <TypeableSelect
                    value={noKecReq}
                    onChange={(e) => setNoKecReq(e.target.value)}
                    className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  >
                    {wilayah.map((w) => (
                      <option key={w.NO_WIL} value={w.NO_WIL}>
                        {w.NAMA_WIL}
                      </option>
                    ))}
                  </TypeableSelect>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" />
                    Tanggal
                  </label>
                  <input
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    placeholder="DD-MM-YYYY"
                    className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" />
                    Pengambilan
                  </label>
                  <input
                    value={pengambilan}
                    onChange={(e) => setPengambilan(e.target.value.replace(/[^\d-]/g, ""))}
                    inputMode="numeric"
                    className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" />
                    Rusak
                  </label>
                  <input
                    value={rusak}
                    onChange={(e) => setRusak(e.target.value.replace(/[^\d-]/g, ""))}
                    inputMode="numeric"
                    className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" />
                    Pengembalian
                  </label>
                  <input
                    value={pengembalian}
                    onChange={(e) => setPengembalian(e.target.value.replace(/[^\d-]/g, ""))}
                    inputMode="numeric"
                    className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveMaster()}
                    disabled={saving || loading}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-50 shadow-[0_0_18px_#22c55e33] transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleClearMaster}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-white/5 px-4 py-2 text-sm text-cyan-100 hover:bg-white/10"
                  >
                    <Trash2 className="h-4 w-4" /> Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      Promise.all([fetchSummary(), fetchPrefill()]).finally(() => setLoading(false));
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                  >
                    <RefreshCcw className="h-4 w-4" /> Reload
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-800/40 bg-[#0b0f1c]/70 p-5 shadow-[0_0_24px_#00ffff22]">
              <h3 className="text-sm font-semibold text-cyan-100">Kendali Blangko</h3>
              <div className="mt-3 overflow-hidden rounded-xl border border-cyan-800/40">
                <table className="min-w-full text-sm text-cyan-100">
                  <thead className="bg-white/5 text-xs uppercase tracking-wide text-cyan-200/70">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Keterangan</th>
                      <th className="px-3 py-2 text-left">Total Blangko</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Request", value: wilayah.find((w) => w.NO_WIL === noKecReq)?.NAMA_WIL ?? "Total Blangko" },
                      { label: "Tanggal", value: tanggal || "-" },
                      { label: "Pengambilan", value: summary.pengambilan },
                      { label: "Rusak", value: summary.rusak },
                      { label: "Pengembalian", value: summary.pengembalian },
                      { label: "Yang Dibawa", value: summary.total },
                    ].map((row, idx) => (
                      <tr key={row.label} className="border-t border-cyan-900/40">
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2">{row.label}</td>
                        <td className="px-3 py-2">{typeof row.value === "number" ? row.value.toLocaleString("id-ID") : row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : tab === "distribusi" ? (
          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_24px_#00ffff22] lg:col-span-1">
              <div className="space-y-3">
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Kecamatan</label>
                  <TypeableSelect
                    value={noKecDis}
                    onChange={(e) => setNoKecDis(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  >
                    <option value="0">-- Pilih Kecamatan --</option>
                    {wilayah.map((w) => (
                      <option key={w.NO_WIL} value={w.NO_WIL}>
                        {w.NAMA_WIL}
                      </option>
                    ))}
                  </TypeableSelect>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Tanggal</label>
                  <input
                    value={tanggalDis}
                    onChange={(e) => setTanggalDis(e.target.value)}
                    placeholder="DD-MM-YYYY"
                    className="mt-1 w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Penerima Keping</label>
                  <input
                    value={penerima}
                    onChange={(e) => setPenerima(e.target.value.toUpperCase())}
                    placeholder="Nama penerima"
                    className="mt-1 w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveDistribusi()}
                    disabled={savingDis}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-50 shadow-[0_0_18px_#22c55e33] transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingDis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleClearDis}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-white/5 px-4 py-2 text-sm text-cyan-100 hover:bg-white/10"
                  >
                    <Trash2 className="h-4 w-4" /> Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      Promise.all([fetchHistDist(noKecDis), fetchHistKec()]).finally(() => setLoading(false));
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                  >
                    <RefreshCcw className="h-4 w-4" /> Reload
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-800/40 bg-[#0b0f1c]/70 p-5 shadow-[0_0_24px_#00ffff22] lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-cyan-100">Histori Pengambilan (Top 5) - {noKecDis === "0" ? "Pilih kecamatan" : noKecDis}</h3>
                <div className="mt-3 overflow-auto rounded-xl border border-cyan-800/40">
                  <table className="min-w-full text-sm text-cyan-100">
                    <thead className="bg-white/5 text-xs uppercase tracking-wide text-cyan-200/70">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Kecamatan</th>
                        <th className="px-3 py-2 text-left">Tanggal</th>
                        <th className="px-3 py-2 text-left">Penerima</th>
                      </tr>
                    </thead>
                    <tbody>
                      {histDist.length === 0 ? (
                        <tr>
                          <td className="px-3 py-2" colSpan={4}>
                            Tidak ada data
                          </td>
                        </tr>
                      ) : (
                        histDist.map((row, idx) => (
                          <tr key={`${row.NO_KEC}-${idx}`} className="border-t border-cyan-900/40">
                            <td className="px-3 py-2">{idx + 1}</td>
                            <td className="px-3 py-2">{row.NAMA_KEC}</td>
                            <td className="px-3 py-2">{row.UPDATE_DT}</td>
                            <td className="px-3 py-2">{row.PENERIMA}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-cyan-100">Pengambilan Terakhir per Kecamatan</h3>
                <div className="mt-3 overflow-auto rounded-xl border border-cyan-800/40">
                  <table className="min-w-full text-sm text-cyan-100">
                    <thead className="bg-white/5 text-xs uppercase tracking-wide text-cyan-200/70">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Kecamatan</th>
                        <th className="px-3 py-2 text-left">Tanggal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {histKec.length === 0 ? (
                        <tr>
                          <td className="px-3 py-2" colSpan={3}>
                            Tidak ada data
                          </td>
                        </tr>
                      ) : (
                        histKec.map((row, idx) => (
                          <tr key={`${row.NO_KEC}-${idx}`} className="border-t border-cyan-900/40">
                            <td className="px-3 py-2">{idx + 1}</td>
                            <td className="px-3 py-2">{row.NAMA_KEC}</td>
                            <td className="px-3 py-2">{row.UPDATE_DT}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-4 grid gap-6">
            <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_24px_#00ffff22]">
              <h3 className="text-sm font-semibold text-cyan-100">Update Dashboard Monitoring</h3>
              <p className="text-xs text-cyan-200/70">Print Ready Record dan Sent For Enrollment</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-cyan-700/30 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-cyan-200/70">Print Ready Record</p>
                  <p className="mt-1 text-3xl font-bold text-emerald-300">{prrSfe.sisa_prr}</p>
                </div>
                <div className="rounded-xl border border-cyan-700/30 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-cyan-200/70">Sent For Enrollment</p>
                  <p className="mt-1 text-3xl font-bold text-amber-300">{prrSfe.sisa_sfe}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    fetch("/api/dashboard/update_prr", { method: "POST", credentials: "include" })
                      .then(() => fetchPrrSfe())
                      .finally(() => setLoading(false));
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                >
                  <Save className="h-4 w-4" />
                  Update PRR
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    fetch("/api/dashboard/update_sfe", { method: "POST", credentials: "include" })
                      .then(() => fetchPrrSfe())
                      .finally(() => setLoading(false));
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/20"
                >
                  <Save className="h-4 w-4" />
                  Update SFE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    fetchPrrSfe().finally(() => setLoading(false));
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reload
                </button>
                <p className="text-xs text-cyan-200/70">Data diambil dari endpoint dashboard (m3/m4).</p>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

