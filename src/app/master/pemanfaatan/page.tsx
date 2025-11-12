// FILE: src/app/master/pemanfaatan/page.tsx
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, List as ListIcon, RefreshCcw, Search, Trash2 } from "lucide-react";
import DateRangePopup from "@/components/ui/DateRangePopup";
import { DataShell, LoadingBlank } from "@/components/ui/LoadingOverlay";
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

type SummaryRow = {
  kategori: string;               // "KELURAHAN" | "KUA" | "SIAP PA" | "BIDAN" | "RUMAH SAKIT" | "PADUKA" | "HOTLINE"
  TOTAL_INSTANSI: number;
  BARU: number;
  MELENGKAPI: number;
  BATAL: number;
  SUDAH_DIVERIFIKASI: number;
  SELESAI: number;
  JUMLAH: number;
};

type Tab = "master" | "excel";

/* ===== Helpers (tanggal) ===== */
const iso = (d: Date) => d.toISOString().slice(0, 10);
const todayISO = () => iso(new Date());
const toDisp = (s: string) => { const [y, m, d] = s.split("-"); return `${d}-${m}-${y}`; };
const rangeLabel = (s: string, e: string) => `(${toDisp(s)} - ${toDisp(e)})`;
const monthEdges = (d = new Date()) => {
  const s = new Date(d.getFullYear(), d.getMonth(), 1);
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: iso(s), end: iso(e) };
};

/* =========================================================================
   PLACEHOLDER LANDSCAPE 3:2 – TERTANAM LANGSUNG DI PAGE
   Folder gambar: /assets/upload/
   Nama file:
   - inovasi-hotlineexternal(.png | -lux.png)
   - inovasi-kompakkang(.png | -lux.png)
   - inovasi-paduka(.png | -lux.png)
   - inovasi-pelanabidan(.png | -lux.png)
   - inovasi-pelanarumahsakit(.png | -lux.png)
   - inovasi-pelitahati(.png | -lux.png)
   - inovasi-siappa(.png | -lux.png)
   ======================================================================== */
type InovasiKey =
  | "KELURAHAN"
  | "KUA"
  | "SIAP PA"
  | "BIDAN"
  | "RUMAH SAKIT"
  | "PADUKA"
  | "HOTLINE";

const P = (n: string) => `/assets/upload/${n}`;
const PLACEHOLDER_MAP: Record<
  "KELURAHAN"|"KUA"|"SIAP PA"|"BIDAN"|"RUMAH SAKIT"|"PADUKA"|"HOTLINE",
  { dark: string; light: string }
> = {
  "HOTLINE": { dark: P("inovasi-hotlineexternal.png"),      light: P("inovasi-hotlineexternal-lux.png") },
  "KUA":               { dark: P("inovasi-kompakkang.png"),           light: P("inovasi-kompakkang-lux.png") },
  "PADUKA":        { dark: P("inovasi-paduka.png"),               light: P("inovasi-paduka-lux.png") },
  "BIDAN":             { dark: P("inovasi-pelanabidan.png"),          light: P("inovasi-pelanabidan-lux.png") },
  "RUMAH SAKIT":       { dark: P("inovasi-pelanarumahsakit.png"),     light: P("inovasi-pelanarumahsakit-lux.png") },
  "KELURAHAN":         { dark: P("inovasi-pelitahati.png"),           light: P("inovasi-pelitahati-lux.png") },
  "SIAP PA":  { dark: P("inovasi-siappa.png"),               light: P("inovasi-siappa-lux.png") },
};
const phByKategori = (kategori: string, isDark: boolean) => {
  const key = (kategori || "").trim().toUpperCase() as keyof typeof PLACEHOLDER_MAP;
  const m = PLACEHOLDER_MAP[key] ?? PLACEHOLDER_MAP["HOTLINE"];
  return isDark ? m.dark : m.light;
};

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

/* ===== Order & label kategori (sesuai instruksi) ===== */
const ORDER_KEYS = [
  "KELURAHAN",
  "KUA",
  "SIAP PA",
  "BIDAN",
  "RUMAH SAKIT",         // tampil: RS/Klinik/Puskesmas
  "PADUKA",
  "HOTLINE",
] as const;

