"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, List as ListIcon, RefreshCcw, Search, Trash2 } from "lucide-react";
import DateRangePopup from "@/components/ui/DateRangePopup";
import Image from "next/image";

/* ===== Types ===== */
type PemanfaatanRow = {
  KATEGORI: string;
  NAMA_INSTANSI: string;
  NIK: string;
  USER_NAME: string;
  NOKEC?: number | string | null;
  NOKEL?: number | string | null;
  BARU: number;
  MELENGKAPI: number;
  BATAL: number;
  SUDAH_DIVERIFIKASI: number;
  SELESAI: number;
  JUMLAH: number;
};

type Tab = "master" | "excel";

/* ===== Helpers ===== */
const iso = (d: Date) => d.toISOString().slice(0, 10);
const todayISO = () => iso(new Date());
const toDisp = (s: string) => { const [y, m, d] = s.split("-"); return `${d}-${m}-${y}`; };
const rangeLabel = (s: string, e: string) => `(${toDisp(s)} - ${toDisp(e)})`;
const monthEdges = (d = new Date()) => {
  const s = new Date(d.getFullYear(), d.getMonth(), 1);
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: iso(s), end: iso(e) };
};

const fallbackAvatar = "/assets/plugins/images/calming-cat.gif";
const PLACEHOLDER_LIGHT = "/assets/upload/lux_man.png";
const PLACEHOLDER_DARK  = "/assets/upload/cyber_man.png";

// pilih placeholder berdasar theme
const placeholderByTheme = (isDark: boolean) => (isDark ? PLACEHOLDER_DARK : PLACEHOLDER_LIGHT);

// jika nanti butuh nik (foto asli), tetap konsisten signature-nya
const kerjasamaAvatar = (nik?: string | null, isDark?: boolean) =>
  placeholderByTheme(Boolean(isDark));
// const kerjasamaAvatar = (nik?: string | null) => (nik ? fallbackAvatar : fallbackAvatar);
// const kerjasamaAvatar = (nik?: string | null) => (nik ? `/assets/upload/pp_kerjasama/${nik}.jpg` : fallbackAvatar);

/* ===== Order & label kategori (sesuai instruksi) ===== */
const ORDER_KEYS = [
  "KELURAHAN",
  "KUA",
  "PENGADILAN AGAMA",
  "BIDAN",
  "RUMAH SAKIT",         // (DB: tetap "RUMAH SAKIT") tampil: RS/Klinik/Puskesmas
  "RUMAH DUKA",
  "HOTLINE EXTERNAL",
] as const;

const LABEL_MAP: Record<string, string> = {
  "KELURAHAN": "INOVASI PELITA HATI (KELURAHAN)",
  "KUA": "INOVASI KOMPAK KANG (KUA)",
  "PENGADILAN AGAMA": "INOVASI SIAP PA (PENGADILAN AGAMA)",
  "BIDAN": "INOVASI PELANA (BIDAN)",
  "RUMAH SAKIT": "INOVASI PELANA (RUMAH SAKIT, KLINIK, DAN PUSKESMAS)",
  "RUMAH DUKA": "INOVASI PADUKA (RUMAH DUKA)",
  "HOTLINE EXTERNAL": "HOTLINE EXTERNAL",
};

const keyOf = (raw?: string) => (raw || "LAINNYA").trim().toUpperCase();

type PemanfaatanGroup = [string, PemanfaatanRow[]];

const parseCode = (value?: string | number | null) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const numeric = Number(value.replace(/[^\d]/g, ""));
    if (Number.isFinite(numeric)) return numeric;
  }
  return Number.POSITIVE_INFINITY;
};

const sortRowsByKategori = (kategori: string, arr: PemanfaatanRow[]) => {
  const byName = (a: PemanfaatanRow, b: PemanfaatanRow) =>
    (a.NAMA_INSTANSI || "").localeCompare(b.NAMA_INSTANSI || "");

  if (kategori === "KELURAHAN") {
    arr.sort((a, b) => {
      const diffKec = parseCode(a.NOKEC) - parseCode(b.NOKEC);
      if (diffKec !== 0) return diffKec;
      const diffKel = parseCode(a.NOKEL) - parseCode(b.NOKEL);
      if (diffKel !== 0) return diffKel;
      return byName(a, b);
    });
    return;
  }

  if (kategori === "KUA") {
    arr.sort((a, b) => {
      const diffKec = parseCode(a.NOKEC) - parseCode(b.NOKEC);
      if (diffKec !== 0) return diffKec;
      return byName(a, b);
    });
    return;
  }

  arr.sort(byName);
};

