"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Globe2, RefreshCcw, Trophy, UploadCloud } from "lucide-react";
import SelectDark from "@/components/ui/SelectDark";
import type {
  compareSnapshots,
  highlights,
  Level,
  League,
} from "@/lib/pdak/ikd/analytics";
import { fmt, signed, movement } from "./format";
import HistoryChart from "./HistoryChart";
type Analysis = ReturnType<typeof compareSnapshots> & {
  league: League;
  overallCount: number;
  snapshots: { date: string; total: number; complete: boolean }[];
  highlights: ReturnType<typeof highlights>;
  cityTrend: { date: string; coverage: number | null }[];
};
type Sort =
  | "rank"
  | "coverage"
  | "rankChange"
  | "ikdAdded"
  | "growth"
  | "coverageAdded"
  | "velocity";
export default function IkdRankingPage() {
  const [data, setData] = useState<Analysis | null>(null),
    [snapshots, setSnapshots] = useState<Analysis["snapshots"]>([]),
    [level, setLevel] = useState<Level>("village"),
    [league, setLeague] = useState<League>("ALL"),
    [a, setA] = useState(""),
    [b, setB] = useState(""),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState<Sort>("rank"),
    [descending, setDescending] = useState(false),
    [page, setPage] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setPage(0);
    const q = new URLSearchParams({ level, league });
    if (a) q.set("a", a);
    if (b) q.set("b", b);
    fetch("/api/pdak/ikd/ranking?" + q, {
      cache: "no-store",
      signal: abort.signal,
    })
      .then(async (r) => {
        const p = await r.json();
        if (!r.ok || !p.success) throw new Error(p.message);
        if (!abort.signal.aborted) {
          setData(p.data);
          setSnapshots(p.data.snapshots);
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) {
          setData(null);
          setError(e.message || "Klasemen gagal dimuat.");
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [level, league, a, b, version]);
  const rows = useMemo(
    () =>
      [...(data?.rows ?? [])]
        .filter((r) =>
          `${r.code} ${r.name}`.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((x, y) => {
          const xv = x[sort],
            yv = y[sort];
          return xv === null
            ? yv === null
              ? x.code.localeCompare(y.code)
              : 1
            : yv === null
              ? -1
              : (descending ? yv - xv : xv - yv) ||
                x.code.localeCompare(y.code);
        }),
    [data, search, sort, descending],
  );
  const headers: { key: Sort; label: string; unit?: string }[] = [
    { key: "coverage", label: "Capaian IKD", unit: "%" },
    { key: "rankChange", label: "Δ Peringkat" },
    { key: "ikdAdded", label: "Δ Aktivasi" },
    { key: "growth", label: "Pertumbuhan", unit: "%" },
    { key: "coverageAdded", label: "Δ Capaian", unit: " pp" },
    { key: "velocity", label: "Aktivasi / hari" },
  ];
  const awards: {
    key: keyof Analysis["highlights"];
    label: string;
    unit: string;
    icon?: boolean;
  }[] = [
    { key: "topRanked", label: "Top Ranked", unit: "%" },
    { key: "biggestClimber", label: "Biggest Climber", unit: " posisi" },
    { key: "mostAdded", label: "Most IKD Added", unit: " aktivasi" },
    { key: "biggestGrowth", label: "Biggest Growth", unit: "%" },
    { key: "biggestDrop", label: "Biggest Drop", unit: " posisi" },
    {
      key: "mostImprovedCoverage",
      label: "Most Improved Coverage",
      unit: " pp",
    },
    {
      key: "fastestVelocity",
      label: "Daily Activation Velocity",
      unit: " / hari",
    },
  ];
  const order = (key: Sort) => {
    setDescending(sort === key ? !descending : key !== "rank");
    setSort(key);
    setPage(0);
  };
  return (
    <div className="pdak-upload">
      <section className="pdak-panel ikd-ranking">
        <header className="pdak-upload__heading">
          <div>
            <h1>
              <Globe2 size={21} /> IKD World Ranking
            </h1>
            <p>Klasemen IKD • MONALISA Kota Bandung</p>
          </div>
          <div className="pdak-toolbar">
            <Link className="pdak-upload__refresh" href="/pdak/upload">
              <UploadCloud size={15} /> Upload PDAK
            </Link>
            <button
              className="pdak-upload__refresh"
              disabled={loading}
              onClick={() => setVersion((v) => v + 1)}
            >
              <RefreshCcw size={15} /> Refresh
            </button>
          </div>
        </header>
        <nav className="pdak-tabs" aria-label="Kelompok wilayah">
          <button
            className={`pdak-tab ${level === "village" ? "is-active" : ""}`}
            aria-pressed={level === "village"}
            onClick={() => {
              setLevel("village");
              setLeague("ALL");
            }}
          >
            Kelurahan
          </button>
          <button
            className={`pdak-tab ${level === "district" ? "is-active" : ""}`}
            aria-pressed={level === "district"}
            onClick={() => {
              setLevel("district");
              setLeague("ALL");
            }}
          >
            Kecamatan
          </button>
        </nav>
        <div className="pdak-data__filters ikd-filters">
          <label>
            <span>Snapshot A • Pembanding</span>
            <SelectDark
              aria-label="Snapshot A"
              value={a}
              disabled={loading}
              onChange={(e) => setA(e.target.value)}
            >
              <option value="">
                Otomatis: {data?.dateA ?? "belum tersedia"}
              </option>
              <option value="none">Tanpa pembanding</option>
              {snapshots.map((s) => (
                <option
                  key={s.date}
                  value={s.date}
                  disabled={
                    !!(b || data?.dateB) && s.date >= (b || data?.dateB || "")
                  }
                >
                  {s.date}
                  {s.complete ? "" : " • Tidak lengkap"}
                </option>
              ))}
            </SelectDark>
          </label>
          <label>
            <span>Snapshot B • Saat ini</span>
            <SelectDark
              aria-label="Snapshot B"
              value={b}
              disabled={loading}
              onChange={(e) => setB(e.target.value)}
            >
              <option value="">
                Terbaru: {data?.dateB ?? "belum tersedia"}
              </option>
              {snapshots.map((s) => (
                <option
                  key={s.date}
                  value={s.date}
                  disabled={!!a && a !== "none" && s.date <= a}
                >
                  {s.date}
                  {s.complete ? "" : " • Tidak lengkap"}
                </option>
              ))}
            </SelectDark>
          </label>
          <label>
            <span>Liga • Ukuran pada B</span>
            <SelectDark
              aria-label="Liga wilayah"
              value={league}
              disabled={level === "district" || loading}
              onChange={(e) => setLeague(e.target.value as League)}
            >
              <option value="ALL">Semua wilayah</option>
              <option value="SMALL">Small ≤ 10.000</option>
              <option value="MEDIUM">Medium 10.001–14.999</option>
              <option value="LARGE">Large ≥ 15.000</option>
              <option value="UNKNOWN">Ukuran belum diketahui</option>
            </SelectDark>
          </label>
          <label>
            <span>Cari Wilayah</span>
            <input
              className="pdak-input"
              placeholder="Kode atau nama wilayah"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="pdak-upload__alert">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status" className="pdak-upload__empty">
            Memuat klasemen…
          </p>
        ) : (
          <>
            {data?.warning && (
              <p role="status" className="pdak-upload__alert">
                {data.warning}
              </p>
            )}
            <div className="pdak-data__meta">
              <span>
                {data?.dateA ?? "Tanpa baseline"} ↔{" "}
                {data?.dateB ?? "Belum ada snapshot"}
              </span>
              <span>{data?.days ?? "—"} hari kalender WIB</span>
              <span>
                {data?.rows.length ?? 0} peserta / {data?.overallCount ?? 0}{" "}
                wilayah
              </span>
            </div>
            <div className="ikd-highlights">
              {awards.map((award) => {
                const h = data?.highlights[award.key];
                return (
                  <article key={award.key} className="ikd-award">
                    <span>
                      <Trophy size={14} />
                      {award.label}
                      {award.key === "topRanked" &&
                      data &&
                      !data.qualityB.complete
                        ? " (sementara)"
                        : ""}
                    </span>
                    <strong>
                      {h
                        ? `${award.key === "biggestDrop" ? "↓ " : award.key === "biggestClimber" ? "↑ " : ""}${fmt(Math.abs(h.value), 2)}${award.unit}`
                        : "N/A"}
                    </strong>
                    <p>
                      {h ? (
                        <>
                          {h.regions.slice(0, 2).map((r, i) => (
                            <span key={r.code}>
                              {i ? ", " : ""}
                              <Link
                                className="ikd-region-link"
                                href={`/pdak/ikd/ranking/region/${encodeURIComponent(r.code)}${data?.dateB ? "?end=" + data.dateB : ""}`}
                              >
                                {r.name}
                              </Link>
                            </span>
                          ))}
                          {h.regions.length > 2
                            ? ` +${h.regions.length - 2} wilayah seri`
                            : ""}
                        </>
                      ) : (
                        "Belum ada hasil yang memenuhi syarat"
                      )}
                    </p>
                    {h && award.key === "topRanked" && (
                      <small className="ikd-region-code">
                        Overall Rank #{h.regions[0].rank}
                      </small>
                    )}
                  </article>
                );
              })}
            </div>
            {data?.city && (
              <section className="ikd-city">
                <strong>Kota Bandung • Agregat kota</strong>
                <span>{fmt(data.city.coverage, 2)}% IKD</span>
                <span>{fmt(data.city.ikd)} aktivasi</span>
                <span>{fmt(data.city.rekam)} rekam dinamis</span>
              </section>
            )}
            <div className="ikd-table-heading">
              <h2>
                League Table — {level === "village" ? "Kelurahan" : "Kecamatan"}
              </h2>
              <label>
                Urutkan{" "}
                <SelectDark
                  aria-label="Urutkan klasemen"
                  value={sort}
                  onChange={(e) => {
                    const key = e.target.value as Sort;
                    setSort(key);
                    setDescending(key !== "rank");
                    setPage(0);
                  }}
                >
                  <option value="rank">Peringkat utama</option>
                  {headers.map((h) => (
                    <option key={h.key} value={h.key}>
                      {h.label}
                    </option>
                  ))}
                </SelectDark>
              </label>
            </div>
            <div
              className="pdak-upload__table-wrap"
              role="region"
              tabIndex={0}
              aria-label="Klasemen IKD"
            >
              <table>
                <thead>
                  <tr>
                    <th
                      aria-sort={
                        sort === "rank"
                          ? descending
                            ? "descending"
                            : "ascending"
                          : "none"
                      }
                    >
                      <button onClick={() => order("rank")}>
                        Overall Rank
                        {data && !data.qualityB.complete ? " (sementara)" : ""}
                      </button>
                    </th>
                    <th>Wilayah</th>
                    {level === "village" && <th>League Rank</th>}
                    <th>Aktivasi IKD</th>
                    <th>Rekam Dinamis</th>
                    {headers.map((h) => (
                      <th
                        key={h.key}
                        aria-sort={
                          sort === h.key
                            ? descending
                              ? "descending"
                              : "ascending"
                            : "none"
                        }
                      >
                        <button onClick={() => order(h.key)}>{h.label}</button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(page * 20, page * 20 + 20).map((r) => (
                    <tr key={r.code}>
                      <td>
                        <strong>
                          {r.rank === null ? "N/A" : `#${r.rank}`}
                        </strong>
                      </td>
                      <td>
                        <Link
                          className="ikd-region-link"
                          href={`/pdak/ikd/ranking/region/${encodeURIComponent(r.code)}${data?.dateB ? "?end=" + data.dateB : ""}`}
                        >
                          {r.name}
                        </Link>
                        <small className="ikd-region-code">
                          {r.code}
                          {r.leagueChanged ? " • Berpindah liga" : ""}
                        </small>
                      </td>
                      {level === "village" && (
                        <td>
                          {r.leagueRank === null ? "N/A" : `#${r.leagueRank}`}
                          <small className="ikd-region-code">{r.league}</small>
                        </td>
                      )}
                      <td>{fmt(r.ikd)}</td>
                      <td>{fmt(r.rekam)}</td>
                      <td>
                        {r.coverage === null ? "N/A" : fmt(r.coverage, 2) + "%"}
                      </td>
                      <td
                        className={
                          r.rankChange && r.rankChange > 0
                            ? "ikd-up"
                            : r.rankChange && r.rankChange < 0
                              ? "ikd-down"
                              : ""
                        }
                      >
                        {movement(r.rankChange)}
                      </td>
                      <td>
                        {signed(r.ikdAdded)}
                        {r.ikdAdded !== null && r.ikdAdded < 0 && (
                          <small className="ikd-region-code">
                            Penurunan data
                          </small>
                        )}
                      </td>
                      <td>
                        {r.baselineStatus === "NEW_BASELINE"
                          ? "New Baseline"
                          : r.growth === null
                            ? "N/A"
                            : signed(r.growth, 2) + "%"}
                      </td>
                      <td>{signed(r.coverageAdded, 2)} pp</td>
                      <td>{signed(r.velocity, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <p className="pdak-upload__empty">
                  Tidak ada wilayah untuk pilihan ini.
                </p>
              )}
            </div>
            <div className="pdak-upload__actions">
              <span>
                {rows.length} wilayah • halaman {page + 1}
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
                  disabled={(page + 1) * 20 >= rows.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Berikutnya
                </button>
              </div>
            </div>
            <details className="ikd-methodology">
              <summary>Metodologi dan kualitas data</summary>
              <p>{data?.methodology}</p>
              <p>
                Referensi wilayah: {level === "village" ? 151 : 30}{" "}
                {level === "village" ? "kelurahan" : "kecamatan"}. Data B:{" "}
                {data?.qualityB.missing.length ?? 0} kode hilang,{" "}
                {data?.qualityB.unexpected.length ?? 0} kode tak dikenal,{" "}
                {data?.qualityB.invalid.length ?? 0} persentase tidak valid.
                Kode tak dikenal tidak ikut ranking.
              </p>
              <p>
                Snapshot A: {data?.qualityA?.total ?? 0} baris; B:{" "}
                {data?.qualityB.total ?? 0} baris. Delta aktivasi/capaian yang
                tersedia pada snapshot parsial hanya berlaku untuk kode yang
                berpasangan. Penghargaan periode memerlukan dua snapshot
                lengkap.
              </p>
              <p>
                Rata-rata harian memakai jeda tanggal upload, bukan catatan
                aktivitas harian. Angka negatif dapat mencerminkan koreksi data.
                Kota tidak ikut ranking dan tidak dijumlahkan dengan
                kecamatan/kelurahan.
              </p>
            </details>
            {data?.cityTrend.length ? (
              <HistoryChart
                title="Tren capaian Kota Bandung pada periode terpilih"
                points={data.cityTrend.map((p) => ({
                  date: p.date,
                  value: p.coverage,
                }))}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
