"use client";

import { RefreshCcw } from "lucide-react";
import { useMasterRequest, TMasterRequestRow } from "@/hooks/master/useMasterRequest";

const fallbackAvatar = "/assets/plugins/images/calming-cat.gif";

function getAvatarUrl(nik: string | null | undefined) {
  if (!nik) return fallbackAvatar;
  return `/assets/upload/pp/${nik}.jpg`;
}

function formatNumber(value: number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString("id-ID") : "0";
}

function RequestStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="request-card__stat">
      <span className="request-card__stat-label">{label}</span>
      <span className="request-card__stat-value">{formatNumber(value)}</span>
    </div>
  );
}

function RequestCard({ row }: { row: TMasterRequestRow }) {
  const avatar = getAvatarUrl(row.nik);

  return (
    <article className="request-card">
      <header className="request-card__hero">
        <div className="request-card__avatar-wrapper">
          <img
            src={avatar}
            alt={row.nama_lgkp || row.user_id || "Petugas"}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = fallbackAvatar;
            }}
          />
        </div>
        <h2 className="request-card__name">{row.nama_lgkp || "Tanpa Nama"}</h2>
        <p className="request-card__office">{row.nama_kantor || "—"}</p>
        <p className="request-card__user">{row.user_id || "—"}</p>
      </header>

      <div className="request-card__body">
        <RequestStat label="Pengajuan Kemarin" value={row.pengajuan_y} />
        <RequestStat label="Pengajuan Hari Ini" value={row.pengajuan_n} />
        <RequestStat label="Pengajuan Bulan Ini" value={row.pengajuan_b} />
      </div>
    </article>
  );
}

function RequestSkeletonCard() {
  return (
    <div className="request-card request-card--skeleton animate-pulse" aria-hidden="true">
      <div className="request-card__hero">
        <div className="request-card__avatar-wrapper skeleton-circle" />
        <div className="request-card__name skeleton-line" />
        <div className="request-card__office skeleton-line" />
        <div className="request-card__user skeleton-line" />
      </div>
      <div className="request-card__body">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="request-card__stat skeleton-block" />
        ))}
      </div>
    </div>
  );
}

export default function PengajuanPage() {
  const { loading, error, rows, reload } = useMasterRequest();
  const showSkeleton = loading && rows.length === 0;

  return (
    <div className="relative px-8 pb-8 pt-6 md:pt-8 space-y-8 mt-5">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-15%] left-[15%] w-[1100px] h-[1100px] bg-cyan-500/15 blur-[220px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[18%] w-[1000px] h-[1000px] bg-fuchsia-600/12 blur-[190px] rounded-full" />
      </div>

      <section className="rounded-2xl border border-cyan-800/40 bg-[#0b0b1a]/80 backdrop-blur-xl shadow-[0_0_34px_#00ffff22] overflow-hidden">
        <header className="px-5 py-4 border-b border-cyan-900/50">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              <h1 className="text-base md:text-lg font-semibold tracking-wide text-cyan-200">
                Master Pengajuan
              </h1>
            </div>
            <div className="md:ml-auto flex items-center">
              <button
                type="button"
                onClick={reload}
                className="request-refresh inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition-colors"
                aria-label="Muat ulang data pengajuan"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </header>

        <div className="p-5 space-y-5">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100 dark:text-red-200">
              {error}
            </div>
          )}

          {showSkeleton ? (
            <div className="request-grid">
              {Array.from({ length: 6 }).map((_, idx) => (
                <RequestSkeletonCard key={idx} />
              ))}
            </div>
          ) : rows.length > 0 ? (
            <div className="request-grid">
              {rows.map((row) => (
                <RequestCard key={`${row.user_id}-${row.nik}`} row={row} />
              ))}
            </div>
          ) : (
            <div className="request-empty-state">
              <p>Tidak ada data pengajuan yang dapat ditampilkan saat ini.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
