"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Search } from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";

type Wilayah = { NO_WIL: string; NAMA_WIL: string };
type Barang = { JENIS_BARANG: number; NAMA_BARANG: string };
type StockRow = { NO_WIL: number; NAMA_WIL: string; JENIS_BARANG: number; NAMA_BARANG: string; JUMLAH: number; TANGGAL: string };
type LogRow = { NO_KEC: number; NAMA_WIL: string; JENIS_BARANG: number; NAMA_BARANG: string; JUMLAH: number; TANGGAL: string; PENERIMA: string; KATEGORI: string };

const todayDMY = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

export default function DistributionRekapPage() {
  const [wilayah, setWilayah] = useState<Wilayah[]>([]);
  const [barang, setBarang] = useState<Barang[]>([]);

  const [filterWil, setFilterWil] = useState("0");
  const [filterBarang, setFilterBarang] = useState("0");
  const [filterBarang2, setFilterBarang2] = useState("0");
  const [filterWil2, setFilterWil2] = useState("0");
  const [filterKat, setFilterKat] = useState("-");
  const [tglStart, setTglStart] = useState(todayDMY());
  const [tglEnd, setTglEnd] = useState(todayDMY());

  const [dataByBarang, setDataByBarang] = useState<StockRow[]>([]);
  const [dataByWilayah, setDataByWilayah] = useState<StockRow[]>([]);
  const [dataLog, setDataLog] = useState<LogRow[]>([]);

  const [loadingBarang, setLoadingBarang] = useState(false);
  const [loadingWilayah, setLoadingWilayah] = useState(false);
  const [loadingLog, setLoadingLog] = useState(false);

  const fetchWilayah = async () => {
    try {
      const res = await fetch("/api/blangko/get_will", { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      const items: Wilayah[] = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data?.items)
        ? json.data.items
        : Array.isArray(json?.data)
        ? json.data
        : [];
      setWilayah(items);
    } catch (e) {
      console.error(e);
      setWilayah([]);
    }
  };

  const fetchBarang = async () => {
    try {
      const res = await fetch("/api/blangko/distribution/get_barang", { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      const items: Barang[] = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data?.items)
        ? json.data.items
        : Array.isArray(json?.data)
        ? json.data
        : [];
      setBarang(items);
    } catch (e) {
      console.error(e);
      setBarang([]);
    }
  };

  const loadByBarang = async () => {
    setLoadingBarang(true);
    try {
      const res = await fetch("/api/blangko/distribution/by_barang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ jns_barang: Number(filterBarang || 0) }),
      });
      const json = await res.json().catch(() => ({}));
      const items: StockRow[] = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data?.items)
        ? json.data.items
        : Array.isArray(json?.data)
        ? json.data
        : [];
      setDataByBarang(items);
    } catch (e) {
      console.error(e);
      setDataByBarang([]);
    } finally {
      setLoadingBarang(false);
    }
  };

  const loadByWilayah = async () => {
    setLoadingWilayah(true);
    try {
      const res = await fetch("/api/blangko/distribution/by_wilayah", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ no_wil: Number(filterWil || 0) }),
      });
      const json = await res.json().catch(() => ({}));
      const items: StockRow[] = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data?.items)
        ? json.data.items
        : Array.isArray(json?.data)
        ? json.data
        : [];
      setDataByWilayah(items);
    } catch (e) {
      console.error(e);
      setDataByWilayah([]);
    } finally {
      setLoadingWilayah(false);
    }
  };

  const loadLog = async () => {
    setLoadingLog(true);
    try {
      const res = await fetch("/api/blangko/distribution/stockreport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tgl_start: tglStart,
          tgl_end: tglEnd,
          no_wil: Number(filterWil2 || 0),
          jns_barang: Number(filterBarang2 || 0),
          kategori: filterKat,
        }),
      });
      const json = await res.json().catch(() => ({}));
      const items: LogRow[] = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data?.items)
        ? json.data.items
        : Array.isArray(json?.data)
        ? json.data
        : [];
      setDataLog(items);
    } catch (e) {
      console.error(e);
      setDataLog([]);
    } finally {
      setLoadingLog(false);
    }
  };

  useEffect(() => {
    void fetchWilayah();
    void fetchBarang();
    void loadByBarang();
    void loadByWilayah();
    void loadLog();
  }, []);

  const wilayahLabel = (no: number | string) => wilayah.find((w) => w.NO_WIL === String(no))?.NAMA_WIL ?? "-";
  const barangLabel = (no: number) => barang.find((b) => b.JENIS_BARANG === no)?.NAMA_BARANG ?? "-";

  const summaryBarang = useMemo(
    () =>
      dataByBarang.reduce<Record<number, number>>((acc, row) => {
        acc[row.JENIS_BARANG] = (acc[row.JENIS_BARANG] ?? 0) + Number(row.JUMLAH ?? 0);
        return acc;
      }, {}),
    [dataByBarang]
  );

  const summaryWilayah = useMemo(
    () =>
      dataByWilayah.reduce<Record<string, number>>((acc, row) => {
        acc[String(row.NO_WIL)] = (acc[String(row.NO_WIL)] ?? 0) + Number(row.JUMLAH ?? 0);
        return acc;
      }, {}),
    [dataByWilayah]
  );

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[12%] top-[-14%] h-[880px] w-[880px] rounded-full bg-cyan-500/18 blur-[240px]" />
        <div className="absolute right-[8%] bottom-[-18%] h-[820px] w-[820px] rounded-full bg-indigo-600/14 blur-[200px]" />
      </div>

      <SettingPageHeader lead="Kendali Distribusi" title="Rekap Distribusi Wilayah" description="Laporan stok aset kewilayahan per barang, per wilayah, dan riwayat transaksi." />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_24px_#00ffff22]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-cyan-100">Stok per Barang</h3>
              <p className="text-xs text-cyan-200/70">Rekap stok berdasarkan jenis barang.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadByBarang()}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-700/50 bg-white/5 px-3 py-1.5 text-xs text-cyan-100 hover:bg-white/10"
            >
              <RefreshCcw className="h-4 w-4" /> Reload
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select
              value={filterBarang}
              onChange={(e) => setFilterBarang(e.target.value)}
              className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
            >
              <option value="0">Semua Barang</option>
              {barang.map((b) => (
                <option key={b.JENIS_BARANG} value={b.JENIS_BARANG}>
                  {b.JENIS_BARANG}. {b.NAMA_BARANG}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadByBarang()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-500/25"
            >
              <Search className="h-4 w-4" /> Cari
            </button>
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-cyan-800/40">
            <table className="min-w-full text-sm text-cyan-100">
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-cyan-200/70">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Wilayah</th>
                  <th className="px-3 py-2 text-left">Barang</th>
                  <th className="px-3 py-2 text-left">Jumlah</th>
                  <th className="px-3 py-2 text-left">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {dataByBarang.map((row, idx) => (
                  <tr key={`${row.NO_WIL}-${row.JENIS_BARANG}`} className="border-t border-cyan-900/40">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2">{row.NAMA_WIL}</td>
                    <td className="px-3 py-2">{row.NAMA_BARANG}</td>
                    <td className="px-3 py-2">{Number(row.JUMLAH ?? 0).toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2">{row.TANGGAL || "-"}</td>
                  </tr>
                ))}
                {!dataByBarang.length ? (
                  <tr className="border-t border-cyan-900/40">
                    <td className="px-3 py-4 text-center text-cyan-300/70" colSpan={5}>
                      {loadingBarang ? "Memuat data..." : "Tidak ada data."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-cyan-200/70">
            Total Barang Dipilih: {Number(summaryBarang[Number(filterBarang) || 0] ?? dataByBarang.reduce((s, r) => s + Number(r.JUMLAH ?? 0), 0)).toLocaleString("id-ID")}
          </p>
        </section>

        <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_24px_#00ffff22]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-cyan-100">Stok per Wilayah</h3>
              <p className="text-xs text-cyan-200/70">Rekap stok per kecamatan.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadByWilayah()}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-700/50 bg-white/5 px-3 py-1.5 text-xs text-cyan-100 hover:bg-white/10"
            >
              <RefreshCcw className="h-4 w-4" /> Reload
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select
              value={filterWil}
              onChange={(e) => setFilterWil(e.target.value)}
              className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
            >
              <option value="0">Semua Wilayah</option>
              {wilayah.map((w) => (
                <option key={w.NO_WIL} value={w.NO_WIL}>
                  {w.NAMA_WIL}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadByWilayah()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-500/25"
            >
              <Search className="h-4 w-4" /> Cari
            </button>
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-cyan-800/40">
            <table className="min-w-full text-sm text-cyan-100">
              <thead className="bg-white/5 text-xs uppercase tracking-wide text-cyan-200/70">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Wilayah</th>
                  <th className="px-3 py-2 text-left">Barang</th>
                  <th className="px-3 py-2 text-left">Jumlah</th>
                  <th className="px-3 py-2 text-left">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {dataByWilayah.map((row, idx) => (
                  <tr key={`${row.NO_WIL}-${row.JENIS_BARANG}`} className="border-t border-cyan-900/40">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2">{row.NAMA_WIL}</td>
                    <td className="px-3 py-2">{row.NAMA_BARANG}</td>
                    <td className="px-3 py-2">{Number(row.JUMLAH ?? 0).toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2">{row.TANGGAL || "-"}</td>
                  </tr>
                ))}
                {!dataByWilayah.length ? (
                  <tr className="border-t border-cyan-900/40">
                    <td className="px-3 py-4 text-center text-cyan-300/70" colSpan={5}>
                      {loadingWilayah ? "Memuat data..." : "Tidak ada data."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-cyan-200/70">
            Total Wilayah: {summaryWilayah[filterWil] ? Number(summaryWilayah[filterWil]).toLocaleString("id-ID") : dataByWilayah.reduce((s, r) => s + Number(r.JUMLAH ?? 0), 0).toLocaleString("id-ID")}
          </p>
        </section>
      </div>

      <section className="rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_24px_#00ffff22]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-cyan-100">Log Distribusi (IN/OUT)</h3>
            <p className="text-xs text-cyan-200/70">Filter berdasarkan tanggal, wilayah, jenis barang, dan kategori.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadLog()}
            className="inline-flex items-center gap-1 rounded-lg border border-cyan-700/50 bg-white/5 px-3 py-1.5 text-xs text-cyan-100 hover:bg-white/10"
          >
            <RefreshCcw className="h-4 w-4" /> Reload
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2">
            <input
              value={tglStart}
              onChange={(e) => setTglStart(e.target.value)}
              placeholder="DD-MM-YYYY"
              className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
            />
            <span className="text-cyan-200/70 text-sm">s/d</span>
            <input
              value={tglEnd}
              onChange={(e) => setTglEnd(e.target.value)}
              placeholder="DD-MM-YYYY"
              className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
            />
          </div>
          <select
            value={filterWil2}
            onChange={(e) => setFilterWil2(e.target.value)}
            className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
          >
            <option value="0">Semua Wilayah</option>
            {wilayah.map((w) => (
              <option key={w.NO_WIL} value={w.NO_WIL}>
                {w.NAMA_WIL}
              </option>
            ))}
          </select>
          <select
            value={filterBarang2}
            onChange={(e) => setFilterBarang2(e.target.value)}
            className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
          >
            <option value="0">Semua Barang</option>
            {barang.map((b) => (
              <option key={b.JENIS_BARANG} value={b.JENIS_BARANG}>
                {b.JENIS_BARANG}. {b.NAMA_BARANG}
              </option>
            ))}
          </select>
          <select
            value={filterKat}
            onChange={(e) => setFilterKat(e.target.value)}
            className="w-full rounded-lg border border-cyan-700/50 bg-[#10192d] px-3 py-2 text-sm text-cyan-50 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
          >
            <option value="-">Semua Kategori</option>
            <option value="IN">Penerimaan (IN)</option>
            <option value="OUT">Pengeluaran (OUT)</option>
          </select>
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void loadLog()}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-500/25"
          >
            <Search className="h-4 w-4" /> Cari
          </button>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-cyan-800/40">
          <table className="min-w-full text-sm text-cyan-100">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-cyan-200/70">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Wilayah</th>
                <th className="px-3 py-2 text-left">Barang</th>
                <th className="px-3 py-2 text-left">Jumlah</th>
                <th className="px-3 py-2 text-left">Tanggal</th>
                <th className="px-3 py-2 text-left">Kategori</th>
                <th className="px-3 py-2 text-left">Penerima</th>
              </tr>
            </thead>
            <tbody>
              {dataLog.map((row, idx) => (
                <tr key={`${row.NO_KEC}-${row.JENIS_BARANG}-${row.TANGGAL}-${idx}`} className="border-t border-cyan-900/40">
                  <td className="px-3 py-2">{idx + 1}</td>
                  <td className="px-3 py-2">{row.NAMA_WIL}</td>
                  <td className="px-3 py-2">{row.NAMA_BARANG}</td>
                  <td className="px-3 py-2">{Number(row.JUMLAH ?? 0).toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2">{row.TANGGAL || "-"}</td>
                  <td className="px-3 py-2">{row.KATEGORI}</td>
                  <td className="px-3 py-2">{row.PENERIMA}</td>
                </tr>
              ))}
              {!dataLog.length ? (
                <tr className="border-t border-cyan-900/40">
                  <td className="px-3 py-4 text-center text-cyan-300/70" colSpan={7}>
                    {loadingLog ? "Memuat data..." : "Tidak ada data."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
