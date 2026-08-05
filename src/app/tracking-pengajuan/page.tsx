// FILE: src/app/tracking-pengajuan/page.tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FilePlus2,
  Loader2,
  Printer,
  RefreshCcw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import DateRangePopup from "@/components/ui/DateRangePopup";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";
import SelectDark from "@/components/ui/SelectDark";
import SettingPageHeader from "@/components/setting/SettingPageHeader";

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => <div className="px-4 py-5 text-sm text-cyan-100/70">Menyiapkan tabel...</div>,
});

const STATUSES = ["BERKAS_MASUK", "SELESAI", "DIAMBIL", "BATAL"] as const;
type TrackingStatus = (typeof STATUSES)[number];
const STATUS_LABELS: Record<TrackingStatus, string> = {
  BERKAS_MASUK: "BERKAS MASUK",
  SELESAI: "SELESAI",
  DIAMBIL: "DIAMBIL",
  BATAL: "BATAL",
};

type LocationOption = { locationId: number; code: string; name: string; type: string };
type ProductOption = { productId: number; code: string; name: string };
type RelationOption = { locationId: number; productId: number };
type WilayahOption = { value: string; label: string };
type KtpelMeta = {
  defaults: { noProp: string; noKab: string; noKec: string; noKel: string };
  wilayah: { kecamatan: WilayahOption[]; kelurahan: WilayahOption[] };
};
type TrackingRow = {
  trackingId: number;
  registrationNo: string;
  locationId: number;
  locationCode: string;
  locationName: string;
  productId: number;
  productCode: string;
  productName: string;
  nik: string;
  name: string;
  kecamatan: string;
  kelurahan: string;
  phone: string;
  email: string;
  status: TrackingStatus;
  statusLabel?: string;
  createdBy: string;
  createdDate: string;
  createdTime: string;
};
type SearchRow = {
  trackingId: number;
  registrationNo: string;
  name: string;
  nik: string;
  productName: string;
  locationName: string;
  date: string;
  status: TrackingStatus;
  statusLabel?: string;
};

const emptyForm = {
  locationId: "",
  productId: "",
  nik: "",
  name: "",
  noKec: "0",
  noKel: "0",
  kecamatan: "",
  kelurahan: "",
  phone: "",
  email: "",
};

const toLocalIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const normalizeDigits = (value: string, max = 16) => value.replace(/\D/g, "").slice(0, max);
const qrUrl = (value: string) => `https://api.qrserver.com/v1/create-qr-code/?size=132x132&data=${encodeURIComponent(value)}`;

function statusClass(status: string) {
  if (status === "BERKAS_MASUK") return "border-cyan-400/40 bg-cyan-500/15 text-cyan-100";
  if (status === "SELESAI") return "border-emerald-400/40 bg-emerald-500/15 text-emerald-100";
  if (status === "DIAMBIL") return "border-blue-400/40 bg-blue-500/15 text-blue-100";
  return "border-rose-400/40 bg-rose-500/15 text-rose-100";
}

function nextStatuses(status: TrackingStatus) {
  if (status === "BERKAS_MASUK") return ["SELESAI", "BATAL"] as TrackingStatus[];
  if (status === "SELESAI") return ["DIAMBIL"] as TrackingStatus[];
  return [] as TrackingStatus[];
}

function statusLabel(status: string) {
  return STATUS_LABELS[status as TrackingStatus] || status;
}

