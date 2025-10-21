"use client";

import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent, ClipboardEvent } from "react";
import { AlertTriangle, Download, ExternalLink, Loader2, RefreshCcw, Search, Trash2 } from "lucide-react";
import { useSession } from "@/contexts/session";

type Mode = "rekam" | "hist" | "wktp";

type FilterState = {
  noKec: string;
  noKel: string;
  nik: string;
  noKk: string;
  nama: string;
  tglLhr: string;
  noRw: string;
  noRt: string;
};

type WilayahOption = { value: string; label: string };

type MetaState = {
  akses: { aksesKecamatan: number; aksesKelurahan: number };
  defaults: { noProp: string; noKab: string; noKec: string; noKel: string };
  wilayah: { kecamatan: WilayahOption[]; kelurahan: WilayahOption[] };
  statuses: { pushable: string[]; pushPrimary: string[]; pushRetry: string[] };
  photoBase: string | null;
  legacyPushBase: string | null;
  legacyHistoryBase: string | null;
};

type KtpelRow = {
  source: Mode;
  nik: string;
  noKk: string | null;
  nama: string | null;
  tempatLahir: string | null;
  tanggalLahir: string | null;
  jenisKelamin: string | null;
  alamat: string | null;
  rt: string | null;
  rw: string | null;
  kodePos: string | null;
  jumlahCetak: number;
  namaKecamatan: string | null;
  namaKelurahan: string | null;
  agama: string | null;
  pekerjaan: string | null;
  statusKawin: string | null;
  currentStatus: string | null;
  distribusiTanggal: string | null;
  distribusiOleh: string | null;
  ktpTanggal: string | null;
  ktpOleh: string | null;
  fotoPath: string | null;
  pengajuanTanggal: string | null;
  pengajuanOleh: string | null;
  pengajuanDiprosesOleh: string | null;
  pengajuanStatus: string | null;
  keterangan?: string | null;
  sumberStatus?: string | null;
  wilayahProp?: string | null;
  wilayahKab?: string | null;
  wktp: boolean;
  pushEligible: boolean;
};

type SearchResponse = {
  success: boolean;
  data?: { rows: KtpelRow[]; total: number; mode: Mode };
  message?: string;
};

type MetaResponse = {
  success: boolean;
  data?: MetaState;
  message?: string;
};

const MODE_LABEL: Record<Mode, string> = {
  rekam: "Cek Ktp-el",
  hist: "Cek Hist Biodata Master",
  wktp: "Cek Nik Belum Rekam",
};

function createInitialFilter(): FilterState {
  return {
    noKec: "0",
    noKel: "0",
    nik: "",
    noKk: "",
    nama: "",
    tglLhr: "",
    noRw: "",
    noRt: "",
  };
}

function toDisplay(value: string | null | undefined, fallback = "-") {
  const text = (value ?? "").toString().trim();
  return text ? text : fallback;
}

