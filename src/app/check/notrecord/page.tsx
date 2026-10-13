// FILE: src/app/check/notrecord/page.tsx
"use client";

import dynamic from "next/dynamic";
import { escapeHtml } from "@/lib/safeHtml";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Trash2, RefreshCcw, Info, BarChart3, School2, MapPinned, CheckCircle2 } from "lucide-react";
import JSZip from "jszip";
if (typeof window !== "undefined") (window as any).JSZip = JSZip;

// Penting: pastikan komponen loading terdefinisi sebelum dipakai di dynamic()
import { DataShell, LoadingBlank } from "@/components/ui/LoadingOverlay";

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => <LoadingBlank message="Menyiapkan tabel" subtext="harap tunggu" />,
});

import { useSession } from "@/contexts/session";
import SelectFancy from "@/components/ui/SelectFancy";
import {
  useNotrecordMeta,
  useSekolahOptions,
  loadKelurahanOptions,
  type Option as SelectOption,
} from "@/hooks/useNotrecordOptions";

/* =========================================================
   Types
   ========================================================= */
type BNBA = {
  NO_KEC: number; NIK: string; NAMA_LGKP: string; TGL_LHR: string;
  UMUR: number; WKTP: string; ALAMAT: string; NO_RW: number; NO_RT: number;
  NAMA_KEC: string; NAMA_KEL: string; NAMA_SEKOLAH: string;
  TGL_REKAM: string; PETUGAS_REKAM: string; KET_REKAM: string; CURRENT_STATUS_CODE: string;
  PROV_SEKOLAH?: string; KAB_SEKOLAH?: string; EXCUSE?: string;
  KODE_POS?: string;
  NO_PROP?: number; NAMA_PROP?: string;
  NO_KAB?: number;  NAMA_KAB?: string;
  NO_KEL?: number;
};
type WilDapodik = { NO_KEC:number; KECAMATAN:string; SUDAH_REKAM:number; BELUM_REKAM:number; TOTAL:number; };
type WilNon = WilDapodik;
type LuarProv = { PROV_SEKOLAH:string; KAB_SEKOLAH:string; SUDAH_REKAM:number; BELUM_REKAM:number; TOTAL:number; };
type DalamKec = { PROV_SEKOLAH:string; KAB_SEKOLAH:string; KECAMATAN:string; SUDAH_REKAM:number; BELUM_REKAM:number; TOTAL:number; };
type SekDlm = { PROV_SEKOLAH:string; KAB_SEKOLAH:string; KEC_SEKOLAH:string; NPSN:string; NAMA_SEKOLAH:string; SUDAH_REKAM:number; BELUM_REKAM:number; TOTAL:number; };
type SekLuar = { PROV_SEKOLAH:string; KAB_SEKOLAH:string; NPSN:string; NAMA_SEKOLAH:string; SUDAH_REKAM:number; BELUM_REKAM:number; TOTAL:number; };

/* =========================================================
   Helpers (export/format)
   ========================================================= */
const stripHtml = (d: any) => String(d ?? "").replace(/<[^>]*>/g, "");

type ExportBodyFormatter = (data: any, row: number, col: number) => string;

