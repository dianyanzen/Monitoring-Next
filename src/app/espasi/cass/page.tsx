"use client";

import { useEffect, useMemo, useState } from "react";

type CassRow = Record<string, unknown>;

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

function toText(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v);
}

export default function CassPage() {
  const [rows, setRows] = useState<CassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ limit: "500" });
      const res = await fetch(`/api/espasi/cass?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<CassRow[]> | null;

      if (!json?.success) {
        setRows([]);
        setError(json?.message || "Gagal memuat data cass");
        return;
      }

      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (e: any) {
      setRows([]);
      setError(e?.message || "Gagal memuat data cass");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const columns = useMemo(() => {
    const first = rows[0];
    if (!first) return [] as string[];
    return Object.keys(first);
  }, [rows]);

  const filteredRows = useMemo(() => {
    const needle = q.trim().toUpperCase();
    if (!needle) return rows;

    return rows.filter((row) =>
      columns
        .map((col) => toText(row[col]).toUpperCase())
        .join(" ")
        .includes(needle)
    );
  }, [rows, columns, q]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f2f7ff_0%,#ffffff_100%)] px-4 py-5 md:px-6">
      <div className="mx-auto max-w-[1800px] space-y-4">
        <header className="rounded-2xl border border-[#dbe7ff] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-[#0f2f63]">Capil Cass</h1>
              <p className="text-sm text-[#40639e]">Data arsip cass dari SMSDISDUK.CASS_LAHIR.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="rounded-xl border border-[#2f80ed] bg-[#2f80ed] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Memuat..." : "Refresh"}
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-[#dbe7ff] bg-white p-4 shadow-sm">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter cepat..."
            className="h-10 min-w-[280px] rounded-lg border border-[#c9d8f5] px-3 text-sm outline-none focus:border-[#2f80ed]"
          />

          <div className="mt-4 overflow-x-auto rounded-xl border border-[#e3ecff]">
            <table className="min-w-[1000px] w-full text-sm">
              <thead className="bg-[#edf4ff] text-[#123c76]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">#</th>
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-2 text-left font-semibold">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={Math.max(1, columns.length + 1)} className="px-3 py-8 text-center text-[#5d7fb8]">Memuat data...</td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={Math.max(1, columns.length + 1)} className="px-3 py-8 text-center text-red-600">{error}</td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(1, columns.length + 1)} className="px-3 py-8 text-center text-[#5d7fb8]">Data tidak ditemukan</td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr key={idx} className="border-t border-[#eef3ff]">
                      <td className="px-3 py-2">{idx + 1}</td>
                      {columns.map((col) => (
                        <td key={col} className="px-3 py-2">{toText(row[col]) || "-"}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-sm text-[#40639e]">Total: {filteredRows.length.toLocaleString("id-ID")} baris</div>
        </section>
      </div>
    </div>
  );
}