function toDateInput(value: string) {
  if (!value) return "";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  if (parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return value;
}

function toApiDate(value: string) {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}-${m}-${y}`;
  }
  return value;
}

function sanitizeNikInput(value: string) {
  return value.replace(/[^\d,]/g, "");
}

function sanitizeTextInput(value: string) {
  return value.replace(/[\`~!@#$^&*()_|+\-=?;:'",.<>\\{}\[\]\//]/g, "").toUpperCase();
}

function sanitizeNumber(value: string) {
  return value.replace(/[^\d]/g, "");
}

function buildLegacyUrl(base: string | null, nik: string) {
  if (!base) return null;
  return `${base}?nik=${encodeURIComponent(nik)}`;
}

function formatLeadingComma(value: string | null | undefined) {
  // Always prefix sensitive IDs with a soft comma so Excel keeps leading zeros.
  const clean = (value ?? "").toString().trim();
  return clean ? `,${clean}` : "";
}

function convertWilayahCode(raw: string | null | undefined) {
  const val = (raw ?? "").trim();
  if (!val) return "0";
  const digits = val.replace(/[^\d]/g, "");
  if (!digits || digits === "0" || digits === "000") return "0";
  const normalized = Number(digits);
  return Number.isNaN(normalized) ? digits : String(normalized);
}

function formatStatusLabel(status: string | null | undefined) {
  const value = (status ?? "").trim();
  if (!value) return "-";
  switch (value.toUpperCase()) {
    case "MASIH DALAM PROSES":
      return "Masih Dalam Proses";
    case "SUDAH TERCETAK":
      return "Sudah Tercetak";
    case "PENGAJUAN DITOLAK":
      return "Pengajuan Ditolak";
    default:
      return value;
  }
}

function mergeOptions(options: WilayahOption[], includeDefault: boolean, defaultLabel: string) {
  const merged: WilayahOption[] = [];
  const seen = new Set<string>();
  if (includeDefault) {
    merged.push({ value: "0", label: defaultLabel });
    seen.add("0");
  }
  for (const opt of options) {
    const value = (opt.value ?? "").trim() || "0";
    if (!seen.has(value)) {
      merged.push({ value, label: opt.label });
      seen.add(value);
    }
  }
  return merged;
}

function handleNumberKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  allowComma = false
) {
  const { key, ctrlKey, metaKey } = event;
  if (ctrlKey || metaKey) return;
  const navigationKeys = [
    "Backspace",
    "Delete",
    "Tab",
    "Enter",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
  ];
  if (navigationKeys.includes(key)) return;
  if (allowComma && key === ",") return;
  if (/^\d$/.test(key)) return;
  event.preventDefault();
}

function handleNumericPaste(
  event: ClipboardEvent<HTMLInputElement>,
  allowComma: boolean,
  setter: (value: string) => void
) {
  const clipboard = event.clipboardData?.getData("text") ?? "";
  const sanitized = allowComma ? sanitizeNikInput(clipboard) : sanitizeNumber(clipboard);
  const input = event.currentTarget;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const newValue = input.value.slice(0, start) + sanitized + input.value.slice(end);
  event.preventDefault();
  setter(newValue);
  queueMicrotask(() => {
    const caret = start + sanitized.length;
    input.setSelectionRange(caret, caret);
  });
}

function handleNamePaste(
  event: ClipboardEvent<HTMLInputElement>,
  setter: (value: string) => void
) {
  const clipboard = event.clipboardData?.getData("text") ?? "";
  const sanitized = sanitizeTextInput(clipboard);
  const input = event.currentTarget;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const newValue = input.value.slice(0, start) + sanitized + input.value.slice(end);
  event.preventDefault();
  setter(newValue);
  queueMicrotask(() => {
    const caret = start + sanitized.length;
    input.setSelectionRange(caret, caret);
  });
}

export default function KtpelPage() {
  const { user } = useSession();

  const [activeTab, setActiveTab] = useState<Mode>("rekam");
  const [meta, setMeta] = useState<MetaState | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Record<Mode, FilterState>>({
    rekam: createInitialFilter(),
    hist: createInitialFilter(),
    wktp: createInitialFilter(),
  });

  const [kecamatanOptions, setKecamatanOptions] = useState<WilayahOption[]>([]);
  const [kelurahanCache, setKelurahanCache] = useState<Record<string, WilayahOption[]>>({});
  const [kelurahanLoadingKey, setKelurahanLoadingKey] = useState<string | null>(null);

  const [resultMode, setResultMode] = useState<Mode>("rekam");
  const [rows, setRows] = useState<KtpelRow[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState<Mode | null>(null);
  const [pushLoadingNik, setPushLoadingNik] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      setMetaLoading(true);
      setMetaError(null);
      try {
        const res = await fetch("/api/check/ktpel/meta", { cache: "no-store", credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload: MetaResponse = await res.json();
        if (!payload.success || !payload.data) {
          throw new Error(payload.message || "Metadata tidak valid");
        }

        if (cancelled) return;

        const defaults = payload.data.defaults;
        const newFilters: Record<Mode, FilterState> = {
          rekam: { ...createInitialFilter() },
          hist: { ...createInitialFilter() },
          wktp: { ...createInitialFilter() },
        };

        const defaultNoKec = convertWilayahCode(defaults.noKec);
        const defaultNoKel = convertWilayahCode(defaults.noKel);

        ["rekam", "hist", "wktp"].forEach((mode) => {
          newFilters[mode as Mode].noKec = defaultNoKec;
          newFilters[mode as Mode].noKel = defaultNoKel;
        });

        setFilters(newFilters);
        setMeta(payload.data);
        setKecamatanOptions(payload.data.wilayah.kecamatan);

        if (defaultNoKec !== "0" && payload.data.wilayah.kelurahan.length > 0) {
          setKelurahanCache({
            [defaultNoKec]: payload.data.wilayah.kelurahan,
          });
        }
      } catch (error: any) {
        if (cancelled) return;
        setMetaError(error?.message || "Gagal memuat metadata");
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = setTimeout(() => setActionNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [actionNotice]);

  const currentFilter = filters[activeTab];

  const currentKelurahanOptions = useMemo(() => {
    const key = currentFilter.noKec;
    return kelurahanCache[key] ?? [];
  }, [currentFilter.noKec, kelurahanCache]);

  const allowSelectKecamatan = useMemo(() => {
    if (!meta) return true;
    const defaultNoKec = convertWilayahCode(meta.defaults.noKec);
    return defaultNoKec === "0" || meta.akses.aksesKecamatan > 0;
  }, [meta]);

  const allowSelectKelurahan = useMemo(() => {
    if (!meta) return true;
    const defaultNoKel = convertWilayahCode(meta.defaults.noKel);
    return defaultNoKel === "0" || meta.akses.aksesKelurahan > 0;
  }, [meta]);

  const totalRows = rows.length;

  const activeModeLabel = MODE_LABEL[activeTab];
  const resultModeLabel = MODE_LABEL[resultMode];

  function updateFilter(mode: Mode, patch: Partial<FilterState>) {
    setFilters((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], ...patch },
    }));
  }

  async function handleKecamatanChange(mode: Mode, value: string) {
    updateFilter(mode, { noKec: value, noKel: "0" });
    if (value === "0") return;
    if (kelurahanCache[value]) return;

    setKelurahanLoadingKey(value);
    try {
      const params = new URLSearchParams({ no_kec: value });
      if (meta) {
        params.set("no_prop", meta.defaults.noProp);
        params.set("no_kab", meta.defaults.noKab);
      }
      const res = await fetch(`/api/check/ktpel/kelurahan?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list: WilayahOption[] = json?.data?.kelurahan ?? json?.kelurahan ?? [];
      setKelurahanCache((prev) => ({ ...prev, [value]: list }));
    } catch (error) {
      console.error("Gagal memuat kelurahan:", error);
    } finally {
      setKelurahanLoadingKey(null);
    }
  }

  function handleClear(mode: Mode) {
    const fresh = createInitialFilter();
    if (meta) {
      fresh.noKec = convertWilayahCode(meta.defaults.noKec);
      fresh.noKel = convertWilayahCode(meta.defaults.noKel);
    }
    updateFilter(mode, fresh);
    setRows([]);
    setSearchError(null);
    setResultMode(mode);
  }

  async function handleSearch(mode: Mode) {
    const filter = filters[mode];
    const payload: any = {
      mode,
      nik: filter.nik.trim(),
      noKk: filter.noKk.trim(),
      namaLgkp: filter.nama.trim(),
      tglLhr: toApiDate(filter.tglLhr.trim()),
    };

    if (filter.noKec !== "0") payload.noKec = filter.noKec;
    if (filter.noKel !== "0") payload.noKel = filter.noKel;

    if (mode === "wktp") {
      if (filter.noRw.trim()) payload.noRw = filter.noRw.trim();
      if (filter.noRt.trim()) payload.noRt = filter.noRt.trim();
    }

    setSearchLoading(mode);
    setSearchError(null);
    try {
      const res = await fetch("/api/check/ktpel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const json: SearchResponse = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || `HTTP ${res.status}`);
      }

      setRows(json.data.rows || []);
      setResultMode(json.data.mode || mode);
    } catch (error: any) {
      setRows([]);
      setResultMode(mode);
      setSearchError(error?.message || "Pencarian gagal");
  } finally {
    setSearchLoading(null);
  }
}

  async function handlePush(nik: string) {
    const cleanNik = sanitizeNumber(nik);
    if (!cleanNik) {
      setActionNotice({ type: "error", message: "NIK tidak valid untuk Re-Push." });
      return;
    }

    setPushLoadingNik(nik);
    setActionNotice(null);
    try {
      const res = await fetch("/api/check/ktpel/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nik: cleanNik }),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || "Gagal memproses Re-Push");
      }

      const message =
        json.data.message ||
        `Status ${Array.isArray(json.data.nik) && json.data.nik.length > 1 ? "beberapa NIK" : "NIK"} berhasil diperbarui.`;
      setActionNotice({ type: "success", message });
      await handleSearch(resultMode);
    } catch (error: any) {
      setActionNotice({ type: "error", message: error?.message || "Re-Push gagal diproses." });
    } finally {
      setPushLoadingNik(null);
    }
  }

  const handleFilterEnter = (event: KeyboardEvent<HTMLElement>, mode: Mode) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    void handleSearch(mode);
  };

  function handleExportCsv() {
    if (!rows.length) return;
    const headers = [
      "NO",
      "NIK",
      "NAMA",
      "TEMPAT LAHIR",
      "TANGGAL LAHIR",
      "STATUS KTP",
      "CETAK KTP OLEH",
      "CETAK KTP TANGGAL",
      "DISTRIBUSI OLEH",
      "DISTRIBUSI TANGGAL",
      "PENGAJUAN OLEH",
      "PENGAJUAN TANGGAL",
      "PENGAJUAN DIPROSES OLEH",
      "PENGAJUAN STATUS",
      "NOMOR KK",
      "NAMA KECAMATAN",
      "NAMA KELURAHAN",
      "ALAMAT",
      "RT",
      "RW",
      "KODE POS",
      "JUMLAH CETAK",
    ];

    const lines = rows.map((row, index) => {
      const nikCsv = formatLeadingComma(row.nik);
      const noKkCsv = formatLeadingComma(row.noKk);
      return [
        index + 1,
        nikCsv,
        row.nama ?? "",
        row.tempatLahir ?? "",
        row.tanggalLahir ?? "",
        row.currentStatus ?? "",
        row.ktpOleh ?? "",
        row.ktpTanggal ?? "",
        row.distribusiOleh ?? "",
        row.distribusiTanggal ?? "",
        row.pengajuanOleh ?? "",
        row.pengajuanTanggal ?? "",
        row.pengajuanDiprosesOleh ?? "",
        row.pengajuanStatus ?? "",
        noKkCsv,
        row.namaKecamatan ?? "",
        row.namaKelurahan ?? "",
        row.alamat ?? "",
        row.rt ?? "",
        row.rw ?? "",
        row.kodePos ?? "",
        row.jumlahCetak ?? 0,
      ];
    });

    const csv = [headers, ...lines]
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
    link.setAttribute("download", `ktpel-${resultMode}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  function renderTabButton(mode: Mode) {
    const active = activeTab === mode;
    return (
      <button
        key={mode}
        type="button"
        onClick={() => setActiveTab(mode)}
        className={`rounded-full px-4 py-1 text-sm font-medium transition-all ${
          active
            ? "bg-cyan-500/20 text-cyan-200 shadow-[0_0_12px_#22d3ee55]"
            : "text-cyan-100/70 hover:text-cyan-50 hover:bg-cyan-500/10"
        }`}
      >
        {MODE_LABEL[mode]}
      </button>
    );
  }

  function renderStatusCards() {
    const statuses = meta?.statuses;
    if (!statuses) return null;

    const primary = statuses.pushPrimary ?? [];
    const retry = statuses.pushRetry ?? [];
    if (!primary.length && !retry.length) return null;

    // FILE: src/app/(routes)/check/ktpel/page.tsx  (atau file tempat komponen KtpelPage berada)

// ...di dalam KtpelPage()

    const renderStatusTable = (title: string, items: string[], startIndex: number) => (
      <div className="ktpel-status-card">
        <h3 className="ktpel-status-card__title">{title}</h3>
        <table className="ktpel-status-table">
          {/* ⬇️ colgroup memastikan proporsi 20% : 80% */}
          <colgroup>
            <col style={{ width: "10%" }} />
            <col style={{ width: "90%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="ktpel-status-index" >#</th>
              <th className="ktpel-status-value">Status Code</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((status, index) => {
                const displayStatus = status?.trim() || "-";
                const highlight = displayStatus.includes("*");
                const statusClass = highlight
                  ? "ktpel-status-value ktpel-status-highlight"
                  : "ktpel-status-value";
                return (
                  <tr key={`${title}-${status}-${index}`}>
                    <td className="ktpel-status-index text-center">{startIndex + index}</td>
                    <td className={statusClass}>{displayStatus}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="ktpel-status-index text-center" colSpan={2}>
                  No statuses available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );


    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {renderStatusTable("Statuses Eligible for Monitoring Re-Push", primary, 1)}
        {renderStatusTable(
          "If e-KTP Status Resets, Retry Later",
          retry,
          primary.length + 1
        )}
      </div>
    );
  }

  function renderCommonFilters(mode: Mode) {
    const kecOptions = mergeOptions(kecamatanOptions, allowSelectKecamatan, "-- Pilih Kecamatan --");
    const kelOptions = mergeOptions(currentKelurahanOptions, allowSelectKelurahan, "-- Pilih Kelurahan --");
    return (
      <div className="space-y-4" onKeyDown={(event) => handleFilterEnter(event, mode)}>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
              Kecamatan
            </label>
            <select
              value={filters[mode].noKec}
              onChange={(event) => handleKecamatanChange(mode, event.target.value)}
              disabled={!allowSelectKecamatan || metaLoading}
              className="w-full rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {kecOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
              Kelurahan
            </label>
            <select
              value={filters[mode].noKel}
              onChange={(event) => updateFilter(mode, { noKel: event.target.value })}
              disabled={!allowSelectKelurahan || filters[mode].noKec === "0" || kelurahanLoadingKey === filters[mode].noKec}
              className="w-full rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {kelOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
              NIK
            </label>
            <input
              value={filters[mode].nik}
              onChange={(event) => updateFilter(mode, { nik: sanitizeNikInput(event.target.value) })}
              onKeyDown={(event) => handleNumberKeyDown(event, true)}
              onPaste={(event) =>
                handleNumericPaste(event, true, (value) => updateFilter(mode, { nik: value }))
              }
              placeholder="Pisahkan dengan koma"
              className="w-full rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
              No KK
            </label>
            <input
              value={filters[mode].noKk}
              onChange={(event) => updateFilter(mode, { noKk: sanitizeNikInput(event.target.value) })}
              onKeyDown={(event) => handleNumberKeyDown(event, true)}
              onPaste={(event) =>
                handleNumericPaste(event, true, (value) => updateFilter(mode, { noKk: value }))
              }
              placeholder="Pisahkan dengan koma"
              className="w-full rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
              Nama Lengkap
            </label>
            <input
              value={filters[mode].nama}
              onChange={(event) => updateFilter(mode, { nama: sanitizeTextInput(event.target.value) })}
              onPaste={(event) =>
                handleNamePaste(event, (value) => updateFilter(mode, { nama: value }))
              }
              className="w-full rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
              Tanggal Lahir
            </label>
            <input
              type="date"
              value={toDateInput(filters[mode].tglLhr)}
              onChange={(event) => updateFilter(mode, { tglLhr: event.target.value })}
              className="w-full rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            />
          </div>
        </div>
      </div>
    );
  }

  function renderWktpFilters() {
    const kecOptions = mergeOptions(kecamatanOptions, true, "-- Pilih Kecamatan --");
    const kelOptions = mergeOptions(currentKelurahanOptions, true, "-- Pilih Kelurahan --");
    return (
      <div className="space-y-4" onKeyDown={(event) => handleFilterEnter(event, "wktp")}>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
              Kecamatan
            </label>
            <select
              value={filters.wktp.noKec}
              onChange={(event) => handleKecamatanChange("wktp", event.target.value)}
              disabled={metaLoading}
              className="w-full rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            >
              {kecOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
              Kelurahan
            </label>
            <select
              value={filters.wktp.noKel}
              onChange={(event) => updateFilter("wktp", { noKel: event.target.value })}
              disabled={filters.wktp.noKec === "0" || kelurahanLoadingKey === filters.wktp.noKec}
              className="w-full rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            >
              {kelOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
              No RW
            </label>
            <input
              value={filters.wktp.noRw}
              onChange={(event) => updateFilter("wktp", { noRw: sanitizeNumber(event.target.value) })}
              onKeyDown={(event) => handleNumberKeyDown(event, false)}
              onPaste={(event) =>
                handleNumericPaste(event, false, (value) => updateFilter("wktp", { noRw: value }))
              }
              className="w-full rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
              No RT
            </label>
            <input
              value={filters.wktp.noRt}
              onChange={(event) => updateFilter("wktp", { noRt: sanitizeNumber(event.target.value) })}
              onKeyDown={(event) => handleNumberKeyDown(event, false)}
              onPaste={(event) =>
                handleNumericPaste(event, false, (value) => updateFilter("wktp", { noRt: value }))
              }
              className="w-full rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            />
          </div>
        </div>
      </div>
    );
  }

  function renderFilters() {
    if (activeTab === "wktp") return renderWktpFilters();
    return renderCommonFilters(activeTab);
  }

  function renderActionButtons() {
    const busy = searchLoading === activeTab;
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => handleClear(activeTab)}
          className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-white/5 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-white/10"
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </button>
        <button
          type="button"
          onClick={() => handleSearch(activeTab)}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </div>
    );
  }
  function renderTable() {
    if (searchLoading && rows.length === 0) {
      return (
        <div className="flex items-center justify-center rounded-xl border border-cyan-800/40 bg-black/30 py-12">
          <div className="flex items-center gap-3 text-sm text-cyan-100/80">
            <Loader2 className="h-5 w-5 animate-spin" />
            Mengambil data...
          </div>
        </div>
      );
    }

    if (searchError) {
      return (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-6 text-sm text-red-100">
          {searchError}
        </div>
      );
    }

    if (!rows.length) {
      return <div className="ktpel-empty-state">Belum ada data yang ditampilkan.</div>;
    }

    return (
      <div className="overflow-hidden rounded-xl border border-cyan-800/40 bg-black/30">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-cyan-800/60 text-sm text-cyan-100/90">
            <thead className="bg-cyan-500/10 text-xs uppercase tracking-wide text-cyan-200">
              <tr>
                <th className="px-3 py-3 text-center">No</th>
                <th className="px-3 py-3 text-left">Nama</th>
                <th className="px-3 py-3 text-center">NIK</th>
                <th className="px-3 py-3 text-center">Lahir</th>
                <th className="px-3 py-3 text-center">Status KTP</th>
                <th className="px-3 py-3 text-left">Cetak KTP</th>
                <th className="px-3 py-3 text-left">Distribusi KTP</th>
                <th className="px-3 py-3 text-left">Pengajuan</th>
                <th className="px-3 py-3 text-center">Nomor KK</th>
                <th className="px-3 py-3 text-left">Nama Kec</th>
                <th className="px-3 py-3 text-left">Nama Kel</th>
                <th className="px-3 py-3 text-left">Alamat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-900/60">
              {rows.map((row, index) => {
                const pushUrl = buildLegacyUrl(meta?.legacyPushBase ?? null, row.nik);
                const historyUrl = buildLegacyUrl(meta?.legacyHistoryBase ?? null, row.nik);
                const isPushing = pushLoadingNik === row.nik;
                const formattedNik = formatLeadingComma(row.nik);
                const formattedNoKk = formatLeadingComma(row.noKk);
                return (
                  <tr key={`${row.nik}-${index}`} className="transition hover:bg-cyan-500/10">
                    <td className="px-3 py-3 text-center text-xs font-medium text-cyan-100/70">{index + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-cyan-50">{toDisplay(row.nama)}</span>
                        <span className="text-xs text-cyan-200/60">{toDisplay(row.jenisKelamin)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="font-medium tracking-wide">
                          <span className="ktpel-soft-leading-comma">{formattedNik.slice(0, 1)}</span>
                          <span>{formattedNik.slice(1) || "-"}</span>
                        </span>
                        {historyUrl && (
                          <a
                            href={historyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                          >
                            Cek History
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center text-xs leading-relaxed text-cyan-100/80">
                      <div>{toDisplay(row.tempatLahir)}</div>
                      <div>{toDisplay(row.tanggalLahir)}</div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-2 text-xs text-cyan-100/80">
                        <span className="inline-flex min-w-[140px] items-center justify-center rounded-full bg-cyan-500/10 px-3 py-1 font-semibold text-cyan-200">
                          {formatStatusLabel(row.currentStatus)}
                        </span>
                        {row.pushEligible ? (
                          <div className="flex flex-col items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handlePush(row.nik)}
                              disabled={isPushing}
                              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isPushing ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Memproses...
                                </>
                              ) : (
                                <>
                                  <RefreshCcw className="h-3 w-3" />
                                  Re-Push
                                </>
                              )}
                            </button>
                            {pushUrl ? (
                              <a
                                href={pushUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-200/70 transition hover:text-cyan-50"
                              >
                                Legacy Re-Push
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                        {row.keterangan && (
                          <span className="rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                            {row.keterangan}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-cyan-100/80">
                      <div className="flex items-center gap-1 text-cyan-200/80">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                        {toDisplay(row.ktpOleh)}
                      </div>
                      <div className="ml-3 text-cyan-200/60">{toDisplay(row.ktpTanggal)}</div>
                      {row.jumlahCetak > 0 && (
                        <div className="ml-3 text-emerald-300/80">Dicetak {row.jumlahCetak}x</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-cyan-100/80">
                      <div className="flex items-center gap-1 text-cyan-200/80">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                        {toDisplay(row.distribusiOleh)}
                      </div>
                      <div className="ml-3 text-cyan-200/60">{toDisplay(row.distribusiTanggal)}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-cyan-100/80">
                      <div className="flex items-center gap-1 text-cyan-200/80">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                        {toDisplay(row.pengajuanOleh)}
                      </div>
                      <div className="ml-3 text-cyan-200/60">{toDisplay(row.pengajuanTanggal)}</div>
                      <div className="ml-3 text-cyan-200/60">{toDisplay(row.pengajuanDiprosesOleh)}</div>
                      <div className="ml-3 text-emerald-300/80">{toDisplay(row.pengajuanStatus)}</div>
                    </td>
                    <td className="px-3 py-3 text-center text-xs font-medium text-cyan-100/80">
                      {formattedNoKk ? (
                        <>
                          <span className="ktpel-soft-leading-comma">{formattedNoKk.slice(0, 1)}</span>
                          <span>{formattedNoKk.slice(1)}</span>
                        </>
                      ) : (
                        <span>{toDisplay(row.noKk)}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-cyan-100/80">{toDisplay(row.namaKecamatan)}</td>
                    <td className="px-3 py-3 text-xs text-cyan-100/80">{toDisplay(row.namaKelurahan)}</td>
                    <td className="px-3 py-3 text-xs text-cyan-100/80">
                      <div>{toDisplay(row.alamat)}</div>
                      <div className="text-cyan-200/60">
                        RT {toDisplay(row.rt)} / RW {toDisplay(row.rw)}
                      </div>
                      <div className="text-cyan-200/60">Kode Pos: {toDisplay(row.kodePos)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
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
              Check Status KTP-el
            </span>
            <h1 className="text-lg font-semibold text-cyan-100 md:text-xl">Monitoring KTP-el</h1>
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

        <div className="space-y-8 p-6">
          <div className="flex flex-wrap gap-3">{(["rekam", "hist", "wktp"] as Mode[]).map(renderTabButton)}</div>

          {metaError ? (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              <AlertTriangle className="h-4 w-4" />
              {metaError}
            </div>
          ) : null}

          {renderFilters()}

          {renderActionButtons()}

          {actionNotice ? (
            <div
              className={`rounded-xl px-4 py-3 text-sm ${
                actionNotice.type === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                  : "border-red-500/40 bg-red-500/10 text-red-100"
              }`}
            >
              {actionNotice.message}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!rows.length}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <div className="text-xs text-cyan-200/70">
              Mode aktif: <span className="font-semibold text-cyan-100">{activeModeLabel}</span>
              {rows.length > 0 ? (
                <>
                  {" "}| Menampilkan <span className="font-semibold text-cyan-100">{totalRows}</span> data ({resultModeLabel})
                </>
              ) : null}
            </div>
          </div>

          {renderTable()}

          {renderStatusCards()}
        </div>
      </section>
    </div>
  );
}