const createCsvFormatter = (sensitiveCols: number[] = []): ExportBodyFormatter => {
  const sensitive = new Set(sensitiveCols);
  return (data, _row, col) => {
    const t = stripHtml(data).replace(/^[,\s]+/, "");
    if (!sensitive.has(col)) return t;
    return '="' + t.replace(/"/g, '""') + '"';
  };
};

const createExcelFormatter = (cols: number[] = [], prefix = "\u200B"): ExportBodyFormatter => {
  const targets = new Set(cols);
  return (data, _row, col) => {
    const t = stripHtml(data).replace(/^[,\s]+/, "");
    return targets.has(col) ? prefix + t : t;
  };
};

const defaultExportFormatter: ExportBodyFormatter = (data) => stripHtml(data);

const buildButtons = (formatters?: Partial<Record<"copy" | "csv" | "excel" | "print", ExportBodyFormatter>>) => [
  {
    extend: "copy",
    text: "Copy",
    exportOptions: { format: { body: formatters?.copy ?? defaultExportFormatter } },
  },
  {
    extend: "csvHtml5",
    text: "CSV",
    bom: true,
    exportOptions: { format: { body: formatters?.csv ?? defaultExportFormatter } },
  },
  {
    extend: "excelHtml5",
    text: "Excel",
    exportOptions: { format: { body: formatters?.excel ?? defaultExportFormatter } },
  },
  {
    extend: "print",
    text: "Print",
    exportOptions: { format: { body: formatters?.print ?? defaultExportFormatter } },
  },
];

const DT_LANGUAGE = {
  search: "",
  searchPlaceholder: "Search…",
  lengthMenu: "Tampilkan _MENU_ data",
  info: "Menampilkan _START_–_END_ dari _TOTAL_ data",
  infoEmpty: "Menampilkan 0 data",
  paginate: { previous: "‹", next: "›" },
  zeroRecords: "Tidak ada data yang sesuai",
};
const DT_DOM =
  "<'dt-top-bar flex items-center justify-between gap-3'<'dt-left flex items-center gap-2'Bl><'dt-right ml-auto'f>>" +
  "rt" +
  "<'dt-bottom-bar flex items-center justify-between gap-3'<'dt-info'i><'dt-paging'p>>";

const createDtOptions = (
  overrides?: Record<string, any>,
  formatters?: Partial<Record<"copy" | "csv" | "excel" | "print", ExportBodyFormatter>>,
) => ({
  deferRender: true,
  autoWidth: false,
  scrollX: true,
  stripeClasses: [],
  lengthMenu: [
    [10, 25, 50, 100],
    [10, 25, 50, 100],
  ],
  dom: DT_DOM,
  language: { ...DT_LANGUAGE },
  buttons: buildButtons(formatters),
  ...(overrides || {}),
});

// Kolom sensitif: 1=NIK, 3=TGL_LHR, 11=TGL_REKAM (index berdasar definisi columns)
const BNBA_CSV_FORMATTER = createCsvFormatter([1, 3, 11]);
const BNBA_XLSX_FORMATTER = createExcelFormatter([1]); // NIK diberi prefix zero-width agar tidak dipotong Excel

const toNumber = (value: any) => {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
};
const formatNumber = (value: number) => toNumber(value).toLocaleString("id-ID");

const rowsFromApi = (api: any): any[] => {
  const dataApi = api.rows({ search: "applied" }).data() as any;
  if (!dataApi) return [];
  if (typeof dataApi.toArray === "function") return dataApi.toArray();
  if (Array.isArray(dataApi)) return dataApi;
  try { return Array.from(dataApi); } catch { return []; }
};

const footerCell = (content: string, opts: { align?: "left" | "center" | "right"; colSpan?: number } = {}) => {
  const { align = "center", colSpan = 1 } = opts;
  const spanAttr = colSpan > 1 ? ` colspan="${colSpan}"` : "";
  return `<th${spanAttr} style="text-align:${align}; font-weight:600;">${content}</th>`;
};

const setDataTableFooter = (api: any, html: string) => {
  const tableNode = api.table().node() as HTMLElement;
  if (!tableNode) return;

  let tfoot = tableNode.querySelector("tfoot");
  if (!tfoot) {
    tfoot = document.createElement("tfoot");
    tableNode.appendChild(tfoot);
  }
  (tfoot as HTMLElement).innerHTML = html;

  const dtScrollFoot = tableNode.closest(".dt-scroll")?.querySelector(".dt-scroll-foot tfoot");
  if (dtScrollFoot) (dtScrollFoot as HTMLElement).innerHTML = html;

  const scrollFoot = tableNode.closest(".dataTables_scroll")?.querySelector(".dataTables_scrollFoot tfoot");
  if (scrollFoot) (scrollFoot as HTMLElement).innerHTML = html;
};

const pill = (text: string, tone: "neutral" | "good" | "bad" | "info" = "neutral") => {
  const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold";
  const map: Record<typeof tone, string> = {
    neutral: "border border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
    good: "border border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
    bad: "border border-red-400/30 bg-red-500/10 text-red-100",
    info: "border border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100",
  };
  return `<span class="${base} ${map[tone]}">${escapeHtml(text)}</span>`;
};

const pickRows = (j: any): BNBA[] => {
  if (Array.isArray(j?.rows)) return j.rows;
  if (Array.isArray(j?.data?.rows)) return j.data.rows;
  if (Array.isArray(j?.data)) return j.data;
  return [];
};

/* =========================================================
   Component
   ========================================================= */
export default function Page() {
  const { user } = useSession();

  // Tabs/Filters
  const [tab, setTab] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [mode, setMode] = useState<1 | 2 | 3>(1);
  const [status, setStatus] = useState<0 | 1 | 2>(0);
  const [namaSekolah, setNamaSekolah] = useState("0");
  const [noKec, setNoKec] = useState("0");
  const [noKel, setNoKel] = useState("0");

  const { meta, loading: metaPending, error: metaError } = useNotrecordMeta();
  const { options: sekolahMaster, loading: sekolahPending, error: sekolahError } = useSekolahOptions();

  const [kecOptions, setKecOptions] = useState<SelectOption[]>([]);
  const [kelOptions, setKelOptions] = useState<SelectOption[]>([{ value: "0", label: "-- Pilih Kelurahan --" }]);
  const [initialKelOptions, setInitialKelOptions] = useState<SelectOption[]>([{ value: "0", label: "-- Pilih Kelurahan --" }]);
  const [kelLoading, setKelLoading] = useState(false);
  const [metaApplied, setMetaApplied] = useState(false);
  const [loading, setLoading] = useState(false);

  // datasets
  const [bnba, setBnba] = useState<BNBA[]>([]);
  const [r2, setR2] = useState<WilDapodik[]>([]);
  const [r7, setR7] = useState<WilNon[]>([]);
  const [r3, setR3] = useState<LuarProv[]>([]);
  const [r4, setR4] = useState<DalamKec[]>([]);
  const [r5, setR5] = useState<SekDlm[]>([]);
  const [r6, setR6] = useState<SekLuar[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // ringkasan
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/check/notrecord/summary", { cache: "no-store", credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.success === false) throw new Error(json?.message || `HTTP ${res.status}`);

        const payload = json?.data ?? json ?? {};
        const pick = (key: string) => (Array.isArray(payload?.[key]) ? payload[key] : []);

        setR2(pick("r2"));
        setR7(pick("r7"));
        setR3(pick("r3"));
        setR4(pick("r4"));
        setR5(pick("r5"));
        setR6(pick("r6"));
      } catch (e: any) {
        setMsg(e?.message || "Gagal memuat ringkasan");
      }
    })();
  }, []);

  // apply meta defaults → options
  useEffect(() => {
    if (metaApplied || !meta) return;

    const normalize = (v: string) => (v || "0").replace(/\D/g, "") || "0";
    const defKec = normalize(meta.defaults.noKec);
    const defKel = normalize(meta.defaults.noKel);
    const allowAllKec = (meta.akses.aksesKecamatan ?? 0) > 0 || Number(defKec) === 0;
    const allowAllKel = (meta.akses.aksesKelurahan ?? 0) > 0 || Number(defKel) === 0;

    const mappedKec = (meta.wilayah.kecamatan || [])
      .map((x: any) => ({
        value: String(x.value ?? x.no_kec ?? x.NO_KEC ?? "").replace(/\D/g, "") || "0",
        label: String(x.label ?? x.nama_kec ?? x.NAMA_KEC ?? ""),
      }))
      .filter((x) => x.label.trim().length > 0);

    const mappedKel = (meta.wilayah.kelurahan || [])
      .map((x: any) => ({
        value: String(x.value ?? x.no_kel ?? x.NO_KEL ?? "").replace(/\D/g, "") || "0",
        label: String(x.label ?? x.nama_kel ?? x.NAMA_KEL ?? ""),
      }))
      .filter((x) => x.label.trim().length > 0);

    const finalKec = allowAllKec ? [{ value: "0", label: "-- Pilih Kecamatan --" }, ...mappedKec] : mappedKec;
    const finalKel = allowAllKel ? [{ value: "0", label: "-- Pilih Kelurahan --" }, ...mappedKel] : mappedKel;

    setKecOptions(finalKec);
    setKelOptions(finalKel.length ? finalKel : [{ value: "0", label: "-- Pilih Kelurahan --" }]);
    setInitialKelOptions(finalKel.length ? finalKel : [{ value: "0", label: "-- Pilih Kelurahan --" }]);
    setNoKec(defKec);
    setNoKel(defKel);
    setMetaApplied(true);
  }, [meta, metaApplied]);

  useEffect(() => { if (metaError) setMsg(metaError); }, [metaError]);
  useEffect(() => { if (sekolahError) setMsg(sekolahError); }, [sekolahError]);

  // load kelurahan saat kecamatan dipilih (cache-aware)
  async function loadKel(kec: string) {
    const sanitized = (kec || "0").replace(/\D/g, "") || "0";
    setNoKec(sanitized);
    setNoKel("0");

    if (!meta) {
      setKelOptions([{ value: "0", label: "-- Pilih Kelurahan --" }]);
      return;
    }

    const allowAllKel = (meta.akses.aksesKelurahan ?? 0) > 0 || Number((meta.defaults.noKel || "0").replace(/\D/g, "") || "0") === 0;

    if (sanitized === "0") {
      setKelOptions(initialKelOptions);
      if (!allowAllKel && initialKelOptions.length) {
        setNoKel(initialKelOptions[0].value);
      }
      return;
    }

    setKelLoading(true);
    try {
      const opts = await loadKelurahanOptions({
        noProp: (meta.defaults.noProp || "32").replace(/\D/g, "") || "32",
        noKab: (meta.defaults.noKab || "73").replace(/\D/g, "") || "73",
        noKec: sanitized,
      });
      const final = allowAllKel ? [{ value: "0", label: "-- Pilih Kelurahan --" }, ...opts] : opts;
      setKelOptions(final.length ? final : [{ value: "0", label: "-- Pilih Kelurahan --" }]);
      if (!allowAllKel && final.length) {
        setNoKel(final[0].value);
      }
    } catch (e: any) {
      setMsg(e?.message || "Gagal memuat kelurahan");
    } finally {
      setKelLoading(false);
    }
  }

  const showRowNonDapodik = mode === 2 || mode === 3;
  const showRowSekolah = mode === 1;

  const modeOptions = useMemo<SelectOption[]>(
    () => [
      { value: "1", label: "-- Data Dapodik - Sekolah --" },
      { value: "2", label: "-- Data Dapodik - Kewilayahan --" },
      { value: "3", label: "-- Data Non Dapodik - Kewilayahan --" },
    ],
    [],
  );

  const statusOptions = useMemo<SelectOption[]>(
    () => [
      { value: "0", label: "-- Pilih Status Rekam --" },
      { value: "1", label: "Belum Rekam" },
      { value: "2", label: "Sudah Rekam" },
    ],
    [],
  );

  const sekolahOptions = useMemo<SelectOption[]>(() => {
    if (!sekolahMaster?.length) return [{ value: "0", label: "-- Pilih Sekolah --" }];
    const uniq = new Map<string, string>();
    sekolahMaster.forEach((opt) => {
      const val = (opt.value || "").trim();
      if (!val) return;
      if (!uniq.has(val)) uniq.set(val, (opt.label || val).trim());
    });
    const arr = Array.from(uniq.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "id", { sensitivity: "base" }));
    return [{ value: "0", label: "-- Pilih Sekolah --" }, ...arr];
  }, [sekolahMaster]);

  const alasanOptions = useMemo<SelectOption[]>(
    () => [
      { value: "1", label: "1. MENINGGAL" },
      { value: "2", label: "2. GANDA DENGAN NIK BERBEDA" },
      { value: "3", label: "3. PINDAH DALAM KOTA" },
      { value: "4", label: "4. PINDAH LUAR KOTA" },
      { value: "5", label: "5. PINDAH TIDAK LAPOR" },
      { value: "6", label: "6. BERADA DI LUAR KOTA/NEGERI" },
      { value: "7", label: "7. DATA TERHAPUS DARI DATABASE SIAK" },
      { value: "8", label: "8. LAINNYA" },
    ],
    [],
  );

  // search
  async function doSearch() {
    setLoading(true);
    setMsg(null);
    try {
      const body: any = { mode, status };
      if (mode === 1) {
        body.nama_sekolah = namaSekolah;
      } else {
        if (noKec !== "0") body.no_kec = Number(noKec);
        if (noKel !== "0") body.no_kel = Number(noKel);
      }

      const res = await fetch("/api/check/notrecord/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = await res.json();

      if (!res.ok) throw new Error(j?.message || "Gagal mengambil data");

      const rows: BNBA[] = pickRows(j);
      setBnba(rows);

      const total = typeof j?.data?.total === "number" ? j.data.total : rows.length;
      if (total === 0) setMsg("Tidak ada data sesuai filter.");
    } catch (e: any) {
      setBnba([]);
      setMsg(e?.message || "Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  }

  function doClear() {
    setMsg(null);
    setNamaSekolah("0");
    if (meta) {
      const normalize = (v: string) => (v || "0").replace(/\D/g, "") || "0";
      const defKec = normalize(meta.defaults.noKec);
      const defKel = normalize(meta.defaults.noKel);
      setNoKec(defKec);
      setNoKel(defKel);
      setKelOptions(initialKelOptions);
    } else {
      setNoKec("0");
      setNoKel("0");
      setKelOptions([{ value: "0", label: "-- Pilih Kelurahan --" }]);
    }
    setBnba([]);
  }

  // ===== Modal Balikan =====
  const [showModal, setShowModal] = useState(false);
  const [mNik, setMNik] = useState("");
  const [mNama, setMNama] = useState("");
  const [mAlasan, setMAlasan] = useState("8");
  const [mKet, setMKet] = useState("");
  const [nikStatus, setNikStatus] = useState<0 | 1 | 2>(0);
  const [nikLoading, setNikLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  function openModal() {
    setShowModal(true);
    setMNik(""); setMNama(""); setMAlasan("8"); setMKet("");
    setNikStatus(0);
  }
  function closeModal() {
    setShowModal(false);
    setNikStatus(0);
    setNikLoading(false);
    setReportLoading(false);
    setMNik("");
    setMNama("");
    setMKet("");
    setMAlasan("8");
  }

  async function cekNik() {
    if (mNik.length !== 16) { alert("NIK wajib 16 digit"); return; }
    setNikLoading(true);
    try {
      const resp = await fetch("/api/check/notrecord/get-nik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nik: mNik }),
      });
      const data = await resp.json();
      setMNama(data?.nama || "");
      const statusNik: 0 | 1 | 2 = data?.is_exists === 1 ? 1 : data?.is_exists === 2 ? 2 : 0;
      setNikStatus(statusNik);
      if (statusNik === 0) {
        alert("NIK tidak terdaftar di Target Perekaman Pemula!");
      } else if (statusNik === 2) {
        alert("NIK sudah pernah di-entry; kirim ulang akan memperbarui catatan sebelumnya.");
      }
    } catch (e: any) {
      setNikStatus(0);
      alert(e?.message || "Gagal mengecek NIK");
    } finally {
      setNikLoading(false);
    }
  }

  async function kirimBalikan() {
    if (!mNik || mNik.length !== 16) { alert("NIK wajib 16 digit"); return; }
    if (!mKet || mKet.length < 10) { alert("Keterangan minimal 10 karakter"); return; }
    if (nikStatus === 0) { alert("Silakan validasi NIK terlebih dahulu."); return; }

    setReportLoading(true);
    try {
      const resp = await fetch("/api/check/notrecord/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nik: mNik, nama: mNama, alasan: Number(mAlasan), alasan_keterangan: mKet }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message || "Gagal menyimpan");

      if (data?.message_type === 1) {
        alert("Tersimpan");
        closeModal();
      } else {
        alert(data?.message || "Gagal menyimpan");
      }
    } catch (e: any) {
      alert(e?.message || "Gagal menyimpan");
    } finally {
      setReportLoading(false);
    }
  }

  // ringkasan kecil untuk header
  const totalDapodik = useMemo(() => r2.reduce((a, c) => a + c.TOTAL, 0), [r2]);
  const totalSudah = useMemo(() => r2.reduce((a, c) => a + c.SUDAH_REKAM, 0), [r2]);
  const persenSudah = totalDapodik ? Math.round((totalSudah / totalDapodik) * 1000) / 10 : 0;

  /* =========================================================
     UI
     ========================================================= */
  return (
    <div className="page-notrecord relative mt-5 space-y-8 px-4 pb-10 pt-6 text-gray-100 sm:px-6 md:px-8 md:pt-8">
      {/* glow kecil */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-[-15%] h-[1100px] w-[1100px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[18%] bottom-[-20%] h-[1000px] w-[1000px] rounded-full bg-fuchsia-600/12 blur-[190px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl overflow-hidden">
        {/* header */}
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
            <h1 className="text-base font-semibold tracking-wide text-cyan-200">
              Monitoring — Target Perekaman (NotRecord)
            </h1>
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
        </header>

        {/* Quick Stats */}
        <section className="grid gap-3 sm:grid-cols-3 p-4">
          <div className="rounded-xl border border-cyan-800/40 bg-[#0b0f1c]/60 p-4">
            <div className="flex items-center gap-2 text-cyan-200">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs">Total Dapodik (Kota)</span>
            </div>
            <div className="mt-2 text-2xl font-semibold text-cyan-100">{totalDapodik.toLocaleString("id-ID")}</div>
            <div className="mt-1 text-[11px] text-cyan-200/70">Sumber: Ringkasan /api/check/notrecord/summary</div>
          </div>

          <div className="rounded-xl border border-cyan-800/40 bg-[#0b0f1c]/60 p-4">
            <div className="flex items-center gap-2 text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs">Sudah Rekam</span>
            </div>
            <div className="mt-2 text-2xl font-semibold text-emerald-100">{totalSudah.toLocaleString("id-ID")}</div>
            <div className="mt-1 text-[11px] text-emerald-200/70">Kumulatif dari seluruh kecamatan (Dapodik)</div>
          </div>

          <div className="rounded-xl border border-cyan-800/40 bg-[#0b0f1c]/60 p-4">
            <div className="flex items-center gap-2 text-fuchsia-200">
              <MapPinned className="h-4 w-4" />
              <span className="text-xs">Progress Kota (%)</span>
            </div>
            <div className="mt-2 text-2xl font-semibold text-fuchsia-100">{persenSudah.toFixed(1)}%</div>
            <div className="mt-1 text-[11px] text-fuchsia-200/70">Akumulasi Dapodik dalam kota</div>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 p-4">
          {([
            [1, "BNBA", "Dataset individu; filter sesuai sekolah/kewilayahan"],
            [2, "Wilayah - Kota Bandung (Dapodik)", "Agregat Dapodik per kecamatan (dalam kota)"],
            [3, "Wilayah - Non Dapodik (Domisili Penduduk)", "Agregat non-Dapodik per kecamatan"],
            [4, "Wilayah - Dapodik (Dalam Kota)", "Dapodik dalam kota per kecamatan sekolah"],
            [5, "Wilayah - Dapodik (Luar Kota)", "Dapodik luar kota/provinsi"],
            [6, "Dapodik Sekolah - Dalam Kota", "Agregat per sekolah (dalam)"],
            [7, "Dapodik Sekolah - Luar Kota", "Agregat per sekolah (luar)"],
          ] as const).map(([id, label, hint]) => (
            <button
              key={id}
              onClick={() => setTab(id as any)}
              title={hint}
              className={`group rounded-xl border px-3 py-1.5 text-xs transition ${
                tab === id
                  ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-100 shadow-[0_0_12px_#22d3ee33]"
                  : "border-cyan-800/40 bg-[#0c1220]/70 text-cyan-200/80 hover:border-cyan-600/50 hover:bg-[#0c1220]/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ======= Filter Panel (BNBA) ======= */}
        {tab === 1 && (
          <section className="p-4">
            <div className="rounded-2xl border border-cyan-800/40 bg-[#0b0f1c]/60 p-4 md:p-5 shadow-[0_0_24px_#22d3ee22] space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span
                  dangerouslySetInnerHTML={{
                    __html: pill(mode === 1 ? "Dapodik - Sekolah" : mode === 2 ? "Dapodik - Wilayah" : "Non Dapodik - Wilayah", "info"),
                  }}
                />
                <span
                  dangerouslySetInnerHTML={{
                    __html: pill(status === 0 ? "Semua" : status === 1 ? "Belum Rekam" : "Sudah Rekam", status === 2 ? "good" : status === 1 ? "bad" : "neutral"),
                  }}
                />
                {mode !== 1 ? (
                  <>
                    {noKec !== "0" && <span dangerouslySetInnerHTML={{ __html: pill(`Kec: ${noKec}`, "neutral") }} />}
                    {noKel !== "0" && <span dangerouslySetInnerHTML={{ __html: pill(`Kel: ${noKel}`, "neutral") }} />}
                  </>
                ) : (
                  <>{namaSekolah !== "0" && <span dangerouslySetInnerHTML={{ __html: pill(`Sekolah: ${namaSekolah}`, "neutral") }} />}</>
                )}
                {bnba.length > 0 && <span dangerouslySetInnerHTML={{ __html: pill(`Rows: ${bnba.length.toLocaleString("id-ID")}`, "good") }} />}
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-cyan-200/80">Target Belum Rekam - Pilih Data</label>
                  <SelectFancy
                    value={String(mode)}
                    onValueChange={(val) => {
                      const num = Number(val || mode);
                      setMode((num === 2 ? 2 : num === 3 ? 3 : 1) as 1 | 2 | 3);
                    }}
                    options={modeOptions}
                    isDisabled={metaPending}
                    className="min-w-[220px]"
                    placeholder="-- Pilih data --"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-cyan-200/80">Status Perekaman</label>
                  <SelectFancy
                    value={String(status)}
                    onValueChange={(val) => {
                      const num = Number(val || status);
                      setStatus((num === 1 ? 1 : num === 2 ? 2 : 0) as 0 | 1 | 2);
                    }}
                    options={statusOptions}
                    className="min-w-[220px]"
                    placeholder="-- Pilih status --"
                  />
                </div>

                {showRowNonDapodik && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs text-cyan-200/80">Kecamatan</label>
                      <SelectFancy
                        value={noKec}
                        onValueChange={(val) => loadKel(val || "0")}
                        options={kecOptions}
                        isDisabled={metaPending}
                        className="min-w-[220px]"
                        placeholder="-- Pilih kecamatan --"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-cyan-200/80">Kelurahan</label>
                      <SelectFancy
                        value={noKel}
                        onValueChange={(val) => setNoKel(val || "0")}
                        options={kelOptions}
                        isDisabled={kelLoading || metaPending}
                        isLoading={kelLoading}
                        className="min-w-[220px]"
                        placeholder="-- Pilih kelurahan --"
                      />
                    </div>
                  </>
                )}

                {showRowSekolah && (
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs text-cyan-200/80">Nama Sekolah</label>
                    <SelectFancy
                      value={namaSekolah}
                      onValueChange={(val) => setNamaSekolah(val || "0")}
                      options={sekolahOptions}
                      isLoading={sekolahPending}
                      placeholder="-- Pilih sekolah --"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={doSearch}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {loading ? "Mencari..." : "Search"}
                </button>

                <button
                  onClick={doClear}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/25 bg-white/5 px-4 py-2 text-sm text-cyan-100/90 transition hover:bg-white/10"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear
                </button>

                <span className="ml-auto text-[0px]" role="status" aria-live="polite" />
                <button
                  onClick={openModal}
                  title="Input alasan/temuan lapangan untuk data target."
                  className="ml-auto inline-flex items-center gap-2 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20"
                >
                  <Info className="w-3.5 h-3.5" /> Input Data Balikan
                </button>
              </div>

              {msg ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100" role="status" aria-live="polite">
                  {msg}
                </div>
              ) : null}

              {/* Area data utama */}
              <DataShell loading={loading} hasData={bnba.length > 0}>
                <JQDataTable
                  id="dt-bnba"
                  data={bnba as any[]}
                  minWidth={1600}
                  pageLength={100}
                  columns={[
                    { data: (r: any) => r.NO_KEC, title: "No Kec", className: "dt-body-center", width: "90px" },
                    {
                      data: "NIK",
                      title: "NIK",
                      className: "dt-body-center",
                      width: "170px",
                      render: (v: any, t: any) =>
                        t === "display" ? `<span style="color:#fff">,</span>${String(v ?? "")}` : String(v ?? ""),
                    },
                    { data: "NAMA_LGKP", title: "Nama Lengkap", width: "220px" },
                    { data: "TGL_LHR", title: "Tanggal Lahir", className: "dt-body-center", width: "150px" },
                    { data: "UMUR", title: "Usia", className: "dt-body-center", width: "90px" },
                    { data: "WKTP", title: "WKTP", className: "dt-body-center", width: "150px" },
                    { data: "ALAMAT", title: "Alamat", width: "240px" },
                    { data: (r: any) => `${r.NO_RW}/${r.NO_RT}`, title: "RW/RT", className: "dt-body-center", width: "110px" },
                    { data: "NAMA_KEC", title: "Nama Kecamatan", width: "180px" },
                    { data: "NAMA_KEL", title: "Nama Kelurahan", width: "200px" },
                    { data: "NAMA_SEKOLAH", title: "Nama Sekolah", width: "220px" },
                    { data: "TGL_REKAM", title: "Tanggal Rekam", className: "dt-body-center", width: "140px" },
                    { data: "PETUGAS_REKAM", title: "Petugas Rekam", className: "dt-body-center", width: "150px" },
                    { data: "KET_REKAM", title: "Keterangan", className: "dt-body-center", width: "140px" },
                    { data: "CURRENT_STATUS_CODE", title: "Status", className: "dt-body-center", width: "120px" },
                    { data: "EXCUSE", title: "Alasan", className: "dt-body-center", width: "140px" },
                  ]}
                  options={createDtOptions(
                    {
                      order: [[9, "asc"], [7, "asc"]] as any,
                    },
                    { csv: BNBA_CSV_FORMATTER, excel: BNBA_XLSX_FORMATTER },
                  )}
                />
              </DataShell>
            </div>
          </section>
        )}

        {/* ======= Ringkasan tables ======= */}
        {tab === 2 && (
          <div className="p-4">
            <DataShell loading={loading} hasData={r2.length > 0}>
              <JQDataTable
                id="dt-r2"
                data={r2 as any[]}
                pageLength={100}
                columns={[
                  { data: "NO_KEC", title: "No Kec", className: "dt-body-center" },
                  { data: "KECAMATAN", title: "Kecamatan" },
                  { data: "SUDAH_REKAM", title: "Sudah Rekam", className: "dt-body-center" },
                  { data: "BELUM_REKAM", title: "Belum Rekam", className: "dt-body-center" },
                  { data: "TOTAL", title: "Total", className: "dt-body-center" },
                  { data: (r: any) => ((r.SUDAH_REKAM / (r.TOTAL || 1)) * 100).toFixed(2), title: "Persentase", className: "dt-body-center" },
                ]}
                options={createDtOptions({
                  footerCallback: function () {
                    const api = this.api();
                    const rows = rowsFromApi(api);
                    const totalSudah = rows.reduce((sum, row) => sum + toNumber(row?.SUDAH_REKAM), 0);
                    const totalBelum = rows.reduce((sum, row) => sum + toNumber(row?.BELUM_REKAM), 0);
                    const totalAll = rows.reduce((sum, row) => sum + toNumber(row?.TOTAL), 0);
                    const percent = totalAll > 0 ? (totalSudah / totalAll) * 100 : 0;

                    const html = `<tr>
                      ${footerCell("Jumlah", { colSpan: 2, align: "left" })}
                      ${footerCell(formatNumber(totalSudah), { align: "right" })}
                      ${footerCell(formatNumber(totalBelum), { align: "right" })}
                      ${footerCell(formatNumber(totalAll), { align: "right" })}
                      ${footerCell(`${percent.toFixed(2)}%`, { align: "right" })}
                    </tr>`;
                    setDataTableFooter(api, html);
                  },
                })}
              />
            </DataShell>
          </div>
        )}

        {tab === 3 && (
          <div className="p-4">
            <DataShell loading={loading} hasData={r7.length > 0}>
              <JQDataTable
                id="dt-r7"
                data={r7 as any[]}
                pageLength={100}
                columns={[
                  { data: "NO_KEC", title: "No Kec", className: "dt-body-center" },
                  { data: "KECAMATAN", title: "Kecamatan" },
                  { data: "SUDAH_REKAM", title: "Sudah Rekam", className: "dt-body-center" },
                  { data: "BELUM_REKAM", title: "Belum Rekam", className: "dt-body-center" },
                  { data: "TOTAL", title: "Total", className: "dt-body-center" },
                  { data: (r: any) => ((r.SUDAH_REKAM / (r.TOTAL || 1)) * 100).toFixed(2), title: "Persentase", className: "dt-body-center" },
                ]}
                options={createDtOptions({
                  footerCallback: function () {
                    const api = this.api();
                    const rows = rowsFromApi(api);
                    const totalSudah = rows.reduce((sum, row) => sum + toNumber(row?.SUDAH_REKAM), 0);
                    const totalBelum = rows.reduce((sum, row) => sum + toNumber(row?.BELUM_REKAM), 0);
                    const totalAll = rows.reduce((sum, row) => sum + toNumber(row?.TOTAL), 0);
                    const percent = totalAll > 0 ? (totalSudah / totalAll) * 100 : 0;

                    const html = `<tr>
                      ${footerCell("Jumlah", { colSpan: 2, align: "left" })}
                      ${footerCell(formatNumber(totalSudah), { align: "right" })}
                      ${footerCell(formatNumber(totalBelum), { align: "right" })}
                      ${footerCell(formatNumber(totalAll), { align: "right" })}
                      ${footerCell(`${percent.toFixed(2)}%`, { align: "right" })}
                    </tr>`;
                    setDataTableFooter(api, html);
                  },
                })}
              />
            </DataShell>
          </div>
        )}

        {tab === 4 && (
          <div className="p-4">
            <DataShell loading={loading} hasData={r4.length > 0}>
              <JQDataTable
                id="dt-r4"
                data={r4 as any[]}
                pageLength={100}
                columns={[
                  { data: "PROV_SEKOLAH", title: "Provinsi" },
                  { data: "KAB_SEKOLAH", title: "Kabupaten" },
                  { data: "KECAMATAN", title: "Kecamatan" },
                  { data: "SUDAH_REKAM", title: "Sudah Rekam", className: "dt-body-center" },
                  { data: "BELUM_REKAM", title: "Belum Rekam", className: "dt-body-center" },
                  { data: "TOTAL", title: "Total", className: "dt-body-center" },
                ]}
                options={createDtOptions({
                  footerCallback: function () {
                    const api = this.api();
                    const rows = rowsFromApi(api);
                    const totalSudah = rows.reduce((sum, row) => sum + toNumber(row?.SUDAH_REKAM), 0);
                    const totalBelum = rows.reduce((sum, row) => sum + toNumber(row?.BELUM_REKAM), 0);
                    const totalAll = rows.reduce((sum, row) => sum + toNumber(row?.TOTAL), 0);

                    const html = `<tr>
                      ${footerCell("Jumlah", { colSpan: 3, align: "left" })}
                      ${footerCell(formatNumber(totalSudah), { align: "right" })}
                      ${footerCell(formatNumber(totalBelum), { align: "right" })}
                      ${footerCell(formatNumber(totalAll), { align: "right" })}
                    </tr>`;
                    setDataTableFooter(api, html);
                  },
                })}
              />
            </DataShell>
          </div>
        )}

        {tab === 5 && (
          <div className="p-4">
            <DataShell loading={loading} hasData={r3.length > 0}>
              <JQDataTable
                id="dt-r3"
                data={r3 as any[]}
                pageLength={100}
                columns={[
                  { data: "PROV_SEKOLAH", title: "Provinsi" },
                  { data: "KAB_SEKOLAH", title: "Kabupaten" },
                  { data: "SUDAH_REKAM", title: "Sudah Rekam", className: "dt-body-center" },
                  { data: "BELUM_REKAM", title: "Belum Rekam", className: "dt-body-center" },
                  { data: "TOTAL", title: "Total", className: "dt-body-center" },
                ]}
                options={createDtOptions({
                  footerCallback: function () {
                    const api = this.api();
                    const rows = rowsFromApi(api);
                    const totalSudah = rows.reduce((sum, row) => sum + toNumber(row?.SUDAH_REKAM), 0);
                    const totalBelum = rows.reduce((sum, row) => sum + toNumber(row?.BELUM_REKAM), 0);
                    const totalAll = rows.reduce((sum, row) => sum + toNumber(row?.TOTAL), 0);

                    const html = `<tr>
                      ${footerCell("Jumlah", { colSpan: 2, align: "left" })}
                      ${footerCell(formatNumber(totalSudah), { align: "right" })}
                      ${footerCell(formatNumber(totalBelum), { align: "right" })}
                      ${footerCell(formatNumber(totalAll), { align: "right" })}
                    </tr>`;
                    setDataTableFooter(api, html);
                  },
                })}
              />
            </DataShell>
          </div>
        )}

        {tab === 6 && (
          <div className="p-4">
            <DataShell loading={loading} hasData={r5.length > 0}>
              <JQDataTable
                id="dt-r5"
                data={r5 as any[]}
                pageLength={100}
                columns={[
                  { data: "PROV_SEKOLAH", title: "Provinsi" },
                  { data: "KAB_SEKOLAH", title: "Kabupaten" },
                  { data: "KEC_SEKOLAH", title: "Kecamatan" },
                  { data: "NPSN", title: "NPSN", className: "dt-body-center" },
                  { data: "NAMA_SEKOLAH", title: "Nama Sekolah" },
                  { data: "SUDAH_REKAM", title: "Sudah Rekam", className: "dt-body-center" },
                  { data: "BELUM_REKAM", title: "Belum Rekam", className: "dt-body-center" },
                  { data: "TOTAL", title: "Total", className: "dt-body-center" },
                ]}
                options={createDtOptions({
                  footerCallback: function () {
                    const api = this.api();
                    const rows = rowsFromApi(api);
                    const totalSudah = rows.reduce((sum, row) => sum + toNumber(row?.SUDAH_REKAM), 0);
                    const totalBelum = rows.reduce((sum, row) => sum + toNumber(row?.BELUM_REKAM), 0);
                    const totalAll = rows.reduce((sum, row) => sum + toNumber(row?.TOTAL), 0);

                    const html = `<tr>
                      ${footerCell("Jumlah", { colSpan: 5, align: "left" })}
                      ${footerCell(formatNumber(totalSudah), { align: "right" })}
                      ${footerCell(formatNumber(totalBelum), { align: "right" })}
                      ${footerCell(formatNumber(totalAll), { align: "right" })}
                    </tr>`;
                    setDataTableFooter(api, html);
                  },
                })}
              />
            </DataShell>
          </div>
        )}

        {tab === 7 && (
          <div className="p-4">
            <DataShell loading={loading} hasData={r6.length > 0}>
              <JQDataTable
                id="dt-r6"
                data={r6 as any[]}
                pageLength={100}
                columns={[
                  { data: "PROV_SEKOLAH", title: "Provinsi" },
                  { data: "KAB_SEKOLAH", title: "Kabupaten" },
                  { data: "NPSN", title: "NPSN", className: "dt-body-center" },
                  { data: "NAMA_SEKOLAH", title: "Nama Sekolah" },
                  { data: "SUDAH_REKAM", title: "Sudah Rekam", className: "dt-body-center" },
                  { data: "BELUM_REKAM", title: "Belum Rekam", className: "dt-body-center" },
                  { data: "TOTAL", title: "Total", className: "dt-body-center" },
                ]}
                options={createDtOptions({
                  footerCallback: function () {
                    const api = this.api();
                    const rows = rowsFromApi(api);
                    const totalSudah = rows.reduce((sum, row) => sum + toNumber(row?.SUDAH_REKAM), 0);
                    const totalBelum = rows.reduce((sum, row) => sum + toNumber(row?.BELUM_REKAM), 0);
                    const totalAll = rows.reduce((sum, row) => sum + toNumber(row?.TOTAL), 0);

                    const html = `<tr>
                      ${footerCell("Jumlah", { colSpan: 4, align: "left" })}
                      ${footerCell(formatNumber(totalSudah), { align: "right" })}
                      ${footerCell(formatNumber(totalBelum), { align: "right" })}
                      ${footerCell(formatNumber(totalAll), { align: "right" })}
                    </tr>`;
                    setDataTableFooter(api, html);
                  },
                })}
              />
            </DataShell>
          </div>
        )}
      </section>

      {/* ======= Modal Balikan ======= */}
      {showModal && (
        <div className="fixed inset-0 z-[999] grid place-items-center bg-black/60">
          <div className="w-[560px] max-w-[92vw] rounded-2xl border border-cyan-800/40 bg-[#0b0f1a] shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
            <header className="flex items-center justify-between border-b border-cyan-900/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <School2 className="h-4 w-4 text-cyan-300" />
                <h3 className="text-cyan-100 font-semibold">Data Balikan Perekaman Pemula</h3>
              </div>
              <button onClick={closeModal} className="rounded-md px-2 py-1 text-cyan-200/80 hover:bg-white/5">X</button>
            </header>

            <div className="space-y-3 p-4">
              <div>
                <label className="mb-1 block text-xs text-cyan-200/80">NIK</label>
                <div className="flex gap-2">
                  <input
                    value={mNik}
                    onChange={(e) => setMNik(e.target.value.replace(/\D/g, "").slice(0, 16))}
                    maxLength={16}
                    inputMode="numeric"
                    className="flex-1 rounded-lg border border-cyan-800/40 bg-[#0c1220]/70 px-3 py-2 text-sm text-cyan-100 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  />
                  <button
                    onClick={cekNik}
                    disabled={nikLoading}
                    className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {nikLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cek"}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-cyan-200/80">Nama</label>
                <input value={mNama} readOnly className="w-full rounded-lg border border-cyan-800/40 bg-[#0c1220]/50 px-3 py-2 text-sm text-cyan-100" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-cyan-200/80">Alasan</label>
                  <SelectFancy
                    value={mAlasan}
                    onValueChange={(val) => setMAlasan(val || "8")}
                    options={alasanOptions}
                    placeholder="Pilih alasan"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-cyan-200/80">Keterangan (&gt;= 10 karakter)</label>
                  <input
                    value={mKet}
                    onChange={(e) => setMKet(e.target.value)}
                    maxLength={300}
                    className="w-full rounded-lg border border-cyan-800/40 bg-[#0c1220]/70 px-3 py-2 text-sm text-cyan-100 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  />
                </div>
              </div>
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-cyan-900/50 px-4 py-3">
              <button onClick={closeModal} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-cyan-100/80 hover:bg-white/5">
                Tutup
              </button>
              <button
                onClick={kirimBalikan}
                disabled={reportLoading || nikStatus === 0}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kirim"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
