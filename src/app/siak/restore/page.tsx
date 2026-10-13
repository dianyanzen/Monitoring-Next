// FILE: src/app/siak/restore/page.tsx
"use client";
import { safeRichText } from "@/lib/safeHtml";

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  startTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/contexts/session";
import FaceCard from "@/components/ui/FaceCard";
import {
  AlertTriangle,
  CheckCircle2,
  History,
  Loader2,
  RefreshCcw,
  Search,
  ShieldOff,
  Users2,
  User,
  Activity,
  MapPin,
} from "lucide-react";

/* =========================================================================
   CUSTOM TABLE — tipis, reusable, theme-aware (tanpa export default)
   ========================================================================= */
type Align = "left" | "center" | "right";

type Column<T> = {
  key: string;
  header?: React.ReactNode;
  width?: number | string;
  align?: Align;
  sticky?: "left" | "right";
  accessor?: ((row: T, rowIndex?: number) => React.ReactNode) | string | null;
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
  className?: string;
};

type CustomTableProps<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  initialPageSize?: number;
  initialSortKey?: string;
  initialSortDir?: "asc" | "desc";
  density?: "compact" | "comfortable" | "spacious";
  empty?: React.ReactNode;
  disableSort?: boolean; // ⬅️ baru
};

function valueForSort<T>(col: Column<T>, row: T) {
  try {
    if (col.sortValue) return col.sortValue(row);
    if (typeof col.accessor === "string") {
      // @ts-ignore — index-by-key untuk fleksibilitas
      return (row as any)[col.accessor] ?? "";
    }
    return "";
  } catch {
    return "";
  }
}