const LABEL_MAP: Record<string, string> = {
  "KELURAHAN": "INOVASI PELITA HATI (KELURAHAN)",
  "KUA": "INOVASI KOMPAK KANG (KUA)",
  "SIAP PA": "INOVASI SIAP PA (PENGADILAN AGAMA)",
  "BIDAN": "INOVASI PELANA (BIDAN)",
  "RUMAH SAKIT": "INOVASI PELANA (RUMAH SAKIT, KLINIK, DAN PUSKESMAS)",
  "PADUKA": "INOVASI PADUKA (PADUKA)",
  "HOTLINE": "HOTLINE",
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

/* ===== CSV/XLSX helpers ===== */
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

  const [sumRows, setSumRows] = useState<SummaryRow[]>([]);
  const [sumLoading, setSumLoading] = useState(false);
  const [sumError, setSumError] = useState<string | null>(null);

  const label = useMemo(() => rangeLabel(start, end), [start, end]);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());          // ⬅ state group terbuka
  type GroupAnchorMap = Record<string, HTMLElement | null>;
  const sectionRefs = useRef<GroupAnchorMap>({});
  

  const toggleGroup = (rawKey: string) => {
    const key = (rawKey || "").trim().toUpperCase();
    setOpenKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const openAndJump = (rawKey: string) => {
    const key = (rawKey || "").trim().toUpperCase();
    setOpenKeys(prev => new Set(prev).add(key));
    requestAnimationFrame(() => {
      sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

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

  async function loadSummary(s = start, e = end) {
    setSumLoading(true);
    setSumError(null);
    try {
      const res = await fetch(`/api/master/pemanfaatan/summary?start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`, {
        cache: "no-store",
      });
      const j = await res.json();
      const data: SummaryRow[] = Array.isArray(j?.data) ? j.data : [];
      setSumRows(data);
    } catch (e: any) {
      setSumRows([]);
      setSumError(e?.message || "Gagal memuat ringkasan");
    } finally {
      setSumLoading(false);
    }
  }

  useEffect(() => { 
    load(); 
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (end < start) setEnd(start); }, [start, end]);
  const isBusy = (loading || sumLoading);
  const onClear = () => { const t = todayISO(); setStart(t); setEnd(t); };
  const refreshBoth = () => { load(); loadSummary(); };
  
  return (
    <div className="pemanfaatan-page relative px-8 pb-10 pt-6 md:pt-8 space-y-8 mt-5">
      {/* Ambient glow */}
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
                onClick={refreshBoth}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-sm transition-colors"
                aria-label="Muat ulang data"
              >
                <RefreshCcw className={`w-4 h-4 ${(loading || sumLoading) ? "animate-spin" : ""}`} />
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
                  onClick={refreshBoth}                                  // ← was: () => load()
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600/25 hover:bg-cyan-600/40 border border-cyan-400/40 text-sm shadow-[0_0_14px_#00ffff55] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={isBusy}
                >
                  <Search className={`w-4 h-4 ${isBusy ? "animate-pulse" : ""}`} />
                  {isBusy && !firstLoad ? "Loading…" : "Search"}
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

        {/* ===== RINGKASAN PER KATEGORI ===== */}
        <div className="px-5 pt-4">
            <DataShell
              loading={sumLoading}
              hasData={sumRows.length > 0}
              message="Mengambil ringkasan"
              subtext={label}
            >
              <SummaryStrip
                rows={sumRows}
                loading={sumLoading}
                error={sumError}
                onJump={openAndJump}
              />
            </DataShell>
        </div>

        {/* ===== Content ===== */}
        <div className="p-5 space-y-5">
         {tab === "master" ? (
          <DataShell
            loading={loading}
            hasData={rows.length > 0}
            message="Memuat data"
            subtext={label}
          >
            {error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm">
                {error}
              </div>
            ) : (
              <MasterCardGroups
                rows={rows}
                openKeys={openKeys}
                onToggle={toggleGroup}
                sectionRefs={sectionRefs}
              />
            )}
          </DataShell>
        ) : (
          <DataShell
            loading={loading}
            hasData={rows.length > 0}
            message="Menyiapkan tabel"
            subtext={label}
          >
            {/* Hindari spinner dobel: kirim loading=false ke tabel */}
            <ExcelDataTable rows={rows} loading={false} rangeLabel={label} />
          </DataShell>
        )}
      </div>
    </section>
    </div>
  );
}

/* ===== Master View (grouped & ordered by custom order) ===== */
function MasterCardGroups({
  rows,
  openKeys,
  onToggle,
  sectionRefs,
}: {
  rows: PemanfaatanRow[];
  openKeys: Set<string>;
  onToggle: (key: string) => void;
  sectionRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
}) {
  const groups = useMemo(() => buildPemanfaatanGroups(rows), [rows]);
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm">
        Tidak ada data untuk rentang ini.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(([kategoriKey, items]) => {
        const isOpen = openKeys.has(kategoriKey);
        return (
          <section
              key={kategoriKey}
              ref={(el: HTMLElement | null) => { sectionRefs.current[kategoriKey] = el; }}
              className={`pemanfaatan-group-block collapsible ${isOpen ? "is-open" : ""}`}
            >
            <button
              type="button"
              className="group-chip group-chip--button"
              aria-expanded={isOpen}
              aria-controls={`panel-${kategoriKey}`}
              onClick={() => onToggle(kategoriKey)}
              title={`Toggle ${LABEL_MAP[kategoriKey] ?? kategoriKey}`}
            >
              <span className="group-chip__dot" />
              <h2 className="group-chip__label">{LABEL_MAP[kategoriKey] ?? kategoriKey}</h2>
              <span className={`caret ${isOpen ? "rot" : ""}`} aria-hidden>▾</span>
            </button>

            {isOpen && (
              <div id={`panel-${kategoriKey}`} className="attendance-grid collapsible-body">
                {items.map((r, i) => (
                  <PemanfaatanCard key={`${kategoriKey}-${r.NIK}-${i}`} row={r} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ===== Excel View ===== */
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
                processing: true,
              }}
            />

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
  const isDark = useThemeDark(); // ← hook versi kamu
  const src = phByKategori(row.KATEGORI, isDark);
  const n = (v: number) => Number(v ?? 0).toLocaleString("id-ID");

  return (
    <article className="master-card attendance-card">
      <div className="landscape-hero">
        <Image
          key={`${src}-${isDark}`}    // paksa re-render saat tema berubah
          src={src}
          alt={row.KATEGORI ? `${row.KATEGORI} — ${row.NAMA_INSTANSI || ""}` : "Placeholder Inovasi"}
          fill
          sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 480px"
          className="landscape-img"
          priority={false}
        />
      </div>

      <h2 className="master-card__name ta-center">{(row.NAMA_INSTANSI || "—").toUpperCase()}</h2>
      <p className="master-card__office ta-center">{row.USER_NAME || "—"}</p>

      {/* === BODY (stat) === */}
      <div className="master-card__body">
        <div className="master-card__stat"><span className="master-card__stat-label">Pengajuan Baru</span><span className="master-card__stat-value">{n(row.BARU)}</span></div>
        <div className="master-card__stat"><span className="master-card__stat-label">Upload Ulang</span><span className="master-card__stat-value">{n(row.MELENGKAPI)}</span></div>
        <div className="master-card__stat"><span className="master-card__stat-label">Batal</span><span className="master-card__stat-value">{n(row.BATAL)}</span></div>
        <div className="master-card__stat"><span className="master-card__stat-label">Diverifikasi</span><span className="master-card__stat-value">{n(row.SUDAH_DIVERIFIKASI)}</span></div>
        <div className="master-card__stat"><span className="master-card__stat-label">Selesai</span><span className="master-card__stat-value">{n(row.SELESAI)}</span></div>
        <div className="master-card__stat"><span className="master-card__stat-label">Jumlah</span><span className="master-card__stat-value">{n(row.JUMLAH)}</span></div>
      </div>

      {/* === FOOTER === */}
      <footer className="master-card__footer">
        <span className="master-card__nik-label">NIK Petugas</span>
        <span className="master-card__nik-value">{row.NIK || "—"}</span>
        <span className="master-card__user">{row.USER_NAME || "—"}</span>
      </footer>
    </article>
  );
}

function SummaryStrip({
  rows, loading, error, onJump,
}: {
  rows: SummaryRow[];
  loading: boolean;
  error: string | null;
  onJump: (kategoriKey: string) => void;
}) {
  const order = ["KELURAHAN","KUA","SIAP PA","BIDAN","RUMAH SAKIT","PADUKA","HOTLINE"];
  const map = new Map(rows.map((r) => [r.kategori, r]));
  const data = order.map((k) => map.get(k) || ({
    kategori: k, TOTAL_INSTANSI: 0, BARU: 0, MELENGKAPI: 0, BATAL: 0, SUDAH_DIVERIFIKASI: 0, SELESAI: 0, JUMLAH: 0,
  }));
  const n = (v: number) => Number(v ?? 0).toLocaleString("id-ID");

  return (
    <section className="summary-strip rounded-2xl" aria-labelledby="summary-strip-title" role="region">
      <header className="summary-strip__head">
        <div className="summary-strip__titlewrap">
          <span aria-hidden className="summary-strip__dot" />
          <h3 id="summary-strip-title" className="summary-strip__title">Ringkasan per Kategori Inovasi</h3>
        </div>
        {loading && <span className="summary-strip__loading" aria-live="polite">Memuat ringkasan…</span>}
      </header>

      {error ? (
        <div className="summary-strip__error" role="alert">{error}</div>
      ) : (
        <div className="summary-strip__grid">
          {data.map((r) => (
            <article
              key={r.kategori}
              role="button"
              tabIndex={0}
              onClick={() => onJump(r.kategori)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onJump(r.kategori)}
              className="summary-card summary-card--clickable"
              aria-label={`Buka ${r.kategori}, total ${n(r.JUMLAH)} pengajuan`}
            >
              <p className="summary-card__eyebrow">{r.kategori}</p>

              <div className="summary-card__total">
                <span className="summary-card__total-num">{n(r.JUMLAH)}</span>
                <span className="summary-card__total-label">pengajuan</span>
              </div>

              <dl className="summary-card__mini">
                <div className="summary-card__mini-col"><dt>Baru</dt><dd>{n(r.BARU)}</dd></div>
                <div className="summary-card__mini-col"><dt>Upload</dt><dd>{n(r.MELENGKAPI)}</dd></div>
                <div className="summary-card__mini-col"><dt>Batal</dt><dd>{n(r.BATAL)}</dd></div>
                <div className="summary-card__mini-col"><dt>Selesai</dt><dd>{n(r.SELESAI)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
