"use client";

import { useState } from "react";
import { RefreshCcw, CalendarDays, MapPin, Phone, Building2 } from "lucide-react";
import { useMasterContact, TMasterContactRow } from "@/hooks/master/useMasterContact";

const fallbackAvatar = "/assets/plugins/images/calming-cat.gif";

function getAvatarUrl(nik: string | null | undefined) {
  if (!nik) return fallbackAvatar;
  return `/assets/upload/pp/${nik}.jpg`;
}

function formatBirth(tmpt: string | null | undefined, tgl: string | null | undefined) {
  const place = (tmpt ?? "").trim();
  const date = (tgl ?? "").trim();
  if (!place && !date) return "-";
  if (!place) return date || "-";
  if (!date) return place;
  return `${place}, ${date}`;
}

function normalisePhone(value: string) {
  const digits = value.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

function ContactCard({ row }: { row: TMasterContactRow }) {
  const [copied, setCopied] = useState(false);
  const phoneDisplay = (row.telp ?? "").trim();
  const waNumber = normalisePhone(phoneDisplay);
  const waLink = waNumber ? `https://wa.me/${waNumber}` : "";

  function handleCopy() {
    if (!phoneDisplay || !navigator?.clipboard) return;
    navigator.clipboard.writeText(phoneDisplay).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <article className="master-card contact-card">
      <div className="master-card__hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getAvatarUrl(row.nik)}
          alt={row.nama_lgkp || row.nik || "Petugas"}
          loading="lazy"
          className="master-card__avatar"
          onError={(event) => {
            const target = event.currentTarget as HTMLImageElement;
            target.onerror = null;
            target.src = fallbackAvatar;
          }}
        />
        <h2 className="master-card__name">{(row.nama_lgkp || row.nik || "-").toUpperCase()}</h2>
      </div>

      <div className="master-card__body">
        <div className="contact-card__column">
          <div className="contact-card__pill">
            <span className="contact-card__icon">
              <CalendarDays className="w-4 h-4" />
            </span>
            <div>
              <span className="contact-card__pill-label">Tempat &amp; Tanggal Lahir</span>
              <p className="contact-card__pill-value">{formatBirth(row.tmpt_lhr, row.tgl_lhr)}</p>
            </div>
          </div>

          <div className="contact-card__pill">
            <span className="contact-card__icon">
              <Building2 className="w-4 h-4" />
            </span>
            <div>
              <span className="contact-card__pill-label">Lokasi Penempatan</span>
              <p className="contact-card__pill-value">{row.nama_kantor || "-"}</p>
            </div>
          </div>

          <div className="contact-card__pill contact-card__pill--phone">
            <span className="contact-card__icon">
              <Phone className="w-4 h-4" />
            </span>
            <div className="contact-card__pill-phone">
              <div>
                <span className="contact-card__pill-label">Nomor Telepon</span>
                <p className="contact-card__pill-value">{phoneDisplay || "-"}</p>
              </div>
              {phoneDisplay && (
                <div className="contact-card__actions">
                  {waLink && (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="contact-card__action-btn"
                    >
                      WhatsApp
                    </a>
                  )}
                  <button type="button" className="contact-card__action-btn" onClick={handleCopy}>
                    {copied ? "Disalin" : "Salin"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="contact-card__column contact-card__column--address">
          <div className="contact-card__address">
            <span className="contact-card__icon">
              <MapPin className="w-4 h-4" />
            </span>
            <div>
              <span className="contact-card__pill-label">Alamat Rumah</span>
              <p className="contact-card__address-value">{(row.alamat_rumah ?? "-").trim() || "-"}</p>
            </div>
          </div>
        </div>
      </div>

      <footer className="master-card__footer contact-card__footer">
        <span className="master-card__nik-label">NIK</span>
        <span className="master-card__nik-value">{row.nik || "-"}</span>
      </footer>
    </article>
  );
}

function ContactSkeletonCard() {
  return (
    <article className="master-card master-card--skeleton contact-card animate-pulse" aria-hidden="true">
      <div className="master-card__hero">
        <div className="master-card__avatar master-card__avatar--skeleton skeleton-circle" />
        <div className="master-card__name skeleton-line" style={{ width: "65%" }} />
        <div className="master-card__office skeleton-line" style={{ width: "40%" }} />
      </div>
      <div className="master-card__body">
        <div className="contact-card__column">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="contact-card__pill skeleton-block" />
          ))}
        </div>
        <div className="contact-card__column contact-card__column--address">
          <div className="contact-card__address skeleton-block" />
        </div>
      </div>
      <div className="master-card__footer contact-card__footer">
        <div className="master-card__nik-label skeleton-line" style={{ width: "38%" }} />
        <div className="master-card__nik-value skeleton-line" style={{ width: "58%" }} />
        <div className="master-card__user skeleton-line" style={{ width: "48%" }} />
      </div>
    </article>
  );
}

export default function MasterContactPage() {
  const { loading, error, rows, reload } = useMasterContact();
  const showSkeleton = loading && rows.length === 0;

  return (
    <div className="relative px-8 pb-8 pt-6 md:pt-8 space-y-8 mt-5">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-15%] left-[15%] w-[1200px] h/[1200px] bg-cyan-500/12 blur-[220px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[18%] w/[1100px] h/[1100px] bg-fuchsia-600/12 blur-[190px] rounded-full" />
      </div>

      <section className="rounded-2xl border border-cyan-800/40 bg-[#0b0b1a]/80 backdrop-blur-xl shadow-[0_0_34px_#00ffff22] overflow-hidden">
        <header className="px-5 py-4 border-b border-cyan-900/50">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              <h1 className="text-base md:text-lg font-semibold tracking-wide text-cyan-200">
                Master Contact
              </h1>
            </div>
            <div className="md:ml-auto flex items-center">
              <button
                type="button"
                onClick={reload}
                className="contact-refresh inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition-colors"
                aria-label="Muat ulang data kontak"
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
            <div className="contact-grid">
              {Array.from({ length: 6 }).map((_, idx) => (
                <ContactSkeletonCard key={idx} />
              ))}
            </div>
          ) : rows.length > 0 ? (
            <div className="contact-grid">
              {rows.map((row) => (
                <ContactCard key={row.nik || `${row.nama_lgkp}-${row.nama_kantor}`} row={row} />
              ))}
            </div>
          ) : (
            <div className="contact-empty-state">
              <p>Tidak ada data kontak yang dapat ditampilkan saat ini.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
