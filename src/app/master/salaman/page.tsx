"use client";

import Image from "next/image";
import { RefreshCcw } from "lucide-react";
import { useSalaman, TSalamanRow } from "@/hooks/dashboard/useSalaman";

type IconMeta = {
  src: string;
  alt: string;
};

const iconMap: Record<string, IconMeta> = {
  "AKTA KELAHIRAN": {
    src: "/assets/plugins/images/Disduk/akta_kelahiran.png",
    alt: "Ikon Akta Kelahiran",
  },
  "AKTA KEMATIAN": {
    src: "/assets/plugins/images/Disduk/akta_kematian.png",
    alt: "Ikon Akta Kematian",
  },
  "KARTU IDENTITAS ANAK": {
    src: "/assets/plugins/images/Disduk/kia.png",
    alt: "Ikon Kartu Identitas Anak",
  },
  "PINDAH KELUAR": {
    src: "/assets/plugins/images/Disduk/pindah.png",
    alt: "Ikon Pindah Keluar",
  },
  "PINDAH DATANG": {
    src: "/assets/plugins/images/Disduk/datang.png",
    alt: "Ikon Pindah Datang",
  },
  "CETAK KTP-EL": {
    src: "/assets/plugins/images/Disduk/ktp.png",
    alt: "Ikon Cetak KTP-EL",
  },
  "PERBAIKAN DATA": {
    src: "/assets/plugins/images/Disduk/perbaikan.png",
    alt: "Ikon Perbaikan Data",
  },
  "INPUT BIODATA": {
    src: "/assets/plugins/images/Disduk/input.png",
    alt: "Ikon Input Biodata",
  },
  "KARTU KELUARGA": {
    src: "/assets/plugins/images/Disduk/kk.png",
    alt: "Ikon Kartu Keluarga",
  },
};

const fallbackIcon: IconMeta = {
  src: "/assets/plugins/images/pemkot.png",
  alt: "Ikon Pelayanan Salaman",
};

function getIconMeta(name: string | undefined | null): IconMeta {
  if (!name) return fallbackIcon;
  const key = name.trim().toUpperCase();
  return iconMap[key] ?? fallbackIcon;
}

function formatNumber(value: number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString("id-ID") : "0";
}

function SalamanStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="salaman-card__stat">
      <span className="salaman-card__stat-label">{label}</span>
      <span className="salaman-card__stat-value">{formatNumber(value)}</span>
    </div>
  );
}

function SalamanCard({ row }: { row: TSalamanRow }) {
  const icon = getIconMeta(row.name);

  return (
    <article className="salaman-card">
      <header className="salaman-card__hero">
        <div className="salaman-card__icon-wrapper">
          <div className="salaman-card__icon-ring">
            <Image
              src={icon.src}
              alt={icon.alt}
              width={72}
              height={72}
              className="salaman-card__icon"
            />
          </div>
        </div>
        <h2 className="salaman-card__name">{row.name}</h2>
        <p className="salaman-card__subtitle">Pelayanan Online Salaman</p>
      </header>

      <div className="salaman-card__body">
        <section className="salaman-card__section">
          <h3 className="salaman-card__section-title">Hari Ini</h3>
          <div className="salaman-card__stat-grid">
            <SalamanStat label="Pengajuan Baru" value={row.today.baru} />
            <SalamanStat label="Upload Ulang" value={row.today.upload} />
            <SalamanStat
              label="Berkas Tidak Lengkap"
              value={row.today.tidakLengkap}
            />
          </div>
        </section>

        <section className="salaman-card__section">
          <h3 className="salaman-card__section-title">Keseluruhan {new Date().getFullYear()}</h3>
          <div className="salaman-card__stat-grid">
            <SalamanStat label="Pengajuan Baru" value={row.total.baru} />
            <SalamanStat label="Upload Ulang" value={row.total.upload} />
            <SalamanStat
              label="Berkas Tidak Lengkap"
              value={row.total.tidakLengkap}
            />
          </div>
        </section>
      </div>

      <footer className="salaman-card__footer">
        <div className="salaman-card__footer-stat">
          <span className="salaman-card__footer-label">Pengajuan Terverifikasi</span>
          <span className="salaman-card__footer-value">
            {formatNumber(row.verif)}
          </span>
        </div>
        <div className="salaman-card__footer-divider" />
        <div className="salaman-card__footer-stat">
          <span className="salaman-card__footer-label">Pengajuan Terpublish</span>
          <span className="salaman-card__footer-value">
            {formatNumber(row.publish)}
          </span>
        </div>
      </footer>
    </article>
  );
}

function SalamanSkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="salaman-card salaman-card--skeleton animate-pulse"
      aria-hidden="true"
    >
      <div className="salaman-card__hero">
        <div className="salaman-card__icon-wrapper">
          <div className="salaman-card__icon-ring salaman-card__icon-ring--skeleton">
            <div className="salaman-card__icon-pulse skeleton-circle" />
          </div>
        </div>
        <div className="salaman-card__name skeleton-line" />
        <div className="salaman-card__subtitle skeleton-line" />
      </div>
      <div className="salaman-card__body">
        {[0, 1].map((group) => (
          <div key={`${index}-${group}`} className="salaman-card__section">
            <div className="salaman-card__section-title skeleton-line" />
            <div className="salaman-card__stat-grid">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="salaman-card__stat skeleton-block" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="salaman-card__footer">
        <div className="salaman-card__footer-stat skeleton-block" />
        <div className="salaman-card__footer-divider" />
        <div className="salaman-card__footer-stat skeleton-block" />
      </div>
    </div>
  );
}

export default function SalamanPage() {
  const { loading, error, rows, reload } = useSalaman();
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
                Master Layanan Online
              </h1>
            </div>
            <div className="md:ml-auto flex items-center">
              <button
                type="button"
                onClick={reload}
                className="salaman-refresh inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition-colors"
                aria-label="Muat ulang data salaman"
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
            <div className="salaman-grid">
              {Array.from({ length: 6 }).map((_, idx) => (
                <SalamanSkeletonCard key={idx} index={idx} />
              ))}
            </div>
          ) : rows.length > 0 ? (
            <div className="salaman-grid">
              {rows.map((row) => (
                <SalamanCard key={row.name} row={row} />
              ))}
            </div>
          ) : (
            <div className="salaman-empty-state">
              <p>Tidak ada data Salaman yang dapat ditampilkan saat ini.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
