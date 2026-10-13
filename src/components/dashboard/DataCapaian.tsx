"use client";
import { useCapaian } from "@/hooks/dashboard/useCapaian";
import { RefreshCw } from "lucide-react";
import "@/styles/components/operational-workspace.css";
const fmt = (n: number | null) =>
  n === null ? "N/A" : n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
export default function DataCapaian() {
  const { loading, rows, error, dates, date, setDate, refresh } = useCapaian();
  return (
    <section
      className="monalisa-ops capaian-panel"
      aria-labelledby="capaian-title"
      aria-busy={loading}
    >
      <div className="ops-header">
        <div>
          <h2 id="capaian-title">Dashboard Data Capaian</h2>
          <p>Realisasi Kota Bandung berdasarkan snapshot PDAK.</p>
        </div>
        <div className="ops-actions">
          <label>
            Tanggal snapshot
            <select value={date} onChange={(e) => setDate(e.target.value)}>
              <option value="">Terbaru per kategori</option>
              {dates.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <button
            onClick={refresh}
            disabled={loading}
            aria-label="Perbarui capaian"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>
      {error ? (
        <div className="ops-notice danger" role="alert">
          {error} <button onClick={refresh}>Coba lagi</button>
        </div>
      ) : loading ? (
        <div className="ops-empty" role="status">
          Memuat capaian PDAK…
        </div>
      ) : (
        <div className="capaian-grid">
          {rows.map((r) => (
            <article key={r.key} className="capaian-card">
              <div className="ops-header">
                <h3>{r.title}</h3>
                <span className="ops-badge">
                  {r.date || "Belum ada snapshot"}
                </span>
              </div>
              <div className="capaian-progress">
                <span>Progres terhadap target</span>
                <strong>
                  {fmt(r.progress)}
                  {r.progress !== null ? "%" : ""}
                </strong>
              </div>
              {r.progress !== null ? (
                <progress
                  max={100}
                  value={Math.min(100, r.progress)}
                  aria-label={`Progres target ${r.title}`}
                />
              ) : (
                <div className="capaian-no-progress">
                  Progres belum tersedia
                </div>
              )}
              <dl className="capaian-values">
                <div>
                  <dt>Realisasi</dt>
                  <dd>
                    {fmt(r.realisasi)}{" "}
                    <small>
                      {r.coverage === null
                        ? "Capaian N/A"
                        : `${fmt(r.coverage)}% capaian`}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>
                    {fmt(r.target)}{" "}
                    <small>
                      {r.targetCoverage === null
                        ? "Target persentase N/A"
                        : `${fmt(r.targetCoverage)}% target`}
                    </small>
                  </dd>
                </div>
              </dl>
              <p className="ops-muted">
                Basis penduduk: {fmt(r.denominator)}
                {r.progress !== null && r.progress >= 100
                  ? " · Target tercapai"
                  : ""}
              </p>
            </article>
          ))}
        </div>
      )}
      <details className="ops-method">
        <summary>Sumber dan cara membaca angka</summary>
        <p>
          Capaian persentase mengikuti file PDAK. Progres target = realisasi ÷
          target jumlah × 100%. Target berasal dari pengaturan dashboard;
          progres di atas 100% tetap ditampilkan. Angka kota tidak dijumlahkan
          dengan kecamatan atau kelurahan. Setiap kategori dapat memiliki
          tanggal upload berbeda; data yang belum tersedia ditampilkan N/A.
        </p>
      </details>
    </section>
  );
}