const buildPemanfaatanGroups = (rows: PemanfaatanRow[]): PemanfaatanGroup[] => {
  const grouped = new Map<string, PemanfaatanRow[]>();

  for (const row of rows) {
    const key = keyOf(row.KATEGORI);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  for (const [kategori, arr] of grouped.entries()) {
    sortRowsByKategori(kategori, arr);
  }

  const ordered: PemanfaatanGroup[] = [];
  for (const key of ORDER_KEYS) if (grouped.has(key)) ordered.push([key, grouped.get(key)!]);

  const others = Array.from(grouped.entries()).filter(([key]) => !ORDER_KEYS.includes(key as any));
  others.sort((a, b) => a[0].localeCompare(b[0]));
  ordered.push(...others);

  return ordered;
};

const flattenPemanfaatanGroups = (groups: PemanfaatanGroup[]) =>
  groups.flatMap(([, items]) => items);

/* ===== Lazy DT ===== */
const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => <div className="px-2 py-6 text-sm">Menyiapkan DataTable...</div>,
});

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
// ====== Export helpers ======
const stripHtml = (d: any) => String(d ?? "").replace(/<[^>]*>/g, "");

// indeks kolom di DataTables (0-based): 
// 0 No, 1 Kategori, 2 Nama Instansi, 3 Nama Petugas, 4 NIK Petugas, 5 Baru, 6 Upload Ulang, 7 Batal, 8 Diverifikasi, 9 Selesai, 10 Jumlah
const NIK_COL_IDX = 4;

