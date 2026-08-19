"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "aktif" | "log" | "masuk" | "keluar" | "telepon";

type Row = {
  NIK?: string;
  NAMA?: string;
  KODE_PELAYANAN?: string;
  URUTAN?: string;
  STATUS_PELAYANAN?: string;
  TGL_PELAYANAN?: string;
  HARI?: string;
  TELEPON?: string;
  LOKASI?: string;
  ISI_PESAN?: string;
  TANGGAL_SMS?: string;
  SERVER?: string;
  SOURCE_TABLE?: string;
  JUMLAH_SMS?: string | number;
  TANGGAL_BLOKIR?: string;
};

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

type AntrianApiData = {
  mode?: string;
  rows?: Row[];
};

type Props = {
  mode: Mode;
  title: string;
  subtitle: string;
};

function toText(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function asSearchBucket(row: Row) {
  return [
    row.NIK,
    row.NAMA,
    row.KODE_PELAYANAN,
    row.URUTAN,
    row.STATUS_PELAYANAN,
    row.TGL_PELAYANAN,
    row.HARI,
    row.TELEPON,
    row.LOKASI,
    row.ISI_PESAN,
    row.TANGGAL_SMS,
    row.SERVER,
    row.SOURCE_TABLE,
    row.JUMLAH_SMS,
    row.TANGGAL_BLOKIR,
  ]
    .map((v) => toText(v).toUpperCase())
    .join(" ");
}

export default function EspasiAntrianModeTable({ mode, title, subtitle }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ mode, limit: "500" });
      const res = await fetch(`/api/espasi/antrian?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<AntrianApiData> | null;

      if (!json?.success) {
        setRows([]);
        setError(json?.message || "Gagal memuat data antrian");
        return;
      }

      setRows(Array.isArray(json.data?.rows) ? json.data?.rows : []);
    } catch (e: any) {
      setRows([]);
      setError(e?.message || "Gagal memuat data antrian");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [mode]);

  const filteredRows = useMemo(() => {
    const needle = q.trim().toUpperCase();
    if (!needle) return rows;
    return rows.filter((row) => asSearchBucket(row).includes(needle));
  }, [rows, q]);

  const isAktif = mode === "aktif";
  const isTelepon = mode === "telepon";
  const isLog = mode === "log";

  const colSpan = isTelepon ? 4 : isAktif ? 10 : isLog ? 6 : 5;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f2f7ff_0%,#ffffff_100%)] px-4 py-5 md:px-6">
      <div className="mx-auto max-w-[1800px] space-y-4">
        <header className="rounded-2xl border border-[#dbe7ff] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-[#0f2f63]">{title}</h1>
              <p className="text-sm text-[#40639e]">{subtitle}</p>
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
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter cepat..."
              className="h-10 min-w-[280px] rounded-lg border border-[#c9d8f5] px-3 text-sm outline-none focus:border-[#2f80ed]"
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-[#e3ecff]">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-[#edf4ff] text-[#123c76]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">#</th>
                  {isTelepon ? (
                    <>
                      <th className="px-3 py-2 text-left font-semibold">TELEPON</th>
                      <th className="px-3 py-2 text-left font-semibold">JUMLAH SMS</th>
                      <th className="px-3 py-2 text-left font-semibold">TANGGAL BLOKIR</th>
                    </>
                  ) : isAktif ? (
                    <>
                      <th className="px-3 py-2 text-left font-semibold">NIK</th>
                      <th className="px-3 py-2 text-left font-semibold">NAMA</th>
                      <th className="px-3 py-2 text-left font-semibold">KODE PELAYANAN</th>
                      <th className="px-3 py-2 text-left font-semibold">URUTAN</th>
                      <th className="px-3 py-2 text-left font-semibold">STATUS</th>
                      <th className="px-3 py-2 text-left font-semibold">TGL PELAYANAN</th>
                      <th className="px-3 py-2 text-left font-semibold">HARI</th>
                      <th className="px-3 py-2 text-left font-semibold">TELEPON</th>
                      <th className="px-3 py-2 text-left font-semibold">LOKASI</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2 text-left font-semibold">TELEPON</th>
                      <th className="px-3 py-2 text-left font-semibold">ISI PESAN</th>
                      <th className="px-3 py-2 text-left font-semibold">TANGGAL SMS</th>
                      <th className="px-3 py-2 text-left font-semibold">SERVER</th>
                      {isLog ? <th className="px-3 py-2 text-left font-semibold">SUMBER</th> : null}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={colSpan} className="px-3 py-8 text-center text-[#5d7fb8]">Memuat data...</td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={colSpan} className="px-3 py-8 text-center text-red-600">{error}</td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="px-3 py-8 text-center text-[#5d7fb8]">Data tidak ditemukan</td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr key={`${toText(row.TELEPON)}-${toText(row.TANGGAL_SMS)}-${idx}`} className="border-t border-[#eef3ff]">
                      <td className="px-3 py-2">{idx + 1}</td>
                      {isTelepon ? (
                        <>
                          <td className="px-3 py-2">{toText(row.TELEPON) || "-"}</td>
                          <td className="px-3 py-2">{toText(row.JUMLAH_SMS) || "-"}</td>
                          <td className="px-3 py-2">{toText(row.TANGGAL_BLOKIR) || "-"}</td>
                        </>
                      ) : isAktif ? (
                        <>
                          <td className="px-3 py-2">{toText(row.NIK) || "-"}</td>
                          <td className="px-3 py-2">{toText(row.NAMA) || "-"}</td>
                          <td className="px-3 py-2">{toText(row.KODE_PELAYANAN) || "-"}</td>
                          <td className="px-3 py-2">{toText(row.URUTAN) || "-"}</td>
                          <td className="px-3 py-2">{toText(row.STATUS_PELAYANAN) || "-"}</td>
                          <td className="px-3 py-2">{toText(row.TGL_PELAYANAN) || "-"}</td>
                          <td className="px-3 py-2">{toText(row.HARI) || "-"}</td>
                          <td className="px-3 py-2">{toText(row.TELEPON) || "-"}</td>
                          <td className="px-3 py-2">{toText(row.LOKASI) || "-"}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2">{toText(row.TELEPON) || "-"}</td>
                          <td className="px-3 py-2">{toText(row.ISI_PESAN) || "-"}</td>
                          <td className="px-3 py-2">{toText(row.TANGGAL_SMS) || "-"}</td>
                          <td className="px-3 py-2">{toText(row.SERVER) || "-"}</td>
                          {isLog ? <td className="px-3 py-2">{toText(row.SOURCE_TABLE) || "-"}</td> : null}
                        </>
                      )}
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
