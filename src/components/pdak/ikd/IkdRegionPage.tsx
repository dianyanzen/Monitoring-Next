"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { fmt, movement } from "./format";
import HistoryChart from "./HistoryChart";
type Point = {
  date: string;
  rank: number | null;
  coverage: number | null;
  ikd: number | null;
  rekam: number | null;
  complete: boolean;
};
type Profile = {
  code: string;
  name: string;
  level: string;
  points: Point[];
  currentRank: number | null;
  previousRank: number | null;
  previousDate: string | null;
  highestRank: number | null;
  lowestRank: number | null;
  averageRank: number | null;
  biggestClimb: number | null;
  biggestFall: number | null;
  validSnapshots: number;
  methodology: string;
};
export default function IkdRegionPage({ code }: { code: string }) {
  const search = useSearchParams(),
    end = search.get("end");
  const [data, setData] = useState<Profile | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState(0),
    [version, setVersion] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    fetch(
      `/api/pdak/ikd/region/${encodeURIComponent(code)}${end ? "?end=" + encodeURIComponent(end) : ""}`,
      { cache: "no-store", signal: abort.signal },
    )
      .then(async (r) => {
        const p = await r.json();
        if (!r.ok || !p.success) throw new Error(p.message);
        if (!abort.signal.aborted) setData(p.data);
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(e.message || "Profil gagal dimuat.");
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [code, end, version]);
  const current = data?.points.at(-1),
    rows = [...(data?.points ?? [])].reverse();
  const records = [
    ["Current Rank", data?.currentRank],
    ["Previous Rank", data?.previousRank],
    ["Highest Rank", data?.highestRank],
    ["Lowest Rank", data?.lowestRank],
    ["Average Rank", data?.averageRank],
  ] as const;
  return (
    <div className="pdak-upload">
      <section className="pdak-panel">
        <header className="pdak-upload__heading">
          <div>
            <h1>{data?.name ?? "Profil Wilayah IKD"}</h1>
            <p>
              {code} • {data?.level === "district" ? "Kecamatan" : "Kelurahan"}{" "}
              • Sampai {current?.date ?? end ?? "snapshot terbaru"}
            </p>
          </div>
          <div className="pdak-toolbar">
            <Link className="pdak-upload__refresh" href="/pdak/ikd/ranking">
              <ArrowLeft size={15} /> Klasemen IKD
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
        {loading ? (
          <p role="status" className="pdak-upload__empty">
            Memuat riwayat wilayah…
          </p>
        ) : error ? (
          <p role="alert" className="pdak-upload__alert">
            {error}
          </p>
        ) : !data?.points.length ? (
          <p className="pdak-upload__empty">
            Belum ada snapshot IKD untuk profil ini.
          </p>
        ) : (
          <>
            <div className="ikd-highlights">
              {records.map(([name, value]) => (
                <article className="ikd-award" key={name}>
                  <span>{name}</span>
                  <strong>
                    {value === null || value === undefined
                      ? "N/A"
                      : `#${fmt(value, name === "Average Rank" ? 2 : 0)}`}
                  </strong>
                  <p>
                    {name === "Current Rank"
                      ? current?.date
                      : name === "Previous Rank"
                        ? data.previousDate
                        : ""}
                  </p>
                </article>
              ))}
              <article className="ikd-award">
                <span>Biggest Climb / Fall</span>
                <strong>
                  ↑{" "}
                  {data.biggestClimb === null ? "N/A" : fmt(data.biggestClimb)}{" "}
                  / ↓{" "}
                  {data.biggestFall === null ? "N/A" : fmt(data.biggestFall)}
                </strong>
              </article>
              <article className="ikd-award">
                <span>Aktivasi • Capaian terakhir</span>
                <strong>
                  {fmt(current?.ikd)} • {fmt(current?.coverage, 2)}%
                </strong>
              </article>
            </div>
            <div className="ikd-charts">
              <HistoryChart
                title="Ranking Timeline • #1 di atas"
                ranking
                points={data.points.map((p) => ({
                  date: p.date,
                  value: p.rank,
                }))}
              />
              <HistoryChart
                title="Riwayat Persentase IKD"
                points={data.points.map((p) => ({
                  date: p.date,
                  value: p.coverage,
                }))}
              />
            </div>
            <p className="pdak-upload__hint">
              {data.methodology} {data.validSnapshots} snapshot lengkap dari{" "}
              {data.points.length} tanggal.
            </p>
            <div className="pdak-upload__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal WIB</th>
                    <th>Rank</th>
                    <th>Pergerakan</th>
                    <th>IKD</th>
                    <th>Rekam Dinamis</th>
                    <th>Capaian</th>
                    <th>Kualitas</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(page * 20, page * 20 + 20).map((p) => {
                    const previous = data.points
                      .filter(
                        (x) => x.complete && x.rank !== null && x.date < p.date,
                      )
                      .at(-1);
                    return (
                      <tr key={p.date}>
                        <td>{p.date}</td>
                        <td>{p.rank === null ? "N/A" : `#${p.rank}`}</td>
                        <td>
                          {movement(
                            p.rank !== null &&
                              previous?.rank !== null &&
                              previous?.rank !== undefined
                              ? previous.rank - p.rank
                              : null,
                          )}
                          {p.rank !== null && previous && (
                            <small className="ikd-region-code">
                              vs {previous.date}
                            </small>
                          )}
                        </td>
                        <td>{fmt(p.ikd)}</td>
                        <td>{fmt(p.rekam)}</td>
                        <td>{fmt(p.coverage, 2)}%</td>
                        <td>{p.complete ? "Lengkap" : "Tidak lengkap"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pdak-upload__actions">
              <span>Seluruh histori • {data.points.length} snapshot</span>
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
          </>
        )}
      </section>
    </div>
  );
}