// CSV: paksa Excel baca string dengan ="..."
const bodyCsvPemanfaatan = (data: any, _row: number, col: number) => {
  const t = stripHtml(data).replace(/^[,\s]+/, "");
  return col === NIK_COL_IDX ? '="' + t.replace(/"/g, '""') + '"' : t;
};

// XLSX: kirim teks polos; nanti dipaksa string lewat customize()
const bodyXlsxPemanfaatan = (data: any) => stripHtml(data).replace(/^[,\s]+/, "");

// Excel customize: jadikan kolom E (NIK Petugas) bertipe string
const excelCustomizePemanfaatan = (xlsx: any) => {
  try {
    const sheetName = Object.keys(xlsx?.xl?.worksheets ?? {})[0]; // biasanya "sheet1.xml"
    if (!sheetName) return;
    const sheetStr = xlsx.xl.worksheets[sheetName];
    if (typeof sheetStr !== "string") return;

    const doc = new DOMParser().parseFromString(sheetStr, "application/xml");
    // Semua sel pada kolom E (E1, E2, ...) dipaksa string
    doc.querySelectorAll('row c[r^="E"]').forEach((c) => c.setAttribute("t", "str"));

    xlsx.xl.worksheets[sheetName] = new XMLSerializer().serializeToString(doc);
  } catch (e) {
    console.warn("excel customize (pemanfaatan) skipped:", e);
  }
};

/* ===== Page ===== */
export default function PemanfaatanPage() {
  const [tab, setTab] = useState<Tab>("master");
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());
  const [rows, setRows] = useState<PemanfaatanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const label = useMemo(() => rangeLabel(start, end), [start, end]);

  async function load(s = start, e = end) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/master/pemanfaatan?start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`, {
        cache: "no-store",
        signal: ac.signal,
      });
      const j = await res.json();
      const data: PemanfaatanRow[] = Array.isArray(j?.data) ? j.data : [];
      if (!ac.signal.aborted) setRows(data);
    } catch (e: any) {
      if (!abortRef.current?.signal.aborted) {
        setRows([]); setError(e?.message || "Gagal memuat data pemanfaatan");
      }
    } finally {
      if (!abortRef.current?.signal.aborted) {
        setLoading(false); setFirstLoad(false);
      }
    }
  }

  useEffect(() => { load(); /* mount */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (end < start) setEnd(start); }, [start, end]);

  const onClear = () => { const t = todayISO(); setStart(t); setEnd(t); };

  return (
    <div className="pemanfaatan-page relative px-8 pb-10 pt-6 md:pt-8 space-y-8 mt-5">
      {/* Ambient glow (masked by overrides in light) */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="abs-glow-cyan absolute top-[-15%] left-[15%] w-[1100px] h-[1100px] blur-[220px] rounded-full" />
        <div className="abs-glow-magenta absolute bottom-[-20%] right-[18%] w-[1000px] h-[1000px] blur-[190px] rounded-full" />
      </div>

      <section className="pemanfaatan-shell rounded-2xl border border-cyan-800/40 bg-[#0b0b1a]/80 backdrop-blur-xl shadow-[0_0_34px_#00ffff22] overflow-hidden">
        {/* ===== Header ===== */}
        <header className="px-5 py-4 border-b border-cyan-900/50 master-head">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <div className="flex items-center gap-3">
              <span className="dot inline-block w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              <h1 className="text-base md:text-lg font-semibold tracking-wide text-cyan-200">
                Master — Pemanfaatan Layanan Online
              </h1>
            </div>

            <div className="md:ml-auto flex items-center gap-2">
              <button
                onClick={() => setTab("master")}
                className={`segbtn inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${tab === "master" ? "is-active bg-cyan-600/30 border border-cyan-400/50 shadow-[0_0_16px_#00ffff66]" : "bg-white/5 border border-white/10 hover:bg-white/10"}`}
              >
                <LayoutGrid className="w-4 h-4" />
                Master View
              </button>
              <button
                onClick={() => setTab("excel")}
                className={`segbtn inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${tab === "excel" ? "is-active bg-cyan-600/30 border border-cyan-400/50 shadow-[0_0_16px_#00ffff66]" : "bg-white/5 border border-white/10 hover:bg-white/10"}`}
              >
                <ListIcon className="w-4 h-4" />
                Excel View
              </button>

              <button
                type="button"
                onClick={() => load()}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition-colors"
                aria-label="Muat ulang data"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {/* ===== Toolbar ===== */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked readOnly className="use-range accent-cyan-500" />
              Rentang Tanggal
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <DateRangePopup
                start={start}
                end={end}
                onChange={(s, e) => { setStart(s); setEnd(e); }}
                minWidth={700}
                months={2}
              />
              <span className="text-xs opacity-80">{label}</span>

              {/* Quick chips */}
              <div className="flex items-center gap-2">
                <Chip onClick={() => { const t = todayISO(); setStart(t); setEnd(t); }}>Today</Chip>
                <Chip onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); const y = iso(d); setStart(y); setEnd(y); }}>Yesterday</Chip>
                <Chip onClick={() => { const to = todayISO(); const d = new Date(); d.setDate(d.getDate() - 6); const fr = iso(d); setStart(fr); setEnd(to); }}>Last 7d</Chip>
                <Chip onClick={() => { const { start: ms, end: me } = monthEdges(); setStart(ms); setEnd(me); }}>This Month</Chip>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => load()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600/25 hover:bg-cyan-600/40 border border-cyan-400/40 text-sm shadow-[0_0_14px_#00ffff55] transition-colors"
              >
                <Search className="w-4 h-4" />
                {loading && !firstLoad ? "Loading…" : "Search"}
              </button>
              <button
                onClick={onClear}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/20 text-sm transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

        {/* ===== Content ===== */}
        <div className="p-5 space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {tab === "master" ? (
            loading && firstLoad ? (
              <MasterSkeletonGrid />
            ) : (
              <MasterCardGroups rows={rows} />
            )
          ) : (
            <ExcelDataTable rows={rows} loading={loading} rangeLabel={label} />
          )}
        </div>
      </section>
    </div>
  );
}

/* ===== Master View (grouped & ordered by custom order) ===== */
function MasterCardGroups({ rows }: { rows: PemanfaatanRow[] }) {
  const groups = useMemo(() => buildPemanfaatanGroups(rows), [rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm">
        Tidak ada data untuk rentang ini.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map(([kategoriKey, items]) => (
        <section key={kategoriKey} className="pemanfaatan-group-block">
          <header className="group-chip">
            <span className="group-chip__dot" />
            <h2 className="group-chip__label">{LABEL_MAP[kategoriKey] ?? kategoriKey}</h2>
          </header>

          <div className="attendance-grid">
          {items.map((r, i) => (
            <PemanfaatanCard key={`${kategoriKey}-${r.NIK}-${i}`} row={r} />
          ))}
        </div>
        </section>
      ))}
    </div>
  );
}

/* ===== Excel View (order awal berdasarkan "No") ===== */
function ExcelDataTable({
  rows,
  loading,
  rangeLabel,
}: {
  rows: PemanfaatanRow[];
  loading: boolean;
  rangeLabel: string;
}) {
  const groups = useMemo(() => buildPemanfaatanGroups(rows), [rows]);
  const orderedRows = useMemo(() => flattenPemanfaatanGroups(groups), [groups]);

  const tableData = useMemo(
    () =>
      orderedRows.map((r, idx) => ({
        no: idx + 1,
        kategori: LABEL_MAP[keyOf(r.KATEGORI)] ?? keyOf(r.KATEGORI),
        nama_instansi: r.NAMA_INSTANSI,
        user_name: r.USER_NAME,
        nik: `'${r.NIK ?? ""}`,
        baru: Number(r.BARU ?? 0),
        upload_ulang: Number(r.MELENGKAPI ?? 0),
        batal: Number(r.BATAL ?? 0),
        diverifikasi: Number(r.SUDAH_DIVERIFIKASI ?? 0),
        selesai: Number(r.SELESAI ?? 0),
        jumlah: Number(r.JUMLAH ?? 0),
      })),
    [orderedRows]
  );

  const hasData = tableData.length > 0;
  const JQ = JQDataTable as any;

  return (
    <section className="pemanfaatan-table-panel space-y-4">
      <header className="pemanfaatan-table-panel__head">
        <div>
          <p className="pemanfaatan-table-panel__eyebrow">Excel Mirror</p>
          <h3>Pemanfaatan Layanan Online</h3>
          <p>Disdukcapil Kota Bandung <span>{rangeLabel}</span></p>
        </div>
      </header>

      <div className="pemanfaatan-table-panel__body relative">
        {/* State kosong / inisialisasi */}
        {loading && !hasData ? (
          <div className="pemanfaatan-table-panel__empty">
            <span className="pemanfaatan-table-panel__spinner" aria-hidden="true" />
            Menyiapkan tabel.
          </div>
        ) : !hasData ? (
          <div className="pemanfaatan-table-panel__empty">Tidak ada data.</div>
        ) : (
          <>
            <JQ
              id="pemanfaatan-table"
              minWidth={1200}
              pageLength={25}
              data={tableData}
              tableClassName="dt-cyberpunk master-dt pemanfaatan-dt"
              columns={[
                { data: "no", title: "No", className: "text-center w-[60px]" },
                { data: "kategori", title: "Kategori", className: "text-center" },
                { data: "nama_instansi", title: "Nama Instansi", className: "text-center" },
                { data: "user_name", title: "Nama Petugas", className: "text-center" },
                { data: "nik", title: "NIK Petugas", className: "text-center" },
                { data: "baru", title: "Baru", className: "text-center font-semibold" },
                { data: "upload_ulang", title: "Upload Ulang", className: "text-center font-semibold" },
                { data: "batal", title: "Batal", className: "text-center font-semibold" },
                { data: "diverifikasi", title: "Diverifikasi", className: "text-center font-semibold" },
                { data: "selesai", title: "Selesai", className: "text-center font-semibold" },
                { data: "jumlah", title: "Jumlah", className: "text-center font-semibold" },
              ]}
              options={{
                stripeClasses: [],
                lengthMenu: [
                  [10, 25, 50, 100],
                  [10, 25, 50, 100],
                ],
                dom:
                  "<'dt-top-bar flex items-center justify-between gap-3'<'dt-left flex items-center gap-2'Bl><'dt-right ml-auto'f>>" +
                  "rt" +
                  "<'dt-bottom-bar flex items-center justify-between gap-3'<'dt-info'i><'dt-paging'p>>",
                language: {
                  search: "",
                  searchPlaceholder: "Search data",
                  lengthMenu: "Tampilkan _MENU_ data",
                  info: "Menampilkan _START_-_END_ dari _TOTAL_ data",
                  infoEmpty: "Menampilkan 0 data",
                  zeroRecords: "Tidak ada data untuk rentang ini",
                  paginate: { previous: "<", next: ">" },
                  processing: "Memproses…",
                },
                order: [[0, "asc"]],
                processing: true, // ✅ indikator bawaan DataTables
              }}
            />

            {/* Overlay loading di atas tabel ketika reload/refresh */}
            {loading && (
              <div
                className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl
                           bg-gradient-to-b from-[#0b0b1a]/40 to-[#0b0b1a]/60 backdrop-blur-[2px]"
                aria-hidden="true"
              >
                <div className="flex items-center gap-3 text-cyan-200 text-sm">
                  <span className="pemanfaatan-table-panel__spinner" />
                  Memuat ulang tabel…
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="pemanfaatan-table-panel__foot">
        Data berdasarkan user Salaman yang didaftarkan.
      </footer>
    </section>
  );
}

/* ===== Small UI ===== */
function Chip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="chip text-xs px-2.5 py-1 rounded-md border border-cyan-700/40 bg-cyan-600/10 hover:bg-cyan-600/20 transition-colors"
    >
      {children}
    </button>
  );
}

/* ===== Skeleton ===== */
function MasterSkeletonGrid() {
  return (
    <div className="salaman-grid">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="salaman-card salaman-card--skeleton animate-pulse" aria-hidden="true">
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
            {[0, 1].map((grp) => (
              <div key={grp} className="salaman-card__section">
                <div className="salaman-card__section-title skeleton-line" />
                <div className="salaman-card__stat-grid">
                  {Array.from({ length: 3 }).map((__, i2) => (
                    <div key={i2} className="salaman-card__stat skeleton-block" />
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
      ))}
    </div>
  );
}
function PemanfaatanCard({ row }: { row: PemanfaatanRow }) {
   const isDark = useThemeDark();
  const avatar = kerjasamaAvatar(row.NIK, isDark);

  // formatter angka
  const n = (v: number) => Number(v ?? 0).toLocaleString("id-ID");

  return (
    <article className="master-card attendance-card">
      {/* === HERO (match Master Absensi) === */}
      <div className="master-card__hero">
        {/* pakai next/image tapi class & fallback sama */}
        <Image
          src={avatar}
          alt={row.NAMA_INSTANSI || "Instansi"}
          width={192}
          height={192}
          quality={92}
          loading="lazy"
          sizes="(max-width: 640px) 112px, 128px"
          className="master-card__avatar object-cover"
          onError={(e: any) => { e.currentTarget.src = placeholderByTheme(isDark); }}
        />
        <h2 className="master-card__name">
          {(row.NAMA_INSTANSI || "—").toUpperCase()}
        </h2>
        <p className="master-card__office">
          {(LABEL_MAP[keyOf(row.USER_NAME)] ?? keyOf(row.USER_NAME))}
        </p>
      </div>

      {/* === BODY (2 kolom stat, sama seperti Absensi) === */}
      <div className="master-card__body">
        <div className="master-card__stat">
          <span className="master-card__stat-label">Pengajuan Baru</span>
          <span className="master-card__stat-value">{n(row.BARU)}</span>
        </div>
        <div className="master-card__stat">
          <span className="master-card__stat-label">Upload Ulang</span>
          <span className="master-card__stat-value">{n(row.MELENGKAPI)}</span>
        </div>
        <div className="master-card__stat">
          <span className="master-card__stat-label">Batal</span>
          <span className="master-card__stat-value">{n(row.BATAL)}</span>
        </div>
        <div className="master-card__stat">
          <span className="master-card__stat-label">Diverifikasi</span>
          <span className="master-card__stat-value">{n(row.SUDAH_DIVERIFIKASI)}</span>
        </div>
        <div className="master-card__stat">
          <span className="master-card__stat-label">Selesai</span>
          <span className="master-card__stat-value">{n(row.SELESAI)}</span>
        </div>
        <div className="master-card__stat">
          <span className="master-card__stat-label">Jumlah</span>
          <span className="master-card__stat-value">{n(row.JUMLAH)}</span>
        </div>
      </div>

      {/* === FOOTER (match) === */}
      <footer className="master-card__footer">
        <span className="master-card__nik-label">NIK Petugas</span>
        <span className="master-card__nik-value">{row.NIK || "—"}</span>
        <span className="master-card__user">{row.USER_NAME || "—"}</span>
      </footer>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="salaman-card__stat">
      <span className="salaman-card__stat-label">{label}</span>
      <span className="salaman-card__stat-value">
        {Number(value ?? 0).toLocaleString("id-ID")}
      </span>
    </div>
  );
}

/* ===== Skeleton (match gaya salaman) ===== */
