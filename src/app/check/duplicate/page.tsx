"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, Calendar, Download, Loader2, RefreshCcw, Search, Trash2 } from "lucide-react";
import { useSession } from "@/contexts/session";
import SelectDark from "@/components/ui/SelectDark";

/* ======================== Types ======================== */

type WilayahOption = { value: string; label: string };

type FilterState = {
  nik: string;
  noKec: string;
  noKel: string;
  dateStart: string; // ISO: YYYY-MM-DD
  dateEnd: string;   // ISO: YYYY-MM-DD
};

type MetaState = {
  defaults: { noProp: string; noKab: string; noKec: string; noKel: string };
  akses: { aksesKecamatan: number; aksesKelurahan: number };
  wilayah: { kabupaten: WilayahOption[]; kecamatan: WilayahOption[]; kelurahan: WilayahOption[] };
  instructions: string[];
  exportBaseUrl: string | null;
};

type DuplicateMode = "nik" | "wilayah";

type DuplicateDetailRow = {
  nik: string;
  nama: string | null;
  alamat: string | null;
  statusKtp: string | null;
  tglRekam: string | null;
  wilayah: { prop: string | null; kab: string | null; kec: string | null; kel: string | null };
  nikSingle: string | null;
  namaSingle: string | null;
  alamatSingle: string | null;
  statusKtpSingle: string | null;
  tglRekamSingle: string | null;
  wilayahSingle: { prop: string | null; kab: string | null; kec: string | null; kel: string | null };
};

type DuplicateListRow = {
  nik: string;
  nikSingle: string | null;
  nama: string | null;
  tempatLahir: string | null;
  tanggalLahir: string | null;
  alamat: string | null;
  kecamatan: string | null;
  kelurahan: string | null;
  rw: string | null;
  rt: string | null;
  kodePos: string | null;
  agama: string | null;
  statusKawin: string | null;
  pekerjaan: string | null;
  tanggalRekam: string | null;
  statusKtp: string | null;
};

type MetaResponse = { success: boolean; data?: MetaState; message?: string };
type SearchResponse = {
  success: boolean;
  data?: { mode: DuplicateMode; total: number; rows: (DuplicateDetailRow | DuplicateListRow)[] };
  message?: string;
};

/* ======================== Helpers ======================== */

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function convertWilayahCode(raw: string | number | null | undefined) {
  const value = String(raw ?? "").trim();
  if (!value) return "0";
  const digits = value.replace(/[^\d]/g, "");
  if (!digits || digits === "0" || digits === "000") return "0";
  return String(Number(digits));
}

function sanitizeNikInput(value: string) {
  return value.replace(/[^\d,]/g, "");
}

function toDisplay(value: string | null | undefined, fallback = "-") {
  const text = (value ?? "").toString().trim();
  return text ? text : fallback;
}

function formatLeadingComma(value: string | null | undefined) {
  const clean = (value ?? "").trim();
  if (!/^\d+$/.test(clean)) return ""; // hanya untuk angka murni
  return `,${clean}`;
}

function mapWilayahOptions(options: Array<{ value: string | number; label: string }>) {
  return (options || [])
    .map((opt) => ({ value: convertWilayahCode(opt?.value), label: String(opt?.label ?? "").trim() }))
    .filter((o) => o.label);
}

/* ==== Date formatting helpers (DD-MM-YYYY <-> ISO) ==== */

function maskToDDMMYYYY(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  return [dd, mm, yyyy].filter(Boolean).join("-");
}