function convertWilayahCode(raw: string | null | undefined) {
  const val = (raw ?? "").trim();
  if (!val) return "0";
  const digits = val.replace(/[^\d]/g, "");
  if (!digits || digits === "0" || digits === "000") return "0";
  const normalized = Number(digits);
  return Number.isNaN(normalized) ? digits : String(normalized);
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

function selectedWilayahLabel(options: WilayahOption[], value: string) {
  if (!value || value === "0") return "";
  return options.find((opt) => opt.value === value)?.label || "";
}

export default function TrackingPengajuanPage() {
  const today = useMemo(() => toLocalIso(new Date()), []);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [relations, setRelations] = useState<RelationOption[]>([]);
  const [ktpelMeta, setKtpelMeta] = useState<KtpelMeta | null>(null);
  const [kecamatanOptions, setKecamatanOptions] = useState<WilayahOption[]>([]);
  const [kelurahanCache, setKelurahanCache] = useState<Record<string, WilayahOption[]>>({});
  const [kelurahanLoadingKey, setKelurahanLoadingKey] = useState<string | null>(null);
  const [rows, setRows] = useState<TrackingRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({
    start: today,
    end: today,
    locationId: "",
    productId: "",
    status: "",
    petugas: "",
    nik: "",
    registrationNo: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [searchRows, setSearchRows] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [statusModal, setStatusModal] = useState<{ row: TrackingRow; next: TrackingStatus[] } | null>(null);
  const [statusValue, setStatusValue] = useState<TrackingStatus | "">("");
  const [statusDescription, setStatusDescription] = useState("");
  const [notice, setNotice] = useState<{ kind: ModalKind; title: string; message: string } | null>(null);
  const tableHostRef = useRef<HTMLElement | null>(null);

  const productsByLocation = useMemo(() => {
    const locationId = Number(form.locationId || 0);
    if (!locationId) return [];
    const allowed = new Set(relations.filter((rel) => rel.locationId === locationId).map((rel) => rel.productId));
    return products.filter((product) => allowed.has(product.productId));
  }, [form.locationId, products, relations]);

  const filterProducts = useMemo(() => {
    const locationId = Number(filters.locationId || 0);
    if (!locationId) return products;
    const allowed = new Set(relations.filter((rel) => rel.locationId === locationId).map((rel) => rel.productId));
    return products.filter((product) => allowed.has(product.productId));
  }, [filters.locationId, products, relations]);

  const currentKelurahanOptions = useMemo(() => {
    return kelurahanCache[form.noKec] ?? [];
  }, [form.noKec, kelurahanCache]);

  const kecamatanSelectOptions = useMemo(
    () => mergeOptions(kecamatanOptions, true, "-- Pilih Kecamatan --"),
    [kecamatanOptions]
  );

  const kelurahanSelectOptions = useMemo(
    () => mergeOptions(currentKelurahanOptions, true, "-- Pilih Kelurahan --"),
    [currentKelurahanOptions]
  );

  const columns = useMemo(
    () => [
      { data: null, title: "No", render: (_: any, __: any, ___: any, meta: any) => meta.row + 1 },
      { data: "registrationNo", title: "No Registrasi" },
      { data: "nik", title: "NIK" },
      { data: "name", title: "Nama" },
      { data: "productName", title: "Jenis Pelayanan" },
      { data: "locationName", title: "Lokasi" },
      { data: "createdDate", title: "Tanggal" },
      { data: "createdTime", title: "Jam" },
      {
        data: "status",
        title: "Status",
        render: (data: string) => `<span class="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(data)}">${statusLabel(data)}</span>`,
      },
      { data: "createdBy", title: "Petugas" },
      {
        data: null,
        title: "Aksi",
        orderable: false,
        render: (_: any, __: any, row: TrackingRow) => {
          const canUpdate = nextStatuses(row.status).length > 0;
          return `
            <div class="flex flex-wrap gap-2">
              <button class="btn-print-resi rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/25" data-id="${row.trackingId}">Resi</button>
              <button class="btn-update-status rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-50 hover:bg-emerald-500/25 disabled:opacity-40" data-id="${row.trackingId}" ${canUpdate ? "" : "disabled"}>Status</button>
            </div>
          `;
        },
      },
    ],
    []
  );

  async function loadMaster() {
    const res = await fetch("/api/tracking-pengajuan/master", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat master tracking");
    setLocations(json.data?.locations || []);
    setProducts(json.data?.products || []);
    setRelations(json.data?.relations || []);
  }

  async function loadWilayahMeta() {
    const res = await fetch("/api/check/ktpel/meta", { cache: "no-store", credentials: "include" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload.success === false || !payload.data) throw new Error(payload.message || "Gagal memuat wilayah");

    const meta = payload.data as KtpelMeta;
    const defaultNoKec = convertWilayahCode(meta.defaults?.noKec);
    const defaultNoKel = convertWilayahCode(meta.defaults?.noKel);
    const kecamatan = Array.isArray(meta.wilayah?.kecamatan) ? meta.wilayah.kecamatan : [];
    const kelurahan = Array.isArray(meta.wilayah?.kelurahan) ? meta.wilayah.kelurahan : [];

    setKtpelMeta(meta);
    setKecamatanOptions(kecamatan);
    if (defaultNoKec !== "0" && kelurahan.length > 0) {
      setKelurahanCache((prev) => ({ ...prev, [defaultNoKec]: kelurahan }));
    }
    setForm((prev) => {
      const kecLabel = selectedWilayahLabel(kecamatan, defaultNoKec);
      const kelLabel = selectedWilayahLabel(kelurahan, defaultNoKel);
      return {
        ...prev,
        noKec: defaultNoKec,
        noKel: defaultNoKel,
        kecamatan: kecLabel,
        kelurahan: kelLabel,
      };
    });
  }

  async function handleKecamatanChange(value: string) {
    const kecamatan = selectedWilayahLabel(kecamatanOptions, value);
    setForm((prev) => ({
      ...prev,
      noKec: value,
      noKel: "0",
      kecamatan,
      kelurahan: "",
    }));
    if (value === "0" || kelurahanCache[value]) return;

    setKelurahanLoadingKey(value);
    try {
      const params = new URLSearchParams({ no_kec: value });
      if (ktpelMeta) {
        params.set("no_prop", ktpelMeta.defaults.noProp);
        params.set("no_kab", ktpelMeta.defaults.noKab);
      }
      const res = await fetch(`/api/check/ktpel/kelurahan?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json().catch(() => ({}));
      const list: WilayahOption[] = json?.data?.kelurahan ?? json?.kelurahan ?? [];
      setKelurahanCache((prev) => ({ ...prev, [value]: list }));
    } catch (e: any) {
      setNotice({ kind: "error", title: "Kelurahan Gagal Dimuat", message: e?.message || "Gagal memuat daftar kelurahan" });
    } finally {
      setKelurahanLoadingKey(null);
    }
  }

  function handleKelurahanChange(value: string) {
    setForm((prev) => ({
      ...prev,
      noKel: value,
      kelurahan: selectedWilayahLabel(currentKelurahanOptions, value),
    }));
  }

  async function loadRows(nextFilters = filters) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const res = await fetch(`/api/tracking-pengajuan?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat tracking pengajuan");
      setRows(json.data?.rows || []);
      setSummary(json.data?.summary || {});
    } catch (e: any) {
      setNotice({ kind: "error", title: "Gagal Memuat", message: e?.message || "Gagal memuat tracking pengajuan" });
      setRows([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([loadMaster(), loadWilayahMeta()]);
        await loadRows();
      } catch (e: any) {
        setNotice({ kind: "error", title: "Inisialisasi Gagal", message: e?.message || "Gagal memuat modul tracking" });
      }
    })();
  }, []);

  useEffect(() => {
    if (form.productId && !productsByLocation.some((item) => String(item.productId) === form.productId)) {
      setForm((prev) => ({ ...prev, productId: "" }));
    }
  }, [form.locationId, productsByLocation]);

  useEffect(() => {
    if (filters.productId && !filterProducts.some((item) => String(item.productId) === filters.productId)) {
      setFilters((prev) => ({ ...prev, productId: "" }));
    }
  }, [filters.locationId, filterProducts]);

  const detachTableClick = () => {
    if (tableHostRef.current) {
      tableHostRef.current.removeEventListener("click", onTableClick as any);
      tableHostRef.current = null;
    }
  };

  const handleApiReady = (api: any | null) => {
    if (!api) {
      detachTableClick();
      return;
    }
    const container = api.table().container() as HTMLElement;
    if (tableHostRef.current && tableHostRef.current !== container) {
      tableHostRef.current.removeEventListener("click", onTableClick as any);
    }
    tableHostRef.current = container;
    container.addEventListener("click", onTableClick as any);
  };

  const onTableClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const printBtn = target.closest("[data-id].btn-print-resi") as HTMLElement | null;
    const statusBtn = target.closest("[data-id].btn-update-status") as HTMLButtonElement | null;
    if (printBtn) {
      const row = rows.find((item) => item.trackingId === Number(printBtn.dataset.id));
      if (row) printReceipt(row);
      return;
    }
    if (statusBtn && !statusBtn.disabled) {
      const row = rows.find((item) => item.trackingId === Number(statusBtn.dataset.id));
      if (!row) return;
      const next = nextStatuses(row.status);
      setStatusModal({ row, next });
      setStatusValue(next[0] || "");
      setStatusDescription("");
    }
  };

  useEffect(() => () => detachTableClick(), []);

  async function saveTracking() {
    setSaving(true);
    try {
      const res = await fetch("/api/tracking-pengajuan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menyimpan pengajuan");
      const item = json.data?.item as TrackingRow;
      setForm(emptyForm);
      setNotice({ kind: "success", title: "Pengajuan Disimpan", message: `Nomor registrasi ${item.registrationNo} berhasil dibuat.` });
      await loadRows();
      printReceipt(item);
    } catch (e: any) {
      setNotice({ kind: "error", title: "Gagal Menyimpan", message: e?.message || "Gagal menyimpan pengajuan" });
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus() {
    if (!statusModal || !statusValue) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tracking-pengajuan/${statusModal.row.trackingId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ status: statusValue, description: statusDescription }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memperbarui status");
      setStatusModal(null);
      setNotice({ kind: "success", title: "Status Diperbarui", message: json.message || "Status tracking berhasil diperbarui" });
      await loadRows();
    } catch (e: any) {
      setNotice({ kind: "error", title: "Gagal Update Status", message: e?.message || "Gagal memperbarui status" });
    } finally {
      setSaving(false);
    }
  }

  async function searchTracking() {
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: searchTerm.trim() });
      const res = await fetch(`/api/tracking-pengajuan/search?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal mencari tracking");
      setSearchRows(json.data?.rows || []);
    } catch (e: any) {
      setNotice({ kind: "error", title: "Pencarian Gagal", message: e?.message || "Gagal mencari tracking" });
      setSearchRows([]);
    } finally {
      setSearching(false);
    }
  }

  function printReceipt(row: TrackingRow) {
    const win = window.open("", "_blank", "width=420,height=680");
    if (!win) return;
    const html = `<!doctype html>
      <html>
      <head>
        <title>Resi ${row.registrationNo}</title>
        <style>
          *{box-sizing:border-box} body{font-family:Arial,sans-serif;margin:0;background:#fff;color:#111}
          .wrap{width:360px;margin:0 auto;padding:18px}
          .head{text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px}
          .logo{width:58px;height:58px;margin:0 auto 8px;border:2px solid #111;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700}
          h1{font-size:15px;margin:0;text-transform:uppercase} h2{font-size:13px;margin:4px 0 0}
          .reg{font-size:14px;font-weight:700;text-align:center;border:1px dashed #111;padding:8px;margin:12px 0}
          .qr{text-align:center;margin:10px 0 14px}.qr img{width:132px;height:132px}
          table{width:100%;border-collapse:collapse;font-size:12px}td{padding:5px 0;vertical-align:top}td:first-child{width:118px;color:#333}
          .status{margin-top:10px;text-align:center;font-weight:700;border:1px solid #111;padding:8px}
          .foot{margin-top:14px;font-size:10px;text-align:center;color:#444}
          @media print{.noprint{display:none}.wrap{width:100%;padding:8px}}
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="head">
            <div class="logo">BDG</div>
            <h1>Disdukcapil Kota Bandung</h1>
            <h2>Resi Tracking Pengajuan Pelayanan</h2>
          </div>
          <div class="reg">${row.registrationNo}</div>
          <div class="qr"><img src="${qrUrl(row.registrationNo)}" alt="QR Code" /></div>
          <table>
            <tr><td>Tanggal</td><td>: ${row.createdDate}</td></tr>
            <tr><td>Jam</td><td>: ${row.createdTime}</td></tr>
            <tr><td>Nama</td><td>: ${row.name}</td></tr>
            <tr><td>NIK</td><td>: ${row.nik}</td></tr>
            <tr><td>Jenis Pelayanan</td><td>: ${row.productName}</td></tr>
            <tr><td>Lokasi Pelayanan</td><td>: ${row.locationName}</td></tr>
            <tr><td>No HP</td><td>: ${row.phone || "-"}</td></tr>
            <tr><td>Email</td><td>: ${row.email || "-"}</td></tr>
          </table>
          <div class="status">${row.statusLabel || statusLabel(row.status)}</div>
          <div class="foot">Monalisa hanya mencatat registrasi dan tracking. Proses administrasi tetap dilakukan pada sistem layanan resmi.</div>
        </div>
        <script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
      </body>
      </html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  return (
    <div className="relative mt-16 space-y-8 px-4 pb-10 pt-6 text-gray-100 sm:px-6 md:px-8 md:pt-8">
      <SettingPageHeader
        lead="Pelayanan"
        title="Tracking Pengajuan"
        description="Registrasi manual, monitoring status, pencarian pengajuan, dan cetak resi pelayanan Disdukcapil."
        badges={<span className="rounded-full border border-cyan-400/50 bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-100">Manual Tracking</span>}
      />

      <section className="grid  gap-5 xl:grid-cols-[minmax(360px,430px)_1fr]">
        <div className="rounded-3xl border border-cyan-900/50 bg-[#05070d]/80 p-5 shadow-[0_0_34px_#00ffff22]">
          <div className="mb-4 flex items-center gap-2 text-cyan-100">
            <FilePlus2 className="h-5 w-5 text-cyan-300" />
            <h2 className="text-sm font-semibold">Input Pengajuan</h2>
          </div>
          <div className="grid gap-3">
            <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none">
              <option value="">Pilih Lokasi Layanan</option>
              {locations.map((item) => <option key={item.locationId} value={item.locationId}>{item.code} - {item.name}</option>)}
            </select>
            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none">
              <option value="">Pilih Jenis Pelayanan</option>
              {productsByLocation.map((item) => <option key={item.productId} value={item.productId}>{item.code} - {item.name}</option>)}
            </select>
            <input value={form.nik} onChange={(e) => setForm({ ...form, nik: normalizeDigits(e.target.value) })} placeholder="NIK Pemohon" className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none" />
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })} placeholder="Nama Pemohon" className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none" />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectDark
                value={form.noKec}
                onChange={(e) => void handleKecamatanChange(e.target.value)}
                className="rounded-xl"
              >
                {kecamatanSelectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </SelectDark>
              <SelectDark
                value={form.noKel}
                onChange={(e) => handleKelurahanChange(e.target.value)}
                disabled={form.noKec === "0" || kelurahanLoadingKey === form.noKec}
                className="rounded-xl"
              >
                {kelurahanSelectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {kelurahanLoadingKey === form.noKec && opt.value === "0" ? "Memuat kelurahan..." : opt.label}
                  </option>
                ))}
              </SelectDark>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d+]/g, "").slice(0, 20) })} placeholder="No HP" className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none" />
            </div>
            <button onClick={() => void saveTracking()} disabled={saving} className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-black shadow-lg disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Simpan & Cetak Resi
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            {STATUSES.map((status) => (
              <div key={status} className={`rounded-2xl border p-4 ${statusClass(status)}`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-75">{statusLabel(status)}</p>
                <p className="mt-2 text-3xl font-bold">{summary[status] || 0}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-cyan-900/50 bg-[#05070d]/80 p-5 shadow-[0_0_34px_#00ffff22]">
            <div className="flex flex-wrap items-center gap-3">
              <DateRangePopup start={filters.start} end={filters.end} onChange={(start, end) => setFilters({ ...filters, start, end })} months={2} minWidth={660} />
              <select value={filters.locationId} onChange={(e) => setFilters({ ...filters, locationId: e.target.value })} className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50">
                <option value="">Semua Lokasi</option>
                {locations.map((item) => <option key={item.locationId} value={item.locationId}>{item.code} - {item.name}</option>)}
              </select>
              <select value={filters.productId} onChange={(e) => setFilters({ ...filters, productId: e.target.value })} className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50">
                <option value="">Semua Pelayanan</option>
                {filterProducts.map((item) => <option key={item.productId} value={item.productId}>{item.name}</option>)}
              </select>
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50">
                <option value="">Semua Status</option>
                {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
              </select>
              <input value={filters.petugas} onChange={(e) => setFilters({ ...filters, petugas: e.target.value })} placeholder="Petugas" className="w-32 rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50" />
              <input value={filters.nik} onChange={(e) => setFilters({ ...filters, nik: normalizeDigits(e.target.value) })} placeholder="NIK" className="w-40 rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50" />
              <input value={filters.registrationNo} onChange={(e) => setFilters({ ...filters, registrationNo: e.target.value.toUpperCase() })} placeholder="Nomor Registrasi" className="w-56 rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50" />
              <button onClick={() => void loadRows()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/30">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Filter
              </button>
              <button onClick={() => void loadRows()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-white/5 px-3 py-2 text-sm text-cyan-100">
                <RefreshCcw className="h-4 w-4" />
                Reload
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-cyan-900/50 bg-[#05070d]/80 p-5 shadow-[0_0_34px_#00ffff22]">
        <div className="mb-4 flex items-center gap-2 text-cyan-100">
          <Clock3 className="h-5 w-5 text-cyan-300" />
          <h2 className="text-sm font-semibold">Monitoring Pengajuan</h2>
        </div>
        {loading ? (
          <div className="py-8 text-center text-cyan-100/70"><Loader2 className="mx-auto h-5 w-5 animate-spin" /><p className="mt-2 text-xs">Memuat data...</p></div>
        ) : (
          <JQDataTable data={rows as any[]} columns={columns} pageLength={25} tableClassName="dt-cyberpunk" minWidth={1280} onApiReady={handleApiReady} />
        )}
      </section>

      <section className="rounded-3xl border border-cyan-900/50 bg-[#05070d]/80 p-5 shadow-[0_0_34px_#00ffff22]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-cyan-100">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
            <h2 className="text-sm font-semibold">Tracking</h2>
          </div>
          <div className="ml-auto flex flex-1 flex-wrap justify-end gap-2">
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && searchTracking()} placeholder="Nomor Registrasi atau NIK" className="min-w-64 rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50" />
            <button onClick={() => void searchTracking()} disabled={searching} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/30">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Cari
            </button>
          </div>
        </div>
        {searchRows.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {searchRows.map((item) => (
              <div key={item.trackingId} className="rounded-2xl border border-cyan-900/50 bg-[#0f172a]/80 p-4 text-sm text-cyan-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.registrationNo}</p>
                    <p className="text-xs text-cyan-100/60">{item.date}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClass(item.status)}`}>{item.statusLabel || statusLabel(item.status)}</span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-cyan-100/75">
                  <p>{item.name} - {item.nik}</p>
                  <p>{item.productName}</p>
                  <p>{item.locationName}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {statusModal ? (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-[#0b0f1c] p-5 shadow-[0_16px_40px_rgba(0,0,0,.55)]">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-300" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-cyan-50">Update Status</h3>
                <p className="mt-1 break-words text-xs text-cyan-100/65">{statusModal.row.registrationNo} - {statusModal.row.name}</p>
              </div>
              <button onClick={() => setStatusModal(null)} className="rounded-lg border border-cyan-800/50 p-2 text-cyan-100 hover:bg-white/10"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 grid gap-3">
              <select value={statusValue} onChange={(e) => setStatusValue(e.target.value as TrackingStatus)} className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50">
                {statusModal.next.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
              </select>
              <textarea value={statusDescription} onChange={(e) => setStatusDescription(e.target.value)} rows={3} placeholder="Keterangan perubahan status" className="resize-none rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none" />
              <button onClick={() => void updateStatus()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-500/30">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Simpan Status
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <NeonModal open={!!notice} kind={notice?.kind || "info"} title={notice?.title} message={notice?.message} onClose={() => setNotice(null)} />
    </div>
  );
}
