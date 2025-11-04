﻿"use client";

import { RefreshCcw } from "lucide-react";
import { useMasterAbsensi, TMasterAbsensiRow } from "@/hooks/master/useMasterAbsensi";

const fallbackAvatar = "/assets/plugins/images/calming-cat.gif";

function getAvatarUrl(nik: string | null | undefined) {
  if (!nik) return fallbackAvatar;
  return `/assets/upload/pp/${nik}.jpg`;
}

function formatTime(value: string | null | undefined) {
  if (!value) return "â€”";
  const trimmed = value.trim();
  return trimmed.length === 0 ? "â€”" : trimmed;
}

function AttendanceCard({ row }: { row: TMasterAbsensiRow }) {
  return (
    <article className="master-card attendance-card">
      <div className="master-card__hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getAvatarUrl(row.nik)}
          alt={row.nama_lgkp || row.user_id || "Petugas"}
          loading="lazy"
          className="master-card__avatar"
          onError={(event) => {
            const target = event.currentTarget as HTMLImageElement;
            target.onerror = null;
            target.src = fallbackAvatar;
          }}
        />
        <h2 className="master-card__name">
          {(row.nama_lgkp || row.user_id || "-").toUpperCase()}
        </h2>
        <p className="master-card__office">{row.nama_kantor || "-"}</p>
      </div>

      <div className="master-card__body">
        <div className="master-card__stat">
          <span className="master-card__stat-label">Clock In</span>
          <span className="master-card__stat-value">{formatTime(row.jam_masuk)}</span>
        </div>
        <div className="master-card__stat">
          <span className="master-card__stat-label">Clock Out</span>
          <span className="master-card__stat-value">{formatTime(row.jam_keluar)}</span>
        </div>
      </div>

      <footer className="master-card__footer">
        <span className="master-card__nik-label">NIK</span>
        <span className="master-card__nik-value">{row.nik || "-"}</span>
        <span className="master-card__user">{row.user_id || "-"}</span>
      </footer>
    </article>
  );
}

function AttendanceSkeletonCard() {
  return (
    <article className="master-card master-card--skeleton attendance-card animate-pulse" aria-hidden="true">
      <div className="master-card__hero">
        <div className="master-card__avatar master-card__avatar--skeleton skeleton-circle" />
        <div className="master-card__name skeleton-line" style={{ width: "70%" }} />
        <div className="master-card__office skeleton-line" style={{ width: "45%" }} />
      </div>
      <div className="master-card__body">
        <div className="master-card__stat skeleton-block" />
        <div className="master-card__stat skeleton-block" />
      </div>
      <div className="master-card__footer">
        <div className="master-card__nik-label skeleton-line" style={{ width: "40%" }} />
        <div className="master-card__nik-value skeleton-line" style={{ width: "60%" }} />
        <div className="master-card__user skeleton-line" style={{ width: "50%" }} />
      </div>
    </article>
  );
}

export default function MasterAbsensiPage() {
  const { loading, error, rows, reload } = useMasterAbsensi();
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
                Master Absensi
              </h1>
            </div>
            <div className="md:ml-auto flex items-center">
              <button
                type="button"
                onClick={reload}
                className="attendance-refresh inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition-colors"
                aria-label="Muat ulang data absensi"
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
            <div className="attendance-grid">
              {Array.from({ length: 6 }).map((_, idx) => (
                <AttendanceSkeletonCard key={idx} />
              ))}
            </div>
          ) : rows.length > 0 ? (
            <div className="attendance-grid">
              {rows.map((row) => (
                <AttendanceCard key={`${row.user_id}-${row.nik}`} row={row} />
              ))}
            </div>
          ) : (
            <div className="attendance-empty-state">
              <p>Tidak ada data absensi yang dapat ditampilkan saat ini.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}


