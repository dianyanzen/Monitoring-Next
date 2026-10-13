"use client";
import { safeRichText } from "@/lib/safeHtml";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Printer } from "lucide-react";
import { useSession } from "@/contexts/session";

type Row = {
  no: number;
  userId: string;
  tanggal: string;
  description: string;
  jumlah: string;
};

const todayMonthYear = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

export default function GetDailyPrintPage() {
  const { user } = useSession();
  const params = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const period = useMemo(() => params.get("period") || todayMonthYear(), [params]);

  useEffect(() => {
    const fetchRows = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/report/getdaily", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ userId: user?.S_USER_ID, tanggal: period }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat data");
        const items: Row[] = Array.isArray(json.data) ? json.data : Array.isArray(json) ? (json as Row[]) : [];
        setRows(items);
      } catch (e: any) {
        setError(e?.message || "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    };
    void fetchRows();
  }, [period, user?.S_USER_ID]);

  return (
    <div className="min-h-screen bg-white text-black">
      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white;
          }
        }
        .table {
          border-collapse: collapse;
          width: 100%;
        }
        .table th,
        .table td {
          border: 1px solid #dfe3e8;
          padding: 8px;
          vertical-align: top;
        }
        .table th {
          background: #f3f4f6;
          text-align: center;
        }
        .text-wrap {
          white-space: normal;
        }
      `}</style>

      <div className="no-print flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
        <div>
          <h1 className="text-lg font-semibold">Preview Rekap Daily (PDF)</h1>
          <p className="text-sm text-slate-200/80">Periode: {period}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-white" />}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <table className="text-sm">
          <tbody>
            <tr>
              <td className="pr-2 font-semibold">Nama</td>
              <td className="pr-2">:</td>
              <td>{user?.S_NAMA_LGKP || "-"}</td>
            </tr>
            <tr>
              <td className="pr-2 font-semibold">Nik</td>
              <td className="pr-2">:</td>
              <td>{user?.S_NIK || "-"}</td>
            </tr>
            <tr>
              <td className="pr-2 font-semibold">Perihal</td>
              <td className="pr-2">:</td>
              <td>Laporan Pelaksanaan Tugas</td>
            </tr>
            <tr>
              <td className="pr-2 font-semibold">Bulan</td>
              <td className="pr-2">:</td>
              <td>{period}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6 overflow-hidden rounded border border-gray-200">
          {error ? (
            <div className="p-4 text-sm text-red-600">{error}</div>
          ) : loading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-slate-700">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat data...
            </div>
          ) : (
            <table className="table text-[13px]">
              <thead>
                <tr>
                  <th style={{ width: "5%" }}>No</th>
                  <th style={{ width: "15%" }}>Tanggal</th>
                  <th style={{ width: "40%" }}>Aktivitas</th>
                  <th style={{ width: "20%" }}>Jumlah Aktivitas</th>
                  <th style={{ width: "20%" }}>Paraf</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "12px" }}>
                      Tidak ada data untuk periode ini.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={`${row.tanggal}-${row.no}`}>
                      <td style={{ textAlign: "center" }}>{row.no}</td>
                      <td style={{ textAlign: "center" }}>{row.tanggal}</td>
                      <td className="text-wrap" dangerouslySetInnerHTML={{ __html: safeRichText(row.description || "-") }} />
                      <td className="text-wrap" dangerouslySetInnerHTML={{ __html: safeRichText(row.jumlah || "-") }} />
                      <td></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

