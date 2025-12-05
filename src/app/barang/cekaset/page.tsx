"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, RefreshCcw } from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import { DataShell } from "@/components/ui/LoadingOverlay";

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => (
    <div className="px-3 py-4 text-sm text-cyan-100/80">
      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
      Menyiapkan tabel...
    </div>
  ),
});

type Row = {
  BARANG_ID: number;
  JENIS_BARANG: string;
  SATUAN: string;
  HARGA: number;
  JML_MASUK: string;
  JML_KELUAR: string;
  SALDO: string;
  HARGA_ASET: number;
};

type ApiResp<T> = { success?: boolean; message?: string; data?: T };

const fmtIdr = (v?: number) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(Number(v || 0));

export default function BarangCekAsetPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(
    () => [
      { data: null, title: "No", render: (_: any, __: any, ___: any, meta: any) => meta.row + 1 },
      { data: "JENIS_BARANG", title: "Jenis Aset" },
      { data: "SATUAN", title: "Satuan", width: "120px" },
      { data: "JML_MASUK", title: "Jumlah Masuk" },
      { data: "JML_KELUAR", title: "Jumlah Keluar" },
      { data: "SALDO", title: "Saldo" },
      {
        data: "HARGA_ASET",
        title: "Nilai Aset",
        render: (d: any) => `Rp ${fmtIdr(Number(d || 0))}`,
        className: "dt-body-right",
      },
    ],
    []
  );

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/barang/cekaset");
      const json = (await res.json().catch(() => ({}))) as ApiResp<Row[]>;
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat data");
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRows();
  }, []);

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-14 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[-25%] h-[820px] w-[820px] rounded-full bg-cyan-500/12 blur-[200px]" />
        <div className="absolute right-[8%] bottom-[-20%] h-[780px] w-[780px] rounded-full bg-fuchsia-600/10 blur-[180px]" />
      </div>

      <SettingPageHeader
        lead="Aset"
        title="Cek Aset"
        description="Ringkasan stok aset (masuk, keluar, saldo, dan nilai) untuk pengecekan cepat."
      />

      <section className="rounded-3xl border border-cyan-900/60 bg-[#05070f]/70 p-5 shadow-[0_0_32px_#00ffff22] backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchRows()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-60"
          >
            <RefreshCcw className="h-4 w-4" />
            Reload
          </button>
        </div>

        {error ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-50">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        ) : null}

        <DataShell loading={loading} hasData={rows.length > 0}>
          <JQDataTable
            id="dt-cek-aset"
            data={rows as any[]}
            columns={columns as any[]}
            minWidth={900}
            pageLength={25}
            options={{
              columnDefs: [{ className: "dt-left", targets: "_all" }],
              order: [[1, "asc"]],
            }}
          />
        </DataShell>
      </section>
    </div>
  );
}