// FILE: src/app/siak/restore/page.tsx
function CustomTable<T>({
  rows,
  columns,
  rowKey,
  // props sorting & pagination diabaikan supaya kompatibel dengan pemanggil lama
  density = "comfortable",
  empty = null,
}: CustomTableProps<T>) {
  const densityPad =
    density === "compact" ? "px-2 py-1.5" : density === "spacious" ? "px-4 py-3" : "px-3 py-2";


  return (
    <div className="custom-table w-full">
      <div className="overflow-x-auto rounded-xl border border-cyan-200/30 bg-[#051021]/95 shadow-[0_24px_40px_rgba(2,8,20,0.55)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/40">
        <table className="min-w-full table-fixed">
          <colgroup>
            {columns.map((c) => (
              <col
                key={c.key}
                style={
                  c.width
                    ? { width: typeof c.width === "number" ? `${c.width}px` : c.width }
                    : undefined
                }
              />
            ))}
          </colgroup>

          {/* HEAD (tanpa sort, tanpa pointer) */}
          <thead className="sticky top-0 z-20 bg-[#08162c]/95 text-cyan-100 backdrop-blur-md dark:bg-slate-900/70 dark:text-slate-300">
            <tr>
              {columns.map((col) => {
                const stickyCls =
                  col.sticky === "left"
                    ? "sticky left-0 z-30"
                    : col.sticky === "right"
                    ? "sticky right-0 z-30"
                    : "";
                return (
                  <th
                    key={col.key}
                    style={{
                      width: col.width
                        ? typeof col.width === "number"
                          ? `${col.width}px`
                          : col.width
                        : undefined,
                      textAlign: col.align ?? "left",
                    }}
                    className={[
                      "select-none border-b border-slate-200/60 text-xs font-semibold uppercase tracking-wide dark:border-white/10",
                      densityPad,
                      stickyCls,
                      col.className ?? "",
                      "cursor-default",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate">{col.header ?? col.key}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* BODY (tampilkan semua rows; tidak di-slice/di-page) */}
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  {empty ?? "No data"}
                </td>
              </tr>
            ) : (
              rows.map((row, ri) => (
                <tr
                  key={rowKey(row)}
                  className="odd:bg-[#0b172c] even:bg-[#091324] hover:bg-[#102039] text-cyan-50 dark:odd:bg-[#0d1426]/45 dark:even:bg-[#0b1220]/45 dark:hover:bg-cyan-400/10"
                >
                  {columns.map((col) => {
                    const stickyCls =
                      col.sticky === "left"
                        ? "sticky left-0 z-10"
                        : col.sticky === "right"
                        ? "sticky right-0 z-10"
                        : "";

                    let content: React.ReactNode = null;
                    if (col.key === "idx") {
                      content = (
                        <span className="inline-grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-cyan-200 to-cyan-400 font-semibold text-slate-900 shadow-md dark:from-cyan-300 dark:to-cyan-500">
                          {ri + 1}
                        </span>
                      );
                    } else if (typeof col.accessor === "function") {
                      content = col.accessor(row, ri);
                    } else if (typeof col.accessor === "string") {
                      // @ts-ignore
                      content = (row as any)[col.accessor] ?? null;
                    }

                    return (
                      <td
                        key={col.key}
                        className={`align-middle text-sm ${densityPad} ${stickyCls} ${col.className ?? ""}`}
                        style={{
                          width: col.width
                            ? typeof col.width === "number"
                              ? `${col.width}px`
                              : col.width
                            : undefined,
                          textAlign: col.align ?? "left",
                        }}
                        title={typeof content === "string" ? content : undefined}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}


/* ============================================================
   Types — samakan dengan respons API kamu
   ============================================================ */
type RestorePerson = {
  nik: string;
  noKk: string;
  namaLgkp: string;
  tmptLhr: string | null;
  tglLhr: string | null;
  aktaLhr: string | null;
  noAktaLhr: string | null;
  namaIbu: string | null;
  namaAyah: string | null;
  flagStatus: "AKTIF" | "TIDAK AKTIF";
  namaKec: string | null;
  namaKel: string | null;
  alamat: string | null;
  rt: string | null;
  rw: string | null;
  namaKep: string | null;
  statHubkel: string | null;
  jenisKelamin: string | null;
  currentStatusCode: string | null;
  ket: string | null;
  path: string | null;
  photoSource?: "T5_FOTO" | "FACES" | "PLACEHOLDER";
  faceBase64?: string | null;
  faceMime?: string | null;
  alasan?: string | null;
  descAlasan?: string | null;
  deletedBy?: string | null;
  deletedAt?: string | null;
  tglEntri?: string | null;
  tglUbah?: string | null;
};

type RestoreFamily = {
  nik: string;
  noKk: string;
  statHubkel: string | null;
  statHbkel?: string | null;
  namaLgkp: string;
  tglLhr: string | null;
  namaKecamatan: string | null;
  namaKelurahan: string | null;
  currentStatusCode: string | null;
  flagStatus: string | null;
  deletedBy: string | null;
};

type HistoryPindah = {
  noPindah: string | null;
  klasifikasiPindah: string | null;
  dari: {
    provinsi: string | null;
    kabupaten: string | null;
    kecamatan: string | null;
    kelurahan: string | null;
  };
  tujuan: {
    provinsi: string | null;
    kabupaten: string | null;
    kecamatan: string | null;
    kelurahan: string | null;
  };
  tanggal: string | null;
};

type RestoreApiData = {
  source: "ACTIVE" | "DELETED" | "ARCHIVE" | "FAMILY_ONLY" | "NONE";
  person: RestorePerson | null;
  family: RestoreFamily[];
  historyPindah: HistoryPindah | null;
  historyKematian: string | null;
};

type Mode = "nik" | "kk";

/* ============================================================
   Const
   ============================================================ */
const LEGACY_PHOTO_BASE = "http://10.32.73.7:8080/monitoring/assets/siak_old";

/* placeholders (dark/luxe) */
const PLACEHOLDER_MALE_DARK = "/assets/upload/cyber_man.png";
const PLACEHOLDER_FEMALE_DARK = "/assets/upload/cyber_woman.png";
const PLACEHOLDER_MALE_LIGHT = "/assets/upload/lux_man.png";
const PLACEHOLDER_FEMALE_LIGHT = "/assets/upload/lux_woman.png";

const badgeClasses: Record<string, string> = {
  AKTIF:
    "border border-emerald-200 bg-emerald-100 text-emerald-700 shadow-sm dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  "TIDAK AKTIF":
    "border border-rose-200 bg-rose-100 text-rose-700 shadow-sm dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300",
  "AKTIF DI SIAK":
    "border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  "TIDAK AKTIF DI SIAK":
    "border border-amber-200 bg-amber-50 text-amber-700 shadow-sm dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300",
  "DATA DEMOGRAPHICS":
    "border border-cyan-200 bg-cyan-50 text-cyan-700 shadow-sm dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-200",
};

const fallbackBadgeClass =
  "border border-slate-200 bg-slate-100 text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/70";

/* ============================================================
   Helpers
   ============================================================ */
function buildPhotoUrl(person: RestorePerson | null): string | null {
  if (!person?.path || person.path === "-") return null;
  const cleaned = person.path.replace(/^[\\/]+/, "").replace(/[\\/]+$/, "");
  const normalized = cleaned.startsWith("upload/Foto/")
    ? cleaned
    : cleaned.startsWith("Foto/")
    ? `upload/${cleaned}`
    : `upload/Foto/${cleaned}`;
  return `${LEGACY_PHOTO_BASE}/${normalized}/${person.nik}.jpg`;
}

function buildFaceDataUrl(person: RestorePerson | null): string | null {
  if (!person?.faceBase64) return null;
  const mime = person.faceMime || "image/jpeg";
  return `data:${mime};base64,${person.faceBase64}`;
}

function fmtLocal(ts?: string | null): string | null {
  if (!ts) return null;
  const mIso = ts.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (mIso) return `${mIso[3]}-${mIso[2]}-${mIso[1]}`;
  const mDmy = ts.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (mDmy) return ts.slice(0, 10);
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

function useThemeDark(): boolean {
  const [isDark, setIsDark] = React.useState(false);
  React.useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      const byClass = root.classList.contains("dark");
      const byAttr = (root.getAttribute("data-theme") || "").toLowerCase() === "dark";
      setIsDark(byClass || byAttr);
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

/* ============================================================
   Small components
   ============================================================ */
function DataRow({
  label,
  value,
  highlight,
  badge,
}: {
  label: string;
  value?: string | null;
  highlight?: boolean;
  badge?: "TERDAFTAR" | "TIDAK ADA";
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500/80 dark:text-slate-400/80">
        {label}
      </p>
      <p
        className={`text-sm transition-colors ${
          highlight ? "font-semibold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-200"
        }`}
      >
        {value && value !== "-" ? value : "-"}
        {badge && (
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
              badge === "TERDAFTAR"
                ? "border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-300/40 dark:bg-emerald-500/20 dark:text-emerald-200"
                : "border border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-300/40 dark:bg-rose-500/20 dark:text-rose-200"
            }`}
          >
            {badge}
          </span>
        )}
      </p>
    </div>
  );
}

function HistoryCard({
  title,
  icon,
  children,
  tone = "default",
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: "default" | "danger" | "info" | "gold";
}) {
  const base =
    tone === "danger"
      ? "border border-rose-200 bg-rose-50 text-rose-700 shadow-sm dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-50"
      : tone === "info"
      ? "border border-cyan-200 bg-cyan-50 text-cyan-700 shadow-sm dark:border-cyan-400/40 dark:bg-cyan-500/10 dark:text-cyan-50"
      : tone === "gold"
      ? "border border-amber-300 bg-gradient-to-tr from-[#d4af37] via-[#f6d365] to-[#ffe8a3] text-white shadow-sm dark:border-cyan-400/40 dark:bg-cyan-500/10 dark:text-cyan-50"
      : "border border-slate-200 bg-white/85 text-slate-600 shadow-sm dark:border-white/5 dark:bg-white/3 dark:text-slate-100";

  return (
    <div className={`rounded-xl ${base} p-3 transition`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em]">
        {icon}
        <span>{title}</span>
      </div>
      {React.createElement("div", { className: "mt-2 text-sm leading-relaxed" }, children)}
    </div>
  );
}

/* ============================================================
   Page
   ============================================================ */
export default function RestorePage() {
  const { user } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>("nik");
  const [nik, setNik] = useState("");
  const [noKk, setNoKk] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RestoreApiData | null>(null);
  const [forceFace, setForceFace] = useState(false);

  // ?nik= → auto fetch
  useEffect(() => {
    const nikFromUrl = searchParams.get("nik");
    if (nikFromUrl && nikFromUrl.length === 16) {
      setMode("nik");
      setNik(nikFromUrl);
      void handleSubmitInternal(nikFromUrl, "nik-from-url");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const person = result?.person ?? null;
  const activeInput = mode === "nik" ? nik : noKk;

  const photoUrlFromPath = buildPhotoUrl(person);
  const photoUrlFromFace = buildFaceDataUrl(person);

  const hasFaceShown = useMemo(() => {
    const showPath = !forceFace && !!photoUrlFromPath;
    const showFace = forceFace ? !!person?.faceBase64 : !!photoUrlFromFace;
    return showPath || showFace;
  }, [forceFace, photoUrlFromPath, photoUrlFromFace, person?.faceBase64]);

  const statusBadge = useMemo(() => {
    if (!person) return null;
    const flag = person.flagStatus ?? "";
    const ket = person.ket ?? "";
    return (
      <div className="flex flex-wrap gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClasses[flag] ?? fallbackBadgeClass}`}>
          {flag}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClasses[ket] ?? fallbackBadgeClass}`}>
          {ket}
        </span>
      </div>
    );
  }, [person]);

  const isDark = useThemeDark();

  const KTP_DANGER_CODES = new Set<string>([
    "ENROLL_FAILURE_AT_REGIONAL",
    "PACKET_RETRY",
    "RECEIVED_AT_CENTRAL",
    "PROCESSING",
    "SENT_FOR_ENROLLMENT",
    "ENROLL_FAILURE_AT_CENTRAL",
    "SEARCH_FAILURE_AT_CENTRAL",
    "ADJUDICATE_RECORD",
    "ADJUDICATE_IN_PROCESS",
    "SENT_FOR_DEDUP",
    "DUPLICATE_RECORD",
  ]);

  function getKtpStatusTag(code?: string | null): "restore-tag--ok" | "restore-tag--warn" | "restore-tag--danger" {
    const c = (code ?? "").trim().toUpperCase();
    if (c === "BELUM REKAM") return "restore-tag--warn";
    if (KTP_DANGER_CODES.has(c)) return "restore-tag--danger";
    return "restore-tag--ok";
  }

  /* ------------------------------------------------------------
     Core fetch logic
     ------------------------------------------------------------ */
  const handleSubmitInternal = useCallback(
    async (value: string, source: "form" | "family-action" | "nik-from-url") => {
      setError(null);
      setResult(null);
      setForceFace(false);

      const raw = String(value ?? "").replace(/\D/g, "").slice(0, 16);
      if (!raw || raw.length !== 16) {
        setError("Isi NIK/No KK lengkap (16 digit).");
        return;
      }

      if (source === "family-action" || source === "nik-from-url") {
        setMode("nik");
        setNik(raw);
      }

      const payload: Record<string, string> = {};
      if (source === "family-action" || source === "nik-from-url" || mode === "nik") payload.nik = raw;
      else payload.noKk = raw;

      if (user?.S_NO_KEC && user.S_NO_KEC !== 0) payload.noKec = String(user.S_NO_KEC);

      setLoading(true);
      try {
        const res = await fetch("/api/restore/bio-wni", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json?.success) throw new Error(json?.message || "Gagal memuat data");
        const data = json.data as RestoreApiData;
        setResult(data);

        if (source === "family-action" || source === "nik-from-url" || mode === "nik")
          setNoKk(String(data?.person?.noKk ?? ""));
        else setNik(String(data?.person?.nik ?? ""));
      } catch (err: any) {
        setError(err?.message ?? "Tidak dapat memproses permintaan");
      } finally {
        setLoading(false);
      }
    },
    [mode, user?.S_NO_KEC]
  );

  const handleSubmit = useCallback(() => {
    const value = mode === "nik" ? nik : noKk;
    if (!value) return;
    void handleSubmitInternal(value, "form");
  }, [mode, nik, noKk, handleSubmitInternal]);

  const handleFamilyClick = useCallback(
    (familyNik: string) => {
      if (!familyNik) return;
      startTransition(() => {
        router.replace(`?nik=${familyNik}`);
      });
      void handleSubmitInternal(familyNik, "family-action");
    },
    [handleSubmitInternal, router]
  );

  const onReset = useCallback(() => {
    setNik("");
    setNoKk("");
    setResult(null);
    setError(null);
    setForceFace(false);
    startTransition(() => {
      router.replace("?");
    });
  }, [router]);

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-10 pt-6 text-gray-100 sm:px-6 md:px-8 md:pt-8">
      {/* glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-[-15%] h-[1100px] w-[1100px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[18%] bottom-[-20%] h-[1000px] w-[1000px] rounded-full bg-fuchsia-600/12 blur-[190px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500/80 dark:text-slate-400/70">Restore</p>
          <div className="flex items-center gap-3">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
            <h1 className="text-base font-semibold tracking-wide text-cyan-200">Monitoring — Restore Biodata WNI</h1>
            <div className="ml-auto flex items-center gap-2">
              <div className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
                User: {(user as any)?.S_NAMA_LGKP ?? (user as any)?.S_USER_ID ?? "-"}
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Telusuri biodata aktif maupun arsip, termasuk yang pernah dihapus atau punya riwayat kematian/pindah.
          </p>
        </header>

        {/* Toolbar */}
        <div className="space-y-6 p-6">
          <div className="ktpel-tabs">
            <button
              type="button"
              onClick={() => setMode("nik")}
              className={`ktpel-tab${mode === "nik" ? " ktpel-tab--active" : ""}`}
              aria-pressed={mode === "nik"}
            >
              Cari via NIK
            </button>
            <button
              type="button"
              onClick={() => setMode("kk")}
              className={`ktpel-tab${mode === "kk" ? " ktpel-tab--active" : ""}`}
              aria-pressed={mode === "kk"}
            >
              Cari via No KK
            </button>

            <div className="ml-auto flex items-center gap-2 text-xs text-cyan-200/70">
              <ShieldOff className="h-3.5 w-3.5 text-amber-300/80" />
              <span>Penelusuran read-only</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[2fr_2fr_auto] sm:items-end">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
                {mode === "nik" ? "NIK" : "No KK"}
              </label>
              <input
                value={mode === "nik" ? nik : noKk}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 16);
                  if (mode === "nik") setNik(v);
                  else setNoKk(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                inputMode="numeric"
                maxLength={16}
                placeholder={mode === "nik" ? "16 digit NIK" : "16 digit No KK"}
                className="w-full rounded-xl border border-cyan-800/50 bg-black/30 px-4 py-3 font-mono text-sm tracking-widest text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
                Otomatis isi dari hasil terakhir
                <span className="ml-2 inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-widest text-slate-500 border-slate-300 dark:text-slate-300 dark:border-white/15">
                  Auto
                </span>
              </label>

              <input
                value={mode === "nik" ? noKk : nik}
                readOnly
                disabled
                aria-disabled="true"
                tabIndex={-1}
                title="Otomatis diisi dari hasil pencarian (tidak bisa diubah)"
                className="w-full cursor-not-allowed select-none rounded-xl border px-4 py-3 text-sm
                           bg-slate-100 text-slate-500 border-slate-300
                           dark:bg-white/5 dark:text-slate-400 dark:border-white/10"
                placeholder={mode === "nik" ? "No KK hasil pencarian" : "NIK hasil pencarian"}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-2 rounded-2xl border border-cyan-800/50 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                <RefreshCcw className="h-4 w-4" />
                RESET
              </button>

              <button
                type="button"
                disabled={loading || !activeInput}
                onClick={handleSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100 shadow-[0_6px_16px_rgba(0,255,255,0.08)] transition hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                Search
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-1 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </section>

      {/* loading */}
      {loading && (
        <div
          className={
            isDark
              ? "restore-loading flex items-center justify-center gap-3 rounded-2xl border border-white/5 bg-slate-900/30 p-6 text-sm text-slate-200"
              : "restore-loading flex items-center justify-center gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--gold-200),#000_14%)] bg-[color-mix(in_oklab,var(--lux-surface),#fff_10%)] p-6 text-sm text-[color-mix(in_oklab,#1a1d21,#000_8%)] shadow-[0_12px_30px_rgba(210,182,138,0.25)]"
          }
        >
          <Loader2
            className={
              isDark
                ? "restore-loading__icon h-4 w-4 animate-spin text-cyan-300"
                : "restore-loading__icon h-4 w-4 animate-spin text-[color-mix(in_oklab,var(--gold-400),#000_5%)]"
            }
          />
          <span>Menyiapkan data biodata dan keluarga…</span>
        </div>
      )}

      {/* result */}
      {!loading && result && (
        <div className="flex flex-col gap-6">
          {/* person */}
          {person ? (
            <section className="restore-section grid gap-6 p-6 transition-colors md:grid-cols-[320px,1fr]">
              {/* kiri: foto */}
              <div
                className="restore-photo overflow-hidden rounded-2xl border border-slate-200/60 bg-slate-100/80 shadow-inner dark:border-white/10 dark:bg-slate-900/40"
                data-hasface={hasFaceShown ? "1" : "0"}
              >
                <div className="relative w-full" style={{ aspectRatio: "4 / 5" }}>
                  {forceFace ? (
                    person?.faceBase64 ? (
                      <FaceCard faceBase64={person.faceBase64 ?? null} mime={person.faceMime ?? "image/jpeg"} alt={person.namaLgkp} />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400">Tidak ada foto</div>
                    )
                  ) : photoUrlFromPath ? (
                    <img
                      src={photoUrlFromPath}
                      alt={person.namaLgkp}
                      width={480}
                      height={600}
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={() => setForceFace(true)}
                      draggable={false}
                    />
                  ) : photoUrlFromFace ? (
                    <FaceCard faceBase64={person.faceBase64 ?? null} mime={person.faceMime ?? "image/jpeg"} alt={person.namaLgkp} />
                  ) : (
                    (() => {
                      const female = (person?.jenisKelamin ?? "").toUpperCase() === "PEREMPUAN";
                      const placeholderSrc = female
                        ? isDark
                          ? PLACEHOLDER_FEMALE_DARK
                          : PLACEHOLDER_FEMALE_LIGHT
                        : isDark
                        ? PLACEHOLDER_MALE_DARK
                        : PLACEHOLDER_MALE_LIGHT;

                      const phWrapClass = isDark
                        ? "restore-photo-placeholder bg-[color-mix(in_oklab,#0b1220,#fff_0%)] ring-1 ring-white/10"
                        : "restore-photo-placeholder bg-[color-mix(in_oklab,var(--lux-surface),#000_6%)] ring-1 ring-[color-mix(in_oklab,var(--gold-400),#000_12%)]/35";

                      return (
                        <div className={`absolute inset-0 grid place-items-center ${phWrapClass}`}>
                          <img
                            key={isDark ? "ph-dark" : "ph-light"}
                            src={placeholderSrc}
                            alt=""
                            width={480}
                            height={600}
                            className="max-h-[96%] max-w-[96%] select-none object-contain"
                            draggable={false}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      );
                    })()
                  )}

                  {/* badge status */}
                  {statusBadge && <div className="restore-photo__badges absolute bottom-3 left-3 flex flex-wrap gap-2">{statusBadge}</div>}
                </div>

                {/* identitas singkat */}
                <div className="restore-info-card rounded-2xl border border-slate-200/60 bg-white/90 p-4 text-sm shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.26em] text-slate-500/80 dark:text-slate-400/80">
                    <User className="h-3.5 w-3.5" />
                    Identitas
                  </div>
                  <dl className="mt-3 space-y-2">
                    <DataRow label="NIK" value={person.nik} highlight />
                    <DataRow label="No KK" value={person.noKk} />
                    <DataRow label="Nama Lengkap" value={person.namaLgkp} />
                    <DataRow label="Tempat, Tanggal Lahir" value={`${person.tmptLhr ?? "-"} • ${person.tglLhr ?? "-"}`} />
                    <DataRow label="Jenis Kelamin" value={person.jenisKelamin} />
                    <DataRow label="Hubungan Keluarga" value={person.statHubkel} />
                  </dl>
                </div>
              </div>

              {/* kanan: detail */}
              <div className="space-y-6">
                <div className="restore-info-card rounded-2xl border border-slate-200/60 bg-white/90 p-5 text-sm shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DataRow label="Alamat" value={person.alamat} />
                    <DataRow label="RT / RW" value={`${person.rt ?? "-"} / ${person.rw ?? "-"}`} />
                    <DataRow label="Kecamatan" value={person.namaKec} />
                    <DataRow label="Kelurahan" value={person.namaKel} />
                    <DataRow label="Nama Kepala Keluarga" value={person.namaKep} />
                    <DataRow label="Status Perekaman" value={person.currentStatusCode} />
                    <DataRow label="Tgl Entri" value={fmtLocal(person.tglEntri)} />
                    <DataRow label="Tgl Ubah" value={fmtLocal(person.tglUbah)} />
                    <DataRow label="Nama Ibu" value={person.namaIbu} />
                    <DataRow label="Nama Ayah" value={person.namaAyah} />
                    <DataRow label="No Akta Lahir" value={person.noAktaLhr} badge={person.noAktaLhr ? "TERDAFTAR" : "TIDAK ADA"} />
                  </div>
                </div>

                {result.source === "DELETED" && (person.alasan !== "-" || person.deletedBy !== "-") && (
                  <div className="restore-note rounded-2xl border border-amber-200/50 bg-amber-50/70 p-4 text-sm shadow-sm backdrop-blur dark:border-amber-400/30 dark:bg-amber-500/10">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-amber-600 dark:text-amber-200">
                      <History className="h-3.5 w-3.5" />
                      Catatan Penghapusan
                    </div>
                    <div className="mt-2 space-y-1">
                      <p>
                        Alasan: <span className="font-semibold">{person.alasan ?? "-"}</span>
                      </p>
                      <p>
                        Detail: <span className="font-semibold">{person.descAlasan ?? "-"}</span>
                      </p>
                      <p>
                        Dihapus oleh: <span className="font-semibold">{person.deletedBy ?? "-"}</span> •{" "}
                        <span>{person.deletedAt ?? "-"}</span>
                      </p>
                    </div>
                  </div>
                )}

                {result.source === "ARCHIVE" && (
                  <HistoryCard title="Referensi Arsip Demographics" icon={<Activity className="h-3.5 w-3.5" />} tone={isDark ? "info" : "gold"}>
                    Data induk tidak ditemukan pada BIODATA WNI MASTER maupun BIODATA WNI DELETE. Informasi yang
                    ditampilkan berasal dari tabel <span className="font-semibold">Demographics Ktp-El</span>.
                  </HistoryCard>
                )}

                {(result.historyKematian || result.historyPindah) && (
                  <div className="restore-info-card rounded-2xl border border-slate-200/60 bg-white/90 p-4 text-sm shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
                    <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500/80 dark:text-slate-400/80">
                      <Activity className="h-3.5 w-3.5" />
                      Jejak Peristiwa (ditampilkan walau AKTIF)
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {result.historyKematian && (
                        <HistoryCard title="History Kematian" icon={<History className="h-3.5 w-3.5" />} tone="danger">
                          <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: safeRichText(result.historyKematian) }} />
                        </HistoryCard>
                      )}
                      {result.historyPindah && (
                        <HistoryCard title="History Pindah" icon={<MapPin className="h-3.5 w-3.5" />} tone={isDark ? "info" : "gold"}>
                          <div className="space-y-1 text-sm">
                            <p>
                              No Pindah: <span className="font-semibold">{result.historyPindah.noPindah ?? "-"}</span>
                            </p>
                            <p>
                              Klasifikasi:{" "}
                              <span className="font-semibold">{result.historyPindah.klasifikasiPindah ?? "-"}</span>
                            </p>
                            <p>
                              Dari:{" "}
                              <span className="font-semibold">
                                {[result.historyPindah.dari.provinsi, result.historyPindah.dari.kabupaten, result.historyPindah.dari.kecamatan, result.historyPindah.dari.kelurahan]
                                  .filter(Boolean)
                                  .join(" / ") || "-"}
                              </span>
                            </p>
                            <p>
                              Ke:{" "}
                              <span className="font-semibold">
                                {[result.historyPindah.tujuan.provinsi, result.historyPindah.tujuan.kabupaten, result.historyPindah.tujuan.kecamatan, result.historyPindah.tujuan.kelurahan]
                                  .filter(Boolean)
                                  .join(" / ") || "-"}
                              </span>
                            </p>
                            <p>
                              Tanggal: <span className="font-semibold">{result.historyPindah.tanggal ?? "-"}</span>
                            </p>
                          </div>
                        </HistoryCard>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="restore-section p-6 text-sm">
              <div className="flex items-start gap-4">
                <ShieldOff className="mt-1 h-5 w-5 text-amber-500 dark:text-amber-300/80" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Biodata utama tidak ditemukan</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Cek kembali NIK / No KK. Jika keluarga masih ada di arsip, data akan tetap muncul di tabel keluarga.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* family */}
          <section className="restore-section p-6 transition">
            <div className="restore-family-card">
              <div className="restore-family-card__header">
                <div className="restore-family-card__title">
                  <Users2 className="h-4 w-4" />
                  <div>
                    <p className="restore-family-card__heading">Keluarga pada No KK terkait</p>
                    <p className="restore-family-card__sub">Anggota keluarga dari referensi biodata</p>
                  </div>
                </div>
                <div className="restore-family-card__meta">
                  <span className="restore-family-card__count">{result.family.length}</span>
                  <span className="restore-family-card__count-label">anggota</span>
                </div>
              </div>

              {result.family.length ? (
                <div className="mt-4">
                  <CustomTable
                    rows={result.family}
                    initialPageSize={10}
                    initialSortKey="namaLgkp"
                    initialSortDir="asc"
                    density="comfortable"
                    rowKey={(r) => r.nik}
                    columns={[
                      {
                        key: "idx",
                        header: "#",
                        width: 56,
                        align: "center",
                        sticky: "left",
                        sortable: false,
                      },
                      {
                        key: "namaLgkp",
                        header: "Nama",
                        width: 260,
                        sticky: "left",
                        accessor: (r) => <div className="restore-family-name">{r.namaLgkp}</div>,
                        sortValue: (r) => r.namaLgkp ?? "",
                        sortable: true,
                      },
                      {
                        key: "nik",
                        header: "NIK",
                        width: 210,
                        accessor: (r) => <div className="restore-family-nik">{r.nik}</div>,
                        sortValue: (r) => r.nik ?? "",
                        sortable: true,
                      },
                      {
                        key: "statHubkel",
                        header: "Hubkel",
                        width: 140,
                        accessor: (r) => (
                          <span className="restore-tag restore-tag--soft">{r.statHubkel ?? r.statHbkel ?? "-"}</span>
                        ),
                        sortValue: (r) => r.statHubkel ?? r.statHbkel ?? "",
                        align: "left",
                        sortable: true,
                      },
                      {
                        key: "tglLhr",
                        header: "Tanggal Lahir",
                        width: 140,
                        accessor: (r) => <span className="restore-family-date">{r.tglLhr ?? "-"}</span>,
                        sortValue: (r) => r.tglLhr ?? "",
                        sortable: true,
                      },
                      {
                        key: "wilayah",
                        header: "Wilayah",
                        width: 220,
                        accessor: (r) => (
                          <span
                            className="restore-family-location"
                            title={`${r.namaKecamatan ?? ""} / ${r.namaKelurahan ?? ""}`.trim()}
                          >
                            {[r.namaKecamatan, r.namaKelurahan].filter(Boolean).join(" / ") || "-"}
                          </span>
                        ),
                        sortValue: (r) => `${r.namaKecamatan ?? ""} ${r.namaKelurahan ?? ""}`,
                        sortable: true,
                      },
                      {
                        key: "currentStatusCode",
                        header: "Status KTP",
                        width: 220,
                        accessor: (r) => (
                          <span className={`restore-tag ${getKtpStatusTag(r.currentStatusCode)}`}>
                            {r.currentStatusCode ?? "-"}
                          </span>
                        ),
                        sortValue: (r) => r.currentStatusCode ?? "",
                        align: "left",
                        sortable: true,
                      },
                      {
                        key: "flagStatus",
                        header: "Flag",
                        width: 120,
                        accessor: (r) => (
                          <span
                            className={`restore-tag ${
                              r.flagStatus === "AKTIF" ? "restore-tag--ok" : "restore-tag--danger"
                            }`}
                          >
                            {r.flagStatus ?? "-"}
                          </span>
                        ),
                        sortValue: (r) => r.flagStatus ?? "",
                        sortable: true,
                      },
                      {
                        key: "deletedBy",
                        header: "Ket.",
                        width: 160,
                        accessor: (r) => <span className="restore-family-note">{r.deletedBy ?? "-"}</span>,
                        sortValue: (r) => r.deletedBy ?? "",
                        sortable: true,
                      },
                      {
                        key: "action",
                        header: "Action",
                        width: 120,
                        align: "center",
                        sticky: "right",
                        accessor: (r) => (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFamilyClick(r.nik);
                            }}
                            className="restore-family-action"
                            title="Search this NIK"
                          >
                            <Search className="h-3.5 w-3.5" />
                            Search
                          </button>
                        ),
                      },
                    ]}
                    empty={
                      <div className="restore-family-empty">
                        <CheckCircle2 className="icon" />
                        <div>
                          <p className="restore-family-empty__title">Tidak ada data keluarga</p>
                          <p className="restore-family-empty__desc">
                            Referensi ini tidak memiliki anggota keluarga di arsip aktif.
                          </p>
                        </div>
                      </div>
                    }
                  />
                </div>
              ) : (
                <div className="restore-family-empty">
                  <CheckCircle2 className="icon" />
                  <div>
                    <p className="restore-family-empty__title">Tidak ada data keluarga</p>
                    <p className="restore-family-empty__desc">
                      Referensi ini tidak memiliki anggota keluarga di arsip aktif.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
