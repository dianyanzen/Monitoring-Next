"use client";
import { useEffect, useState } from "react";
import { formatTime } from "./UploadCard";
type HistoryRow = {
  id: string;
  datasetType: string;
  snapshotDate: string;
  status: string;
  rows: number;
  uploadedBy: string;
  sourceFile: string;
  uploadedAt: string;
  message: string | null;
};
export default function UploadHistory({ version }: { version: number }) {
  const [offset, setOffset] = useState(0),
    [items, setItems] = useState<HistoryRow[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetch(`/api/pdak/upload/history?limit=20&offset=${offset}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        const p = await r.json();
        if (!r.ok || !p.success) throw new Error(p.message);
        if (active) {
          setItems(p.data.items);
          setHasMore(p.data.hasMore);
        }
      })
      .catch((e) => {
        if (active) setError(e.message || "Riwayat gagal dimuat.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [offset, version]);
  return (
    <section className="pdak-upload__history">
      <h2>Riwayat Upload</h2>
      {loading ? (
        <p role="status">Memuat riwayat…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !items.length ? (
        <p>Belum ada riwayat.</p>
      ) : (
        <div className="pdak-upload__table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  "Tanggal WIB",
                  "Kategori",
                  "Status",
                  "Baris",
                  "User",
                  "File",
                  "Waktu WIB",
                  "Pesan",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td>{r.snapshotDate}</td>
                  <td>{r.datasetType || "Tidak dikenal"}</td>
                  <td>{r.status}</td>
                  <td>{r.rows}</td>
                  <td>{r.uploadedBy}</td>
                  <td>{r.sourceFile}</td>
                  <td>{formatTime(r.uploadedAt)}</td>
                  <td>{r.message || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pdak-upload__actions">
        <button
          className="pdak-upload__refresh"
          disabled={!offset || loading}
          onClick={() => setOffset((o) => Math.max(0, o - 20))}
        >
          Sebelumnya
        </button>
        <span>Halaman {offset / 20 + 1}</span>
        <button
          className="pdak-upload__refresh"
          disabled={!hasMore || loading}
          onClick={() => setOffset((o) => o + 20)}
        >
          Berikutnya
        </button>
      </div>
    </section>
  );
}