function isValidDDMMYYYY(text: string) {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(text)) return false;
  const [d, m, y] = text.split("-").map(Number);
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function ddmmyyyyToISO(text: string) {
  const [d, m, y] = text.split("-");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function isoToDDMMYYYY(iso: string) {
  const m = iso?.match?.(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/* ======================== DatePickerInput ======================== */
/** Teks bertopeng DD-MM-YYYY + tombol yang memanggil native date picker.
 *  Tidak ada overlay input tanggal transparan yang menutupi komponen.
 */
type DatePickerInputProps = {
  id?: string;
  value: string; // ISO (YYYY-MM-DD) atau "" (kosong)
  onChange: (value: string) => void;
  disabled?: boolean;
};

function DatePickerInput({ id, value, onChange, disabled }: DatePickerInputProps) {
  const nativeRef = useRef<HTMLInputElement | null>(null);
  const [text, setText] = useState<string>(() => isoToDDMMYYYY(value));

  useEffect(() => {
    setText(isoToDDMMYYYY(value));
  }, [value]);

  function commit() {
    const masked = maskToDDMMYYYY(text);
    setText(masked);
    if (!masked) {
      onChange("");
      return;
    }
    if (isValidDDMMYYYY(masked)) {
      onChange(ddmmyyyyToISO(masked));
    }
  }

  function openPicker() {
    if (disabled) return;
    const el = nativeRef.current as HTMLInputElement & { showPicker?: () => void };
    el?.showPicker?.();
  }

  function onNativeChange(e: ChangeEvent<HTMLInputElement>) {
    const nextISO = e.target.value || "";
    onChange(nextISO);
  }

  return (
    <div className="relative w-full">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={text}
        placeholder="DD-MM-YYYY"
        onChange={(e) => setText(maskToDDMMYYYY(e.target.value))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        disabled={disabled}
        className="w-full rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 pr-10 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
      />

      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-cyan-700/50 bg-cyan-500/10 text-cyan-100/80 transition hover:bg-cyan-500/20 focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Calendar className="h-4 w-4" />
      </button>

      {/* Native picker disembunyikan kecil, tidak menutupi UI */}
      <input
        ref={nativeRef}
        type="date"
        value={value || ""}
        onChange={onNativeChange}
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
      />
    </div>
  );
}

/* ======================== Page ======================== */

export default function DuplicatePage() {
  const { user } = useSession();

  const [meta, setMeta] = useState<MetaState | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    nik: "",
    noKec: "0",
    noKel: "0",
    dateStart: formatDateInput(new Date()),
    dateEnd: formatDateInput(new Date()),
  });

  const [kecamatanOptions, setKecamatanOptions] = useState<WilayahOption[]>([]);
  const [kelurahanCache, setKelurahanCache] = useState<Record<string, WilayahOption[]>>({});
  const [kelurahanLoadingKey, setKelurahanLoadingKey] = useState<string | null>(null);

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [resultMode, setResultMode] = useState<DuplicateMode>("wilayah");
  const [detailRows, setDetailRows] = useState<DuplicateDetailRow[]>([]);
  const [listRows, setListRows] = useState<DuplicateListRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  /* ---- load meta ---- */
  useEffect(() => {
    let cancelled = false;

    async function loadMeta() {
      setMetaLoading(true);
      setMetaError(null);
      try {
        const res = await fetch("/api/check/duplicate/meta", { cache: "no-store", credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload: MetaResponse = await res.json();
        if (!payload.success || !payload.data) throw new Error(payload.message || "Metadata tidak valid");
        if (cancelled) return;

        const data = payload.data;
        setMeta(data);

        const defaultNoKec = convertWilayahCode(data?.defaults?.noKec ?? "0");
        const defaultNoKel = convertWilayahCode(data?.defaults?.noKel ?? "0");
        const today = formatDateInput(new Date());

        setFilters({
          nik: "",
          noKec: defaultNoKec,
          noKel: defaultNoKel,
          dateStart: today,
          dateEnd: today,
        });

        const mappedKec = mapWilayahOptions(data?.wilayah?.kecamatan ?? []);
        setKecamatanOptions(mappedKec);

        if (defaultNoKec !== "0" && (data?.wilayah?.kelurahan?.length ?? 0) > 0) {
          setKelurahanCache({ [defaultNoKec]: mapWilayahOptions(data.wilayah.kelurahan ?? []) });
        }
      } catch (err: any) {
        if (!cancelled) setMetaError(err?.message || "Gagal memuat metadata duplicate");
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- ensure kecamatan options via API ---- */
  useEffect(() => {
    if (!meta) return;
    if (kecamatanOptions.length > 0) return;

    const noProp = (meta?.defaults?.noProp ?? "").trim();
    const noKab = (meta?.defaults?.noKab ?? "").trim();
    let cancelled = false;

    async function ensureKecamatanOptions() {
      try {
        const haveParams = !!(noProp && noKab);
        const url = haveParams
          ? `/api/check/ktpel/kecamatan?${new URLSearchParams({ no_prop: noProp, no_kab: noKab }).toString()}`
          : `/api/check/ktpel/kecamatan`;

        const res = await fetch(url, { cache: "no-store", credentials: "include" });
        if (!res.ok) return;

        const json = await res.json();
        if (cancelled) return;

        const arr = json?.data?.kecamatan ?? json?.kecamatan ?? [];
        const list = mapWilayahOptions(arr);
        if (list.length) setKecamatanOptions(list);
      } catch (err) {
        console.error("Gagal memuat kecamatan:", err);
      }
    }

    ensureKecamatanOptions();
    return () => {
      cancelled = true;
    };
  }, [meta, kecamatanOptions.length]);

  /* ---- memoized options ---- */
  const currentKelurahanOptions = useMemo(() => {
    const key = filters.noKec;
    return kelurahanCache[key] ?? [];
  }, [filters.noKec, kelurahanCache]);

  const allowSelectKecamatan = useMemo(() => {
    if (!meta) return true;
    const defaultNoKec = convertWilayahCode(meta?.defaults?.noKec ?? "0");
    return defaultNoKec === "0" || (meta?.akses?.aksesKecamatan ?? 0) > 0;
  }, [meta]);

  const allowSelectKelurahan = useMemo(() => {
    if (!meta) return true;
    const defaultNoKel = convertWilayahCode(meta?.defaults?.noKel ?? "0");
    return defaultNoKel === "0" || (meta?.akses?.aksesKelurahan ?? 0) > 0;
  }, [meta]);

  function updateFilter(patch: Partial<FilterState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  async function handleKecamatanChange(value: string) {
    updateFilter({ noKec: value, noKel: "0" });
    if (value === "0") return;
    if (kelurahanCache[value]) return;
    if (!meta) return;

    setKelurahanLoadingKey(value);
    try {
      const params = new URLSearchParams({
        no_prop: meta?.defaults?.noProp ?? "",
        no_kab: meta?.defaults?.noKab ?? "",
        no_kec: value,
      });
      const res = await fetch(`/api/check/ktpel/kelurahan?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list: WilayahOption[] = mapWilayahOptions(json?.data?.kelurahan ?? json?.kelurahan ?? []);
      setKelurahanCache((prev) => ({ ...prev, [value]: list }));
    } catch (error) {
      console.error("Gagal memuat kelurahan:", error);
    } finally {
      setKelurahanLoadingKey(null);
    }
  }

  function handleClear() {
    if (!meta) {
      setFilters((prev) => ({
        ...prev,
        nik: "",
        noKec: "0",
        noKel: "0",
        dateStart: formatDateInput(new Date()),
        dateEnd: formatDateInput(new Date()),
      }));
      return;
    }
    const today = formatDateInput(new Date());
    setFilters({
      nik: "",
      noKec: convertWilayahCode(meta?.defaults?.noKec ?? "0"),
      noKel: convertWilayahCode(meta?.defaults?.noKel ?? "0"),
      dateStart: today,
      dateEnd: today,
    });
    setDetailRows([]);
    setListRows([]);
    setTotalRows(0);
    setResultMode("wilayah");
    setSearchError(null);
  }

  /* ---- Search ---- */
  async function handleSearch() {
    setSearchError(null);
    setSearchLoading(true);

    const payload: Record<string, any> = {};
    const nikValue = filters.nik.trim();
    if (nikValue) payload.nik = nikValue;
    if (filters.noKec !== "0") payload.noKec = filters.noKec;
    if (filters.noKel !== "0") payload.noKel = filters.noKel;
    if (filters.dateStart) payload.dateStart = filters.dateStart;
    if (filters.dateEnd) payload.dateEnd = filters.dateEnd;

    try {
      const res = await fetch("/api/check/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const json: SearchResponse | any = await res.json();
      const core = json?.data?.data ?? json?.data;

      if (!res.ok || !json?.success || !core) {
        throw new Error(json?.message || `HTTP ${res.status}`);
      }

      const mode: DuplicateMode = core.mode === "nik" ? "nik" : "wilayah";
      const rows = Array.isArray(core.rows) ? core.rows : [];
      const total = Number(core.total ?? rows.length) || 0;

      setResultMode(mode);
      setTotalRows(total);

      if (mode === "nik") {
        setDetailRows(rows as DuplicateDetailRow[]);
        setListRows([]);
      } else {
        setListRows(rows as DuplicateListRow[]);
        setDetailRows([]);
      }
    } catch (error: any) {
      console.error("Error handleSearch:", error);
      setSearchError(error?.message || "Gagal memuat data duplicate");
      setDetailRows([]);
      setListRows([]);
      setTotalRows(0);
    } finally {
      setSearchLoading(false);
    }
  }

  /* ======================== CSV ======================== */

  function handleExportCsv() {
    if (totalRows === 0) return;

    if (resultMode === "nik") {
      const headers = [
        "NIK_DUPLICATE",
        "NAMA_DUPLICATE",
        "ALAMAT_DUPLICATE",
        "STATUS_KTP_DUPLICATE",
        "TGL_REKAM_DUPLICATE",
        "WILAYAH_DUPLICATE",
        "NIK_SINGLE",
        "NAMA_SINGLE",
        "ALAMAT_SINGLE",
        "STATUS_KTP_SINGLE",
        "TGL_REKAM_SINGLE",
        "WILAYAH_SINGLE",
      ];

      const rows = detailRows.map((row) => {
        const dupNik = formatLeadingComma(row.nik);
        const singleNik = formatLeadingComma(row.nikSingle);
        const wilayahDup = [row.wilayah.prop, row.wilayah.kab, row.wilayah.kec, row.wilayah.kel].filter(Boolean).join(" / ");
        const wilayahSingle = [row.wilayahSingle.prop, row.wilayahSingle.kab, row.wilayahSingle.kec, row.wilayahSingle.kel]
          .filter(Boolean)
          .join(" / ");
        return [
          dupNik,
          row.nama ?? "",
          row.alamat ?? "",
          row.statusKtp ?? "",
          row.tglRekam ?? "",
          wilayahDup,
          singleNik,
          row.namaSingle ?? "",
          row.alamatSingle ?? "",
          row.statusKtpSingle ?? "",
          row.tglRekamSingle ?? "",
          wilayahSingle,
        ];
      });
      downloadCsv([headers, ...rows], "duplicate-detail");
    } else {
      const headers = [
        "NIK_DUPLICATE",
        "NIK_SINGLE",
        "NAMA_DUPLICATE",
        "TEMPAT_LAHIR",
        "TANGGAL_LAHIR",
        "ALAMAT",
        "RT",
        "RW",
        "KODE_POS",
        "AGAMA",
        "STATUS_KAWIN",
        "PEKERJAAN",
        "TGL_REKAM",
        "STATUS_KTP",
        "KECAMATAN",
        "KELURAHAN",
      ];

      const rows = listRows.map((row) => [
        formatLeadingComma(row.nik),
        formatLeadingComma(row.nikSingle),
        row.nama ?? "",
        row.tempatLahir ?? "",
        row.tanggalLahir ?? "",
        row.alamat ?? "",
        row.rt ?? "",
        row.rw ?? "",
        row.kodePos ?? "",
        row.agama ?? "",
        row.statusKawin ?? "",
        row.pekerjaan ?? "",
        row.tanggalRekam ?? "",
        row.statusKtp ?? "",
        row.kecamatan ?? "",
        row.kelurahan ?? "",
      ]);
      downloadCsv([headers, ...rows], "duplicate-wilayah");
    }
  }

  function downloadCsv(lines: Array<string[]>, prefix: string) {
    const csv = lines
      .map((line) =>
        line
          .map((value) => {
            const val = value ?? "";
            if (typeof val === "number") return val;
            const text = String(val).replace(/"/g, '""');
            return `"${text}"`;
          })
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /* ======================== Render ======================== */

  function renderFilters() {
    if (!meta) return null;

    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70">NIK Duplicate</label>
            <input
              value={filters.nik}
              onChange={(e) => updateFilter({ nik: sanitizeNikInput(e.target.value) })}
              className="w-full rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
              placeholder="3273..., boleh banyak dengan koma"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="select-kecamatan"
              className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70"
            >
              Kecamatan
            </label>
            <SelectDark
              id="select-kecamatan"
              value={filters.noKec}
              onChange={(e) => handleKecamatanChange(e.target.value)}
              disabled={metaLoading || !allowSelectKecamatan}
            >
              <option value="0">-- Pilih Kecamatan --</option>
              {kecamatanOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </SelectDark>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="select-kelurahan"
              className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70"
            >
              Kelurahan
            </label>
            <SelectDark
              id="select-kelurahan"
              value={filters.noKel}
              onChange={(e) => updateFilter({ noKel: e.target.value })}
              disabled={
                filters.noKec === "0" ||
                kelurahanLoadingKey === filters.noKec ||
                !allowSelectKelurahan
              }
            >
              <option value="0">-- Pilih Kelurahan --</option>
              {currentKelurahanOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </SelectDark>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
              Rentang Tanggal Rekam
            </label>

            <div className="grid grid-cols-2 gap-2">
              <DatePickerInput
                value={filters.dateStart}
                onChange={(next) => updateFilter({ dateStart: next })}
              />
              <DatePickerInput
                value={filters.dateEnd}
                onChange={(next) => updateFilter({ dateEnd: next })}
              />
            </div>

            <p className="kdp-hint text-[11px] text-cyan-200/70">
              Ketik angka saja, sistem memformat ke <b>DD-MM-YYYY</b>. Tekan <b>Enter</b> untuk mencari.
              Bisa juga pakai ikon kalender.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Panduan ---------- */
  function renderInstructions() {
    if (!meta?.instructions?.length) return null;
    return (
      <div className="rounded-2xl border border-cyan-800/40 bg-black/20 p-4 text-sm text-cyan-100/80">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">Panduan</h3>
        <ol className="space-y-2 text-sm">
          {meta.instructions.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-600/50 bg-cyan-500/10 text-[11px] font-semibold text-cyan-200">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  /* ---------- Tabel Hasil ---------- */
  function renderResultTable() {
    if (searchLoading && totalRows === 0) {
      return (
        <div className="flex items-center justify-center rounded-xl border border-cyan-800/40 bg-black/30 py-12">
          <div className="flex items-center gap-3 text-sm text-cyan-100/80">
            <Loader2 className="h-5 w-5 animate-spin" />
            Mengambil data duplicate...
          </div>
        </div>
      );
    }

    if (searchError) {
      return (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-6 text-sm text-red-100">
          {searchError}
        </div>
      );
    }

    if (totalRows === 0) {
      return <div className="ktpel-empty-state">Belum ada data yang ditampilkan.</div>;
    }

    if (resultMode === "nik") {
      return (
        <div className="overflow-hidden rounded-xl border border-cyan-800/40 bg-black/30">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-cyan-800/60 text-sm text-cyan-100/90">
              <thead className="bg-cyan-500/10 text-xs uppercase tracking-wide text-cyan-200">
                <tr>
                  <th className="px-3 py-3 text-center">No</th>
                  <th className="px-3 py-3 text-left">NIK Duplicate</th>
                  <th className="px-3 py-3 text-left">Nama Duplicate</th>
                  <th className="px-3 py-3 text-left">Status Duplicate</th>
                  <th className="px-3 py-3 text-left">Tgl Rekam Dub.</th>
                  <th className="px-3 py-3 text-left">Wilayah Duplicate</th>
                  <th className="px-3 py-3 text-left">NIK Single</th>
                  <th className="px-3 py-3 text-left">Nama Single</th>
                  <th className="px-3 py-3 text-left">Status Single</th>
                  <th className="px-3 py-3 text-left">Tgl Rekam Sing.</th>
                  <th className="px-3 py-3 text-left">Wilayah Single</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-900/60">
                {detailRows.map((row, index) => {
                  const nikCom = formatLeadingComma(row.nik);
                  const singleCom = formatLeadingComma(row.nikSingle);
                  const wilayahDup = [row.wilayah.prop, row.wilayah.kab, row.wilayah.kec, row.wilayah.kel]
                    .filter(Boolean)
                    .join(" / ");
                  const wilayahSingle = [
                    row.wilayahSingle.prop,
                    row.wilayahSingle.kab,
                    row.wilayahSingle.kec,
                    row.wilayahSingle.kel,
                  ]
                    .filter(Boolean)
                    .join(" / ");
                  return (
                    <tr key={`${row.nik}-${row.nikSingle}-${index}`} className="transition hover:bg-cyan-500/10">
                      <td className="px-3 py-3 text-center text-xs font-medium text-cyan-100/70">{index + 1}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-cyan-50">
                        <span className="ktpel-soft-leading-comma">{nikCom.slice(0, 1)}</span>
                        <span>{nikCom.slice(1) || "-"}</span>
                        <div className="text-xs text-cyan-200/60">{toDisplay(row.alamat)}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-cyan-100/80">{toDisplay(row.nama)}</td>
                      <td className="px-3 py-3 text-xs text-cyan-100/80">{toDisplay(row.statusKtp)}</td>
                      <td className="px-3 py-3 text-xs text-cyan-100/80">{toDisplay(row.tglRekam)}</td>
                      <td className="px-3 py-3 text-xs text-cyan-100/70">{wilayahDup || "-"}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-emerald-200">
                        <span className="ktpel-soft-leading-comma">{singleCom.slice(0, 1)}</span>
                        <span>{singleCom.slice(1) || "-"}</span>
                        <div className="text-xs text-cyan-200/60">{toDisplay(row.alamatSingle)}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-cyan-100/80">{toDisplay(row.namaSingle)}</td>
                      <td className="px-3 py-3 text-xs text-cyan-100/80">{toDisplay(row.statusKtpSingle)}</td>
                      <td className="px-3 py-3 text-xs text-cyan-100/80">{toDisplay(row.tglRekamSingle)}</td>
                      <td className="px-3 py-3 text-xs text-cyan-100/70">{wilayahSingle || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    /* --- mode: daftar wilayah --- */
    return (
      <div className="overflow-hidden rounded-xl border border-cyan-800/40 bg-black/30">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-cyan-800/60 text-sm text-cyan-100/90">
            <thead className="bg-cyan-500/10 text-xs uppercase tracking-wide text-cyan-200">
              <tr>
                <th className="px-3 py-3 text-center">No</th>
                <th className="px-3 py-3 text-left">NIK Duplicate</th>
                <th className="px-3 py-3 text-left">NIK Single</th>
                <th className="px-3 py-3 text-left">Nama</th>
                <th className="px-3 py-3 text-left">Alamat</th>
                <th className="px-3 py-3 text-left">RT / RW</th>
                <th className="px-3 py-3 text-left">Kode Pos</th>
                <th className="px-3 py-3 text-left">Status KTP</th>
                <th className="px-3 py-3 text-left">Tgl Rekam</th>
                <th className="px-3 py-3 text-left">Kecamatan</th>
                <th className="px-3 py-3 text-left">Kelurahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-900/60">
              {listRows.map((row, index) => {
                const nikCom = formatLeadingComma(row.nik);
                const singleCom = formatLeadingComma(row.nikSingle);
                return (
                  <tr key={`${row.nik}-${index}`} className="transition hover:bg-cyan-500/10">
                    <td className="px-3 py-3 text-center text-xs font-medium text-cyan-100/70">{index + 1}</td>
                    <td className="px-3 py-3 text-sm font-semibold text-cyan-50">
                      <span className="ktpel-soft-leading-comma">{nikCom.slice(0, 1)}</span>
                      <span>{nikCom.slice(1) || "-"}</span>
                      <div className="text-xs text-cyan-200/60">{toDisplay(row.nama)}</div>
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-emerald-200">
                      <span className="ktpel-soft-leading-comma">{singleCom.slice(0, 1)}</span>
                      <span>{singleCom.slice(1) || "-"}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-cyan-100/80">
                      <div>{toDisplay(row.tempatLahir)}</div>
                      <div>{toDisplay(row.tanggalLahir)}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-cyan-100/80">{toDisplay(row.alamat)}</td>
                    <td className="px-3 py-3 text-xs text-cyan-100/80">
                      RT {toDisplay(row.rt)} / RW {toDisplay(row.rw)}
                    </td>
                    <td className="px-3 py-3 text-xs text-cyan-100/80">{toDisplay(row.kodePos)}</td>
                    <td className="px-3 py-3 text-xs text-cyan-100/80">{toDisplay(row.statusKtp)}</td>
                    <td className="px-3 py-3 text-xs text-cyan-100/80">{toDisplay(row.tanggalRekam)}</td>
                    <td className="px-3 py-3 text-xs text-cyan-100/80">{toDisplay(row.kecamatan)}</td>
                    <td className="px-3 py-3 text-xs text-cyan-100/80">{toDisplay(row.kelurahan)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ---------- Return (dibungkus FORM agar Enter memicu Search) ---------- */
  return (
    <div className="relative mt-5 space-y-8 px-4 pb-10 pt-6 text-gray-100 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-[-15%] h-[1100px] w-[1100px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[18%] bottom-[-20%] h-[1000px] w-[1000px] rounded-full bg-fuchsia-600/12 blur-[190px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        <header className="flex flex-col gap-3 border-b border-cyan-900/40 px-6 py-5 md:flex-row md:items-center">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-500">
              Check Duplicate KTP-el
            </span>
            <h1 className="text-lg font-semibold text-cyan-100 md:text-xl">Monitoring Duplicate NIK</h1>
          </div>
          <div className="md:ml-auto">
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100/80">
                User: {user?.S_NAMA_LGKP ?? user?.S_USER_ID ?? "-"}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (metaLoading) return;
                  window.location.reload();
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <RefreshCcw className={`h-4 w-4 ${metaLoading ? "animate-spin" : ""}`} />
                Refresh Meta
              </button>
            </div>
          </div>
        </header>

        {/* FORM: Enter di input mana pun akan submit -> handleSearch */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!searchLoading) handleSearch();
          }}
          className="space-y-8 p-6"
          noValidate
        >
          {renderFilters()}

          {metaError ? (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              <AlertTriangle className="h-4 w-4" />
              {metaError}
            </div>
          ) : null}

          {renderInstructions()}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-white/5 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-white/10"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>

            {/* type="submit" agar Enter memicu tombol ini */}
            <button
              type="submit"
              disabled={searchLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={totalRows === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <div className="text-xs text-cyan-200/70">
              Mode:{" "}
              <span className="font-semibold text-cyan-100">
                {resultMode === "nik" ? "Detail NIK Duplicate" : "Daftar Duplicate Per Wilayah"}
              </span>
              {totalRows > 0 ? (
                <>
                  {" "} | Menampilkan <span className="font-semibold text-cyan-100">{totalRows}</span> data
                </>
              ) : null}
            </div>
          </div>

          {renderResultTable()}
        </form>
      </section>
    </div>
  );
}

