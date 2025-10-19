// FILE: src/app/master/list/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, LayoutGrid, List as ListIcon, RefreshCcw } from "lucide-react";

type MasterRow = {
  USER_ID: string;
  NAMA_LGKP: string;
  NAMA_KANTOR: string;
  NIK: string;
  PENGAJUAN_S: number;
  PINDAHAN_S: number;
  PRR_S: number;
};

const fallbackAvatar = "/assets/plugins/images/calming-cat.gif";

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => <div className="px-2 py-6 text-sm text-cyan-200/80">Menyiapkan DataTable...</div>,
});

function getAvatarUrl(nik: string) {
  if (!nik) return fallbackAvatar;
  return `/assets/upload/pp/${nik}.jpg`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(value: number | string | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString("id-ID") : "0";
}

function parseNumeric(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/\./g, "").replace(/,/g, ".");
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  return 0;
}

export default function MasterListPage() {
  const [tab, setTab] = useState<"cards" | "table">("cards");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<MasterRow[]>([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/master/list", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data: MasterRow[] = Array.isArray(json?.data) ? json.data : json;
      setRows(data ?? []);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat master list");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="relative px-8 pb-10 pt-6 md:pt-8 space-y-8 mt-5">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-15%] left-[18%] w-[1100px] h-[1100px] bg-cyan-500/12 blur-[220px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[18%] w-[1000px] h-[1000px] bg-fuchsia-600/12 blur-[190px] rounded-full" />
      </div>

      <section className="rounded-2xl border border-cyan-800/40 bg-[#0b0b1a]/80 backdrop-blur-xl shadow-[0_0_34px_#00ffff22] overflow-hidden">
        {/* Header */}
        <header className="px-5 py-4 border-b border-cyan-900/50">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              <h1 className="text-base md:text-lg font-semibold tracking-wide text-cyan-200">
                Master List
              </h1>
            </div>
            <div className="flex-1 md:flex-none md:ml-auto flex items-center gap-2">
              <button
                onClick={() => setTab("cards")}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
                  tab === "cards"
                    ? "bg-cyan-600/30 border border-cyan-400/50 shadow-[0_0_16px_#00ffff66]"
                    : "bg-white/5 border border-white/10 hover:bg-white/10"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Master View
              </button>
              <button
                onClick={() => setTab("table")}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
                  tab === "table"
                    ? "bg-cyan-600/30 border border-cyan-400/50 shadow-[0_0_16px_#00ffff66]"
                    : "bg-white/5 border border-white/10 hover:bg-white/10"
                }`}
              >
                <ListIcon className="w-4 h-4" />
                Excel View
              </button>
              <button
                onClick={fetchData}
                className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition-colors"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-5">
          {error ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : tab === "cards" ? (
            loading && rows.length === 0 ? (
              <MasterCardSkeletonGrid />
            ) : rows.length > 0 ? (
              <CardGrid rows={rows} />
            ) : (
              <MasterCardEmptyState />
            )
          ) : loading && rows.length === 0 ? (
            <div className="flex items-center gap-3 text-sm text-cyan-100/80">
              <Loader2 className="w-4 h-4 animate-spin" />
              Memuat master list...
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
              Belum ada data master list.
            </div>
          ) : (
            <ExcelDataTable rows={rows} />
          )}
        </div>
      </section>
    </div>
  );
}

function CardGrid({ rows }: { rows: MasterRow[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <article key={`${row.USER_ID}-${row.NIK}`} className="master-card">
          <div className="master-card__hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getAvatarUrl(row.NIK)}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = fallbackAvatar;
              }}
              alt={row.NAMA_LGKP}
              className="master-card__avatar"
            />
            <h2 className="master-card__name">{(row.NAMA_LGKP || row.USER_ID || "—").toUpperCase()}</h2>
            <p className="master-card__office">{row.NAMA_KANTOR || "—"}</p>
          </div>
          <div className="master-card__body">
            <SummaryBlock label="Sisa Pengajuan" value={row.PENGAJUAN_S} />
            <SummaryBlock label="Sisa Perpindahan" value={row.PINDAHAN_S} />
            <SummaryBlock label="Sisa Prr" value={row.PRR_S} />
          </div>
          <footer className="master-card__footer">
            <span className="master-card__nik-label">NIK</span>
            <span className="master-card__nik-value">{row.NIK || "—"}</span>
            <span className="master-card__user">{row.USER_ID}</span>
          </footer>
        </article>
      ))}
    </div>
  );
}

function MasterCardSkeletonGrid() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, idx) => (
        <article key={idx} className="master-card master-card--skeleton animate-pulse" aria-hidden="true">
          <div className="master-card__hero">
            <div className="master-card__avatar master-card__avatar--skeleton skeleton-circle" />
            <div className="master-card__name skeleton-line" style={{ width: "70%" }} />
            <div className="master-card__office skeleton-line" style={{ width: "45%" }} />
          </div>
          <div className="master-card__body">
            {Array.from({ length: 3 }).map((__, statIdx) => (
              <div key={statIdx} className="master-card__stat skeleton-block" />
            ))}
          </div>
          <footer className="master-card__footer">
            <div className="master-card__nik-label skeleton-line" style={{ width: "40%" }} />
            <div className="master-card__nik-value skeleton-line" style={{ width: "60%" }} />
            <div className="master-card__user skeleton-line" style={{ width: "50%" }} />
          </footer>
        </article>
      ))}
    </div>
  );
}

function MasterCardEmptyState() {
  return (
    <div className="master-card-empty">
      <p>Tidak ada data master list yang dapat ditampilkan saat ini.</p>
    </div>
  );
}

function SummaryBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="master-card__stat">
      <span className="master-card__stat-label">{label}</span>
      <span className="master-card__stat-value">
        {Number(value ?? 0).toLocaleString("id-ID")}
      </span>
    </div>
  );
}

function ExcelDataTable({ rows }: { rows: MasterRow[] }) {
  const data = useMemo(
    () =>
      rows.map((row, idx) => ({
        no: idx + 1,
        nama_petugas: row.NAMA_LGKP || "—",
        user_id: row.USER_ID,
        nama_kantor: row.NAMA_KANTOR || "—",
        pengajuan: Number(row.PENGAJUAN_S ?? 0),
        perpindahan: Number(row.PINDAHAN_S ?? 0),
        prr: Number(row.PRR_S ?? 0),
      })),
    [rows]
  );

  return (
    <div className="space-y-3">
      <header className="text-sm text-cyan-100/80 flex flex-col gap-1">
        <h3 className="text-base font-semibold text-cyan-200">Master List Excel</h3>
        <p>Dinas Kependudukan dan Pencatatan Sipil Kota Bandung</p>
      </header>

      <JQDataTable
        id="master-list-table"
        minWidth={900}
        data={data}
        tableClassName="dt-cyberpunk master-dt"
        columns={[
          { data: "no", title: "No", className: "text-center w-[60px]" },
          {
            data: "nama_petugas",
            title: "Nama Petugas",
            className: "text-left",
            orderable: false,
            render: (_: any, type: string, row: any) => {
              const name = escapeHtml(row.nama_petugas || "-");
              const user = escapeHtml(row.user_id || "-");
              if (type === "display") {
                return `
                  <div class="dt-master-nama">
                    <span class="dt-master-nama__title">${name}</span>
                    <span class="dt-master-nama__subtitle">${user}</span>
                  </div>
                `;
              }
              return row.nama_petugas || "";
            },
          },
          {
            data: "nama_kantor",
            title: "Nama Kantor",
            className: "text-left",
            render: (val: string, type: string) =>
              type === "display" ? escapeHtml(val || "-") : val,
          },
          {
            data: "pengajuan",
            title: "Pengajuan",
            className: "text-center font-semibold",
            render: (val: number | string) => formatNumber(val),
          },
          {
            data: "perpindahan",
            title: "Perpindahan",
            className: "text-center font-semibold",
            render: (val: number | string) => formatNumber(val),
          },
          {
            data: "prr",
            title: "PRR",
            className: "text-center font-semibold",
            render: (val: number | string) => formatNumber(val),
          },
        ]}
        options={{
          order: [[0, "asc"]],
          footerCallback: function (
            this: any,
            _row: HTMLElement,
            _data: unknown[],
            _start: number,
            _end: number
          ) {
            const api = this?.api?.();
            if (!api || typeof api.column !== "function") return;
            const sumColumn = (idx: number) => {
              return api
                .column(idx, { search: "applied", order: "applied" })
                .data()
                .toArray()
                .reduce((total: number, value: any) => {
                  const numeric =
                    typeof value === "number"
                      ? value
                      : Number(String(value ?? "").replace(/[^\d,-]/g, "").replace(",", "."));
                  return Number.isFinite(numeric) ? total + numeric : total;
                }, 0);
            };

            const totalPengajuan = sumColumn(3);
            const totalPerpindahan = sumColumn(4);
            const totalPrr = sumColumn(5);

            const footerEl = api.table().footer() as HTMLTableSectionElement | null;
            if (!footerEl) return;

            const cells = footerEl.querySelectorAll("th");
            if (cells.length >= 6) {
              cells[3].textContent = totalPengajuan.toLocaleString("id-ID");
              cells[4].textContent = totalPerpindahan.toLocaleString("id-ID");
              cells[5].textContent = totalPrr.toLocaleString("id-ID");
            }
          },
        }}
      />

      <div className="text-xs text-cyan-100/60">
        Data bersumber dari <span className="font-semibold text-cyan-200">VW_SIAK_LIST</span>.
        Hubungi admin apabila terjadi ketidaksesuaian.
      </div>
    </div>
  );
}


