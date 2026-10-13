"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, RefreshCcw, Table2, UploadCloud } from "lucide-react";
import SelectDark from "@/components/ui/SelectDark";
import { DATASETS, DatasetType } from "@/lib/pdak/config";
type Snapshot = {
  date: string | null;
  latestDate: string | null;
  dates: string[];
  fields: { header: string; column: string }[];
  rows: Record<string, string | number | null>[];
};
const shortNames = {
  KIA: "KIA",
  AKTA_KELAHIRAN: "Akta Kelahiran",
  PEREKAMAN_KTPL: "Perekaman KTP-el",
  IKD: "Aktivasi IKD",
};
export default function PdakDataPage() {
  const [type, setType] = useState<DatasetType>("KIA"),
    [date, setDate] = useState(""),
    [data, setData] = useState<Snapshot | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [search, setSearch] = useState(""),
    [level, setLevel] = useState("all"),
    [page, setPage] = useState(0),
    [allColumns, setAllColumns] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setError("");
    setPage(0);
    const params = new URLSearchParams({ dataset: type });
    if (date) params.set("date", date);
    fetch("/api/pdak/data?" + params, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const p = await r.json();
        if (!r.ok || !p.success) throw new Error(p.message);
        if (!controller.signal.aborted) setData(p.data);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(e.message || "Gagal memuat data.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [type, date, version]);
  const filtered = useMemo(
    () =>
      data?.rows.filter(
        (r) =>
          (level === "all" ||
            String(r.KODE).split(".").length === Number(level)) &&
          `${r.KODE} ${r.WILAYAH}`.toLowerCase().includes(search.toLowerCase()),
      ) ?? [],
    [data, level, search],
  );
  const fields =
    data?.fields.filter(
      (f, i) =>
        allColumns ||
        i < 4 ||
        /PERSEN/.test(f.column) ||
        (/DINAMIS|PROGRES/.test(f.column) &&
          /JML|TTL|REKAM$|WKTP/.test(f.column)),
    ) ?? [];
  const counts = (segments: number) =>
    data?.rows.filter((r) => String(r.KODE).split(".").length === segments)
      .length ?? 0;
  return (
    <div className="pdak-upload pdak-data">
      <section className="pdak-panel">
        <header className="pdak-upload__heading">
          <div>
            <h1>
              <Table2 size={19} /> Data PDAK
            </h1>
            <p>Monitoring Data Kependudukan • Kota Bandung</p>
          </div>
          <div className="pdak-toolbar">
            <Link className="pdak-upload__refresh" href="/pdak/upload">
              <UploadCloud size={15} /> Upload Data
            </Link>
            <Link className="pdak-upload__refresh" href="/pdak/ikd/ranking">
              Klasemen IKD
            </Link>
            <button
              className="pdak-upload__refresh"
              onClick={() => setVersion((v) => v + 1)}
              disabled={loading}
            >
              <RefreshCcw size={15} /> Refresh
            </button>
          </div>
        </header>
        <nav className="pdak-tabs" aria-label="Kategori data PDAK">
          {DATASETS.map((d) => (
            <button
              key={d.type}
              type="button"
              aria-pressed={type === d.type}
              className={`pdak-tab ${type === d.type ? "is-active" : ""}`}
              onClick={() => {
                setType(d.type);
                setSearch("");
              }}
            >
              {shortNames[d.type]}
            </button>
          ))}
        </nav>
        <div className="pdak-data__filters">
          <label>
            <span>
              <CalendarDays size={14} /> Tanggal Snapshot (WIB)
            </span>
            <SelectDark
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={loading}
              aria-label="Tanggal snapshot"
            >
              <option value="">
                Terbaru{data?.latestDate ? ` — ${data.latestDate}` : ""}
              </option>
              {date && !data?.dates.includes(date) && (
                <option value={date}>{date} — belum ada snapshot</option>
              )}
              {data?.dates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </SelectDark>
          </label>
          <label>
            <span>Level Wilayah</span>
            <SelectDark
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">Semua Wilayah</option>
              <option value="2">Kota</option>
              <option value="3">Kecamatan</option>
              <option value="4">Kelurahan</option>
            </SelectDark>
          </label>
          <label>
            <span>Cari Wilayah</span>
            <input
              className="pdak-input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Kode atau nama wilayah"
            />
          </label>
          <label className="pdak-columns">
            <input
              type="checkbox"
              checked={allColumns}
              onChange={(e) => setAllColumns(e.target.checked)}
            />{" "}
            Semua kolom
          </label>
        </div>
        <div className="pdak-data__meta">
          <span>
            Snapshot: <strong>{data?.date ?? "—"}</strong>
          </span>
          <span>
            Kota: {counts(2)} / Kecamatan: {counts(3)} / Kelurahan: {counts(4)}
          </span>
          <span>{filtered.length} baris</span>
        </div>
        {loading ? (
          <p className="pdak-upload__empty" role="status">
            Memuat snapshot…
          </p>
        ) : error ? (
          <p role="alert" className="pdak-upload__alert">
            {error}
          </p>
        ) : !data?.rows.length ? (
          <p className="pdak-upload__empty">
            {date
              ? "Tidak ada data pada tanggal yang dipilih."
              : "Belum ada snapshot. Unggah data PDAK untuk menampilkan laporan."}
          </p>
        ) : (
          <>
            <div
              className="pdak-upload__table-wrap pdak-data__table"
              tabIndex={0}
              role="region"
              aria-label="Tabel snapshot PDAK"
            >
              <table>
                <thead>
                  <tr>
                    {fields.map((f) => (
                      <th key={f.column}>{f.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(page * 20, page * 20 + 20).map((r) => (
                    <tr
                      key={String(r.KODE)}
                      className={
                        String(r.KODE).split(".").length === 2
                          ? "pdak-city"
                          : ""
                      }
                    >
                      {fields.map((f) => (
                        <td key={f.column}>
                          {typeof r[f.column] === "number"
                            ? new Intl.NumberFormat("id-ID", {
                                maximumFractionDigits: 4,
                              }).format(r[f.column] as number)
                            : (r[f.column] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filtered.length && (
                <p className="pdak-upload__empty">Wilayah tidak ditemukan.</p>
              )}
            </div>
            <div className="pdak-upload__actions">
              <span>
                Menampilkan{" "}
                {filtered.length ? Math.min(page * 20 + 1, filtered.length) : 0}
                –{Math.min(page * 20 + 20, filtered.length)} dari{" "}
                {filtered.length} wilayah
              </span>
              <div className="pdak-toolbar">
                <button
                  className="pdak-upload__refresh"
                  disabled={!page}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Sebelumnya
                </button>
                <button
                  className="pdak-upload__refresh"
                  disabled={(page + 1) * 20 >= filtered.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
