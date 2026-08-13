"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCcw, Save, Trash2 } from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import TypeableSelect from "@/components/ui/TypeableSelect";

type Wilayah = { NO_WIL: string; NAMA_WIL: string };
type Barang = { JENIS_BARANG: number; NAMA_BARANG: string };
type StockRow = { JENIS_BARANG: number; NAMA_BARANG: string; JUMLAH: number; TANGGAL: string };

const todayDMY = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const numberOnly = (val: string) => val.replace(/[^\d]/g, "");

export default function DistributionOutPage() {
  const [tab, setTab] = useState<"in" | "out">("in");

  const [wilayah, setWilayah] = useState<Wilayah[]>([]);
  const [barang, setBarang] = useState<Barang[]>([]);

  const [noKecIn, setNoKecIn] = useState("");
  const [noKecOut, setNoKecOut] = useState("");

  const [tanggalIn, setTanggalIn] = useState(todayDMY());
  const [tanggalOut, setTanggalOut] = useState(todayDMY());

  const [jnsIn, setJnsIn] = useState("0");
  const [jnsOut, setJnsOut] = useState("0");

  const [jumlahIn, setJumlahIn] = useState("0");
  const [jumlahOut, setJumlahOut] = useState("0");

  const [penerimaIn, setPenerimaIn] = useState("");
  const [penerimaOut, setPenerimaOut] = useState("");

  const [ketIn, setKetIn] = useState("");
  const [ketOut, setKetOut] = useState("");

  const [stockIn, setStockIn] = useState<StockRow[]>([]);
  const [stockOut, setStockOut] = useState<StockRow[]>([]);
  const [stockTitleIn, setStockTitleIn] = useState<string | null>(null);
  const [stockTitleOut, setStockTitleOut] = useState<string | null>(null);

  const [loadingStockIn, setLoadingStockIn] = useState(false);
  const [loadingStockOut, setLoadingStockOut] = useState(false);
  const [savingIn, setSavingIn] = useState(false);
  const [savingOut, setSavingOut] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchWilayah = async () => {
    try {
      const res = await fetch("/api/blangko/get_will", { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      const items: Wilayah[] = json.data?.items ?? json.items ?? [];
      setWilayah(items);
      if (items.length) {
        const first = items[0].NO_WIL ?? "";
        setNoKecIn(first);
        setNoKecOut(first);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBarang = async () => {
    try {
      const res = await fetch("/api/blangko/distribution/get_barang", { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      const payload = json?.data ?? {};
      const items = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
        ? payload
        : [];
      setBarang(items);
    } catch (e) {
      console.error(e);
      setBarang([]);
    }
  };

  const fetchStock = async (noKec: string, mode: "in" | "out") => {
    const targetSetter = mode === "in" ? setStockIn : setStockOut;
    const setLoading = mode === "in" ? setLoadingStockIn : setLoadingStockOut;
    const setTitle = mode === "in" ? setStockTitleIn : setStockTitleOut;
    const parsed = Number(noKec);
    if (!Number.isFinite(parsed)) {
      targetSetter([]);
      setTitle(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/blangko/distribution/get_stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ no_kec: parsed }),
      });
      const json = await res.json().catch(() => ({}));
      const payload = json?.data ?? {};
      const items: StockRow[] = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
        ? payload
        : [];
      targetSetter(items);
      const title = json?.title ?? payload?.title ?? payload?.NAMA_WIL ?? null;
      setTitle(title || null);
    } catch (e) {
      console.error(e);
      targetSetter([]);
      setTitle(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchWilayah();
    void fetchBarang();
  }, []);

  useEffect(() => {
    if (noKecIn !== "") void fetchStock(noKecIn, "in");
  }, [noKecIn]);

  useEffect(() => {
    if (noKecOut !== "") void fetchStock(noKecOut, "out");
  }, [noKecOut]);

  const handleClearIn = () => {
    setTanggalIn(todayDMY());
    setJumlahIn("0");
    setPenerimaIn("");
    setKetIn("");
    setJnsIn("0");
    setMessage(null);
    setError(null);
  };

  const handleClearOut = () => {
    setTanggalOut(todayDMY());
    setJumlahOut("0");
    setPenerimaOut("");
    setKetOut("");
    setJnsOut("0");
    setMessage(null);
    setError(null);
  };

  const handleSaveIn = async () => {
    const jumlah = Number(jumlahIn);
    if (!Number.isFinite(jumlah) || jumlah <= 0) {
      setError("Jumlah penerimaan harus lebih dari 0.");
      return;
    }
    if (!penerimaIn.trim()) {
      setError("Petugas penerimaan wajib diisi.");
      return;
    }
    if (!/^\d{2}-\d{2}-\d{4}$/.test(tanggalIn)) {
      setError("Tanggal penerimaan tidak valid.");
      return;
    }
    if (jnsIn === "0") {
      setError("Jenis barang wajib dipilih.");
      return;
    }
    setSavingIn(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/blangko/distribution/do_save_in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          no_kec: Number(noKecIn || 0),
          tanggal: tanggalIn,
          jns_barang: Number(jnsIn),
          jumlah,
          penerima: penerimaIn.trim().toUpperCase(),
          ket: ketIn.trim().toUpperCase(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menyimpan penerimaan.");
      setMessage(json.message || "Data penerimaan berhasil disimpan.");
      await fetchStock(noKecIn, "in");
    } catch (e: any) {
      setError(e?.message || "Gagal menyimpan penerimaan.");
    } finally {
      setSavingIn(false);
    }
  };

  const handleSaveOut = async () => {
    const jumlah = Number(jumlahOut);
    if (!Number.isFinite(jumlah) || jumlah <= 0) {
      setError("Jumlah pengeluaran harus lebih dari 0.");
      return;
    }
    if (!penerimaOut.trim()) {
      setError("Petugas pengeluaran wajib diisi.");
      return;
    }
    if (!/^\d{2}-\d{2}-\d{4}$/.test(tanggalOut)) {
      setError("Tanggal pengeluaran tidak valid.");
      return;
    }
    if (jnsOut === "0") {
      setError("Jenis barang wajib dipilih.");
      return;
    }
    setSavingOut(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/blangko/distribution/do_save_out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          no_kec: Number(noKecOut || 0),
          tanggal: tanggalOut,
          jns_barang: Number(jnsOut),
          jumlah,
          penerima: penerimaOut.trim().toUpperCase(),
          ket: ketOut.trim().toUpperCase(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menyimpan pengeluaran.");
      setMessage(json.message || "Data pengeluaran berhasil disimpan.");
      await fetchStock(noKecOut, "out");
    } catch (e: any) {
      setError(e?.message || "Gagal menyimpan pengeluaran.");
    } finally {
      setSavingOut(false);
    }
  };

  const currentStock = useMemo(() => (tab === "in" ? stockIn : stockOut), [tab, stockIn, stockOut]);
  const currentWilayahName = useMemo(() => {
    const no = tab === "in" ? noKecIn : noKecOut;
    const fromList = wilayah.find((w) => w.NO_WIL === no)?.NAMA_WIL;
    const fromStock = tab === "in" ? stockTitleIn : stockTitleOut;
    return fromList || fromStock || "-";
  }, [tab, wilayah, noKecIn, noKecOut, stockTitleIn, stockTitleOut]);

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[12%] top-[-14%] h-[880px] w-[880px] rounded-full bg-cyan-500/18 blur-[240px]" />
        <div className="absolute right-[8%] bottom-[-18%] h-[820px] w-[820px] rounded-full bg-indigo-600/14 blur-[200px]" />
      </div>

      <SettingPageHeader lead="Kendali Distribusi" title="Distribusi Aset Kewilayahan" description="Catat penerimaan dan pengeluaran aset blangko per kecamatan." />

      <div className="rounded-2xl border border-cyan-800/50 bg-[#0b0f1c]/80 p-4 shadow-[0_0_24px_#00ffff22]">
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "in" ? "bg-cyan-600 text-black" : "bg-white/5 text-cyan-100"}`}
            onClick={() => setTab("in")}
          >
            Penerimaan Aset
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "out" ? "bg-cyan-600 text-black" : "bg-white/5 text-cyan-100"}`}
            onClick={() => setTab("out")}
          >
            Pengeluaran Aset
          </button>
        </div>

        {message ? (
          <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">{message}</div>
        ) : null}
        {error ? (
          <div className="mt-3 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">{error}</div>
        ) : null}

        {tab === "in" ? (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_24px_#00ffff22]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" />
                    Request (Kecamatan)
                  </label>
                  <TypeableSelect
                    value={noKecIn}
                    onChange={(e) => setNoKecIn(e.target.value)}
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
                    Jenis Barang
                  </label>
                  <TypeableSelect
                    value={jnsIn}
                    onChange={(e) => setJnsIn(e.target.value)}
                    className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  >
                    <option value="0">-- JENIS BARANG --</option>
                    {barang.map((b) => (
                      <option key={b.JENIS_BARANG} value={b.JENIS_BARANG}>
                        {b.JENIS_BARANG}. {b.NAMA_BARANG}
                      </option>
                    ))}
                  </TypeableSelect>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" />
                    Tanggal Penerimaan
                  </label>
                  <input
                    value={tanggalIn}
                    onChange={(e) => setTanggalIn(e.target.value)}
                    placeholder="DD-MM-YYYY"
                    className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" />
                    Jumlah Penerimaan
                  </label>
                  <input
                    value={jumlahIn}
                    onChange={(e) => setJumlahIn(numberOnly(e.target.value))}
                    inputMode="numeric"
                    className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" />
                    Petugas Penerimaan
                  </label>
                  <input
                    value={penerimaIn}
                    onChange={(e) => setPenerimaIn(e.target.value.toUpperCase())}
                    placeholder="Nama petugas penerima"
                    className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" />
                    Keterangan
                  </label>
                  <textarea
                    value={ketIn}
                    onChange={(e) => setKetIn(e.target.value.toUpperCase())}
                    className="h-20 w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveIn()}
                    disabled={savingIn}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-50 shadow-[0_0_18px_#22c55e33] transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleClearIn}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-white/5 px-4 py-2 text-sm text-cyan-100 hover:bg-white/10"
                  >
                    <Trash2 className="h-4 w-4" /> Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoadingStockIn(true);
                      fetchStock(noKecIn, "in").finally(() => setLoadingStockIn(false));
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                  >
                    <RefreshCcw className="h-4 w-4" /> Reload
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-800/40 bg-[#0b0f1c]/70 p-5 shadow-[0_0_24px_#00ffff22]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-cyan-100">Kendali Stok Wilayah</h3>
                  <p className="text-xs text-cyan-200/70">{currentWilayahName}</p>
                </div>
                {loadingStockIn ? <Loader2 className="h-4 w-4 animate-spin text-cyan-200" /> : null}
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-cyan-800/40">
                <table className="min-w-full text-sm text-cyan-100">
                  <thead className="bg-white/5 text-xs uppercase tracking-wide text-cyan-200/70">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Nama Barang</th>
                      <th className="px-3 py-2 text-left">Jumlah</th>
                      <th className="px-3 py-2 text-left">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentStock.map((row, idx) => (
                      <tr key={`${row.JENIS_BARANG}-${row.NAMA_BARANG}`} className="border-t border-cyan-900/40">
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2">{row.NAMA_BARANG}</td>
                        <td className="px-3 py-2">{Number(row.JUMLAH ?? 0).toLocaleString("id-ID")}</td>
                        <td className="px-3 py-2">{row.TANGGAL || "-"}</td>
                      </tr>
                    ))}
                    {!currentStock.length ? (
                      <tr className="border-t border-cyan-900/40">
                        <td className="px-3 py-4 text-center text-cyan-300/70" colSpan={4}>
                          {loadingStockIn ? "Memuat data..." : "Belum ada data stok."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_24px_#00ffff22]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" />
                    Request (Kecamatan)
                  </label>
                  <TypeableSelect
                    value={noKecOut}
                    onChange={(e) => setNoKecOut(e.target.value)}
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
                    Jenis Barang
                  </label>
                  <TypeableSelect
                    value={jnsOut}
                    onChange={(e) => setJnsOut(e.target.value)}
                    className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  >
                    <option value="0">-- JENIS BARANG --</option>
                    {barang.map((b) => (
                      <option key={b.JENIS_BARANG} value={b.JENIS_BARANG}>
                        {b.JENIS_BARANG}. {b.NAMA_BARANG}
                      </option>
                    ))}
                  </TypeableSelect>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" />
                    Tanggal Pengeluaran
                  </label>
                  <input
                    value={tanggalOut}
                    onChange={(e) => setTanggalOut(e.target.value)}
                    placeholder="DD-MM-YYYY"
                    className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" />
                    Jumlah Pengeluaran
                  </label>
                  <input
                    value={jumlahOut}
                    onChange={(e) => setJumlahOut(numberOnly(e.target.value))}
                    inputMode="numeric"
                    className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" />
                    Petugas Pengeluaran
                  </label>
                  <input
                    value={penerimaOut}
                    onChange={(e) => setPenerimaOut(e.target.value.toUpperCase())}
                    placeholder="Nama petugas pengeluaran"
                    className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-cyan-100">
                    <input type="checkbox" checked readOnly className="lux-checkbox" />
                    Keterangan
                  </label>
                  <textarea
                    value={ketOut}
                    onChange={(e) => setKetOut(e.target.value.toUpperCase())}
                    className="h-20 w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveOut()}
                    disabled={savingOut}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-50 shadow-[0_0_18px_#22c55e33] transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={handleClearOut}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-white/5 px-4 py-2 text-sm text-cyan-100 hover:bg-white/10"
                  >
                    <Trash2 className="h-4 w-4" /> Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoadingStockOut(true);
                      fetchStock(noKecOut, "out").finally(() => setLoadingStockOut(false));
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                  >
                    <RefreshCcw className="h-4 w-4" /> Reload
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-800/40 bg-[#0b0f1c]/70 p-5 shadow-[0_0_24px_#00ffff22]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-cyan-100">Kendali Stok Wilayah</h3>
                  <p className="text-xs text-cyan-200/70">{currentWilayahName}</p>
                </div>
                {loadingStockOut ? <Loader2 className="h-4 w-4 animate-spin text-cyan-200" /> : null}
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-cyan-800/40">
                <table className="min-w-full text-sm text-cyan-100">
                  <thead className="bg-white/5 text-xs uppercase tracking-wide text-cyan-200/70">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Nama Barang</th>
                      <th className="px-3 py-2 text-left">Jumlah</th>
                      <th className="px-3 py-2 text-left">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentStock.map((row, idx) => (
                      <tr key={`${row.JENIS_BARANG}-${row.NAMA_BARANG}`} className="border-t border-cyan-900/40">
                        <td className="px-3 py-2">{idx + 1}</td>
                        <td className="px-3 py-2">{row.NAMA_BARANG}</td>
                        <td className="px-3 py-2">{Number(row.JUMLAH ?? 0).toLocaleString("id-ID")}</td>
                        <td className="px-3 py-2">{row.TANGGAL || "-"}</td>
                      </tr>
                    ))}
                    {!currentStock.length ? (
                      <tr className="border-t border-cyan-900/40">
                        <td className="px-3 py-4 text-center text-cyan-300/70" colSpan={4}>
                          {loadingStockOut ? "Memuat data..." : "Belum ada data stok."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

