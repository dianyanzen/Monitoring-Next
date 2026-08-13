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
import { useSession } from "@/contexts/session";
import DateRangePopup from "@/components/ui/DateRangePopup";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";
import SelectDark from "@/components/ui/SelectDark";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import { filterLocationsByOffice } from "@/lib/tracking/office-location";

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
  noDok?: string;
  extraNote?: string;
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
  alamat: string;
  rw: string;
  rt: string;
  phone: string;
  email: string;
  notes?: string;
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
  createdBy?: string;
  productName: string;
  locationName: string;
  date: string;
  extraNote?: string;
  notes?: string;
  status: TrackingStatus;
  statusLabel?: string;
};

const emptyForm = {
  locationId: "",
  productId: "",
  noDok: "",
  isBbl: false,
  nik: "",
  name: "",
  noKec: "0",
  noKel: "0",
  kecamatan: "",
  kelurahan: "",
  alamat: "",
  rw: "",
  rt: "",
  phone: "",
  email: "",
  notes: "",
};

const emptyEditForm = {
  trackingId: "",
  registrationNo: "",
  locationId: "",
  productId: "",
  noDok: "",
  isBbl: false,
  nik: "",
  name: "",
  noKec: "0",
  noKel: "0",
  alamat: "",
  rw: "",
  rt: "",
  phone: "",
  email: "",
  notes: "",
};

const toLocalIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const normalizeDigits = (value: string, max = 16) => value.replace(/\D/g, "").slice(0, max);
const qrUrl = (value: string) => {
  const targetUrl = `https://disdukcapil.bandung.go.id/api/web/cekresi?resi=${encodeURIComponent(value)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=132x132&data=${encodeURIComponent(targetUrl)}`;
};

const RECEIPT_HEADER = {
  city: "PEMERINTAH KOTA BANDUNG",
  office: "DINAS KEPENDUDUKAN DAN PENCATATAN SIPIL",
  address: "Jalan Ambon Nomor 1B Kota Bandung, Jawa Barat 40115",
  phoneFax: "Telepon (022) 0224209891, Fax. (022) 4209891",
  websiteLabel: "https://disdukcapil.bandung.go.id/",
  websiteHref: "https://disdukcapil.bandung.go.id/",
  emailLabel: "disdukcapilkotabdg@gmail.com",
  emailHref: "mailto:disdukcapilkotabdg@gmail.com",
} as const;

const TRACKING_SUPERADMIN_USER = "ASSIST_YZ";
const BBL_EXTRA_NOTE = "BBL";

const actionIcons = {
  print: `<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V4h12v5"/><rect x="6" y="13" width="12" height="7" rx="2"/><path d="M6 17H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1"/><path d="M9 17h6"/></svg>`,
  edit: `<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  trash: `<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>`,
  status: `<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l3 2"/></svg>`,
} as const;

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

const NO_DOK_PRODUCT_NAMES = new Set([
  "BIODATA ANAK BERDASARKAN KEPEMILIKAN AKTA KELAHIRAN (BAKAK)",
  "BIODATA ANAK BERDASARKAN KEPEMILIKAN AKTA KELAHIRAN ORANG ASING (BAKAK)",
  "BIODATA PENDUDUK BERDASARKAN KEPEMILIKAN AKTA KEMATIAN (BPKAM)",
  "BIODATA PENDUDUK BERDASARKAN KEPEMILIKAN AKTA PENGAKUAN ANAK (BPKAKU)",
  "BIODATA PENDUDUK BERDASARKAN KEPEMILIKAN AKTA PERCERAIAN (BPKAC)",
  "BIODATA PENDUDUK BERDASARKAN KEPEMILIKAN AKTA PERKAWINAN (BPKAK)",
  "PEMBATALAN AKTA",
  "PEMBATALAN PINDAH ORANG ASING",
  "PEMBATALAN PINDAH WNI",
  "PEMBETULAN AKTA",
]);

function normalizeProductName(value: string) {
  return value.replace(/\s+/g, " ").trim().toUpperCase();
}

function isNoDokProduct(productName: string) {
  void productName;
  return true;
}

function isNikOptionalProduct(productName: string) {
  const normalized = normalizeProductName(productName);
  return normalized.includes("AKTA KELAHIRAN") || normalized.includes("AKTA KEMATIAN");
}

function isAktaKelahiranProduct(productName: string) {
  return normalizeProductName(productName).includes("AKTA KELAHIRAN");
}

function isGeraiLocationId(locationId: string | number | null | undefined) {
  const numeric = Number(locationId ?? 0);
  return numeric >= 31 && numeric <= 36;
}

function hasBblFlag(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase().includes(BBL_EXTRA_NOTE);
}

const DEFAULT_BABY_NIK = "327300000000000";

function toYmdCompact(value: string) {
  return value.replace(/[^\d]/g, "").slice(0, 8);
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
  const { user } = useSession();
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
  const [nikLookupLoading, setNikLookupLoading] = useState(false);
  const lastNikLookupRef = useRef("");
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
  const [quickTracking, setQuickTracking] = useState({
    locationId: "",
    productId: "",
    date: today,
    sequence: "",
  });
  const [searchRows, setSearchRows] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; row: TrackingRow | null }>({ open: false, row: null });
  const [deleting, setDeleting] = useState(false);
  const [statusModal, setStatusModal] = useState<{ row: TrackingRow; next: TrackingStatus[] } | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [selectedTrackingIds, setSelectedTrackingIds] = useState<number[]>([]);
  const [notice, setNotice] = useState<{ kind: ModalKind; title: string; message: string } | null>(null);
  const tableHostRef = useRef<HTMLElement | null>(null);

  const userLocationScope = useMemo(() => {
    const noKec = Number(user?.S_NO_KEC ?? 0);
    const noKab = Number(user?.S_NO_KAB ?? 0);
    return {
      isKecamatan: noKec > 0,
      isKabkota: noKab > 0 && noKec <= 0,
    };
  }, [user?.S_NO_KAB, user?.S_NO_KEC]);

  const sessionKecamatanCode = useMemo(() => {
    return String(user?.S_NO_KEC ?? "").replace(/\D/g, "").replace(/^0+/, "");
  }, [user?.S_NO_KEC]);

  const currentUserId = useMemo(() => String(user?.S_USER_ID || "").trim().toUpperCase(), [user?.S_USER_ID]);
  const isTrackingSuperadmin = useMemo(() => currentUserId === TRACKING_SUPERADMIN_USER, [currentUserId]);

  const canManageTracking = (createdBy?: string | null) => {
    if (isTrackingSuperadmin) return true;
    if (!currentUserId) return false;
    return String(createdBy || "").trim().toUpperCase() === currentUserId;
  };

  const isLocationProductSelected = Boolean(form.locationId && form.productId);
  const isNikEnabled = isLocationProductSelected;
  const isNikFilled = Boolean(form.nik.trim());

  const filteredLocations = useMemo(() => {
    if (isTrackingSuperadmin) return locations;
    return locations.filter((item) => {
      const type = String(item.type || "").trim().toUpperCase();
      const itemCode = String(item.code || "").replace(/\D/g, "").replace(/^0+/, "");
      if (userLocationScope.isKecamatan) {
        if (type !== "KECAMATAN") return false;
        if (!sessionKecamatanCode) return true;
        return itemCode === sessionKecamatanCode;
      }
      if (userLocationScope.isKabkota) return type !== "KECAMATAN";
      return true;
    });
  }, [locations, isTrackingSuperadmin, userLocationScope, sessionKecamatanCode]);

  const inputLocations = useMemo(() => {
    if (isTrackingSuperadmin) return filteredLocations;
    return filterLocationsByOffice(user?.S_NAMA_KANTOR, filteredLocations);
  }, [filteredLocations, isTrackingSuperadmin, user?.S_NAMA_KANTOR]);

  const productsByLocation = useMemo(() => {
    const locationId = Number(form.locationId || 0);
    if (!locationId) return [];
    const allowed = new Set(relations.filter((rel) => rel.locationId === locationId).map((rel) => rel.productId));
    return products.filter((product) => allowed.has(product.productId));
  }, [form.locationId, products, relations]);

  const selectedProduct = useMemo(
    () => products.find((item) => String(item.productId) === form.productId) || null,
    [products, form.productId]
  );

  const isNikOptionalInput = useMemo(() => {
    return !!selectedProduct && isNikOptionalProduct(selectedProduct.name);
  }, [selectedProduct]);

  const isBblEligible = useMemo(() => {
    return !!selectedProduct && isGeraiLocationId(form.locationId) && isAktaKelahiranProduct(selectedProduct.name);
  }, [selectedProduct, form.locationId]);

  const hasValidNikInput = form.nik.trim().length === 16;

  const isDetailFieldsEnabled = isLocationProductSelected && (isNikOptionalInput || isNikFilled);
  const isSaveEnabled = Boolean(
    form.locationId &&
    form.productId &&
    ((isNikOptionalInput && !form.isBbl) || hasValidNikInput) &&
    form.name.trim() &&
    form.noKec &&
    form.noKec !== "0" &&
    form.noKel &&
    form.noKel !== "0" &&
    form.alamat.trim() &&
    form.rw.trim() &&
    form.rt.trim() &&
    form.phone.trim() &&
    form.email.trim()
  );

  const showNoDokInput = useMemo(() => {
    return selectedProduct ? isNoDokProduct(selectedProduct.name) : false;
  }, [selectedProduct]);

  const filterProducts = useMemo(() => {
    const locationId = Number(filters.locationId || 0);
    if (!locationId) return products;
    const allowed = new Set(relations.filter((rel) => rel.locationId === locationId).map((rel) => rel.productId));
    return products.filter((product) => allowed.has(product.productId));
  }, [filters.locationId, products, relations]);

  const quickTrackingProducts = useMemo(() => {
    const locationId = Number(quickTracking.locationId || 0);
    if (!locationId) return products;
    const allowed = new Set(relations.filter((rel) => rel.locationId === locationId).map((rel) => rel.productId));
    return products.filter((product) => allowed.has(product.productId));
  }, [quickTracking.locationId, products, relations]);

  const quickTrackingRegistrationNo = useMemo(() => {
    const location = locations.find((item) => String(item.locationId) === quickTracking.locationId);
    const product = products.find((item) => String(item.productId) === quickTracking.productId);
    const ymd = toYmdCompact(quickTracking.date);
    const sequence = quickTracking.sequence.replace(/\D/g, "").slice(0, 3);
    if (!location || !product || ymd.length !== 8 || !sequence) return "";
    return `REG-${location.code}-${product.code}-${ymd}-${sequence.padStart(3, "0")}`.toUpperCase();
  }, [locations, products, quickTracking]);

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

  const editKelurahanOptions = useMemo(() => {
    return kelurahanCache[editForm.noKec] ?? [];
  }, [editForm.noKec, kelurahanCache]);

  const editSelectedProduct = useMemo(
    () => products.find((item) => String(item.productId) === editForm.productId) || null,
    [products, editForm.productId]
  );

  const showEditNoDokInput = useMemo(() => {
    return editSelectedProduct ? isNoDokProduct(editSelectedProduct.name) : false;
  }, [editSelectedProduct]);

  const isEditNikOptionalInput = useMemo(() => {
    return !!editSelectedProduct && isNikOptionalProduct(editSelectedProduct.name);
  }, [editSelectedProduct]);

  const isEditBblEligible = useMemo(() => {
    return !!editSelectedProduct && isGeraiLocationId(editForm.locationId) && isAktaKelahiranProduct(editSelectedProduct.name);
  }, [editSelectedProduct, editForm.locationId]);

  const hasValidEditNikInput = editForm.nik.trim().length === 16;

  const editKelurahanSelectOptions = useMemo(
    () => mergeOptions(editKelurahanOptions, true, "-- Pilih Kelurahan --"),
    [editKelurahanOptions]
  );

  const isEditSaveEnabled = Boolean(
    editForm.trackingId &&
      editForm.locationId &&
      editForm.productId &&
      ((isEditNikOptionalInput && !editForm.isBbl) || hasValidEditNikInput) &&
      editForm.name.trim() &&
      editForm.noKec &&
      editForm.noKec !== "0" &&
      editForm.noKel &&
      editForm.noKel !== "0" &&
      editForm.alamat.trim() &&
      editForm.rw.trim() &&
      editForm.rt.trim() &&
      editForm.phone.trim() &&
      editForm.email.trim()
  );

  const selectedTrackingSet = useMemo(() => new Set(selectedTrackingIds), [selectedTrackingIds]);
  const selectedOwnedRows = useMemo(
    () => rows.filter((row) => selectedTrackingSet.has(row.trackingId) && canManageTracking(row.createdBy)),
    [rows, selectedTrackingSet, currentUserId]
  );
  const allRowsSelected = useMemo(
    () => rows.length > 0 && rows.every((row) => selectedTrackingSet.has(row.trackingId)),
    [rows, selectedTrackingSet]
  );
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedTrackingSet.has(row.trackingId)),
    [rows, selectedTrackingSet]
  );

  const columns = useMemo(
    () => [
      { data: null, title: "No", render: (_: any, __: any, ___: any, meta: any) => meta.row + 1 },
      {
        data: null,
        title: `<input type="checkbox" class="select-all-tracking" aria-label="Pilih semua" ${allRowsSelected ? "checked" : ""} />`,
        orderable: false,
        width: "44px",
        className: "dt-body-center",
        render: (_: any, __: any, row: TrackingRow) =>
          `<input type="checkbox" class="row-select-tracking" data-id="${row.trackingId}" aria-label="Pilih ${row.registrationNo}" ${selectedTrackingSet.has(row.trackingId) ? "checked" : ""} />`,
      },
      {
        data: null,
        title: "Aksi",
        orderable: false,
        width: "188px",
        className: "dt-actions",
        render: (_: any, __: any, row: TrackingRow) => {
          const isOwner = canManageTracking(row.createdBy);
          const canUpdate = isOwner && nextStatuses(row.status).length > 0;
          const statusActionClass =
            row.status === "BERKAS_MASUK"
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-50 hover:bg-emerald-500/25"
              : row.status === "SELESAI"
              ? "border-blue-500/40 bg-blue-500/15 text-blue-50 hover:bg-blue-500/25"
              : "border-slate-600/40 bg-slate-500/10 text-slate-200 hover:bg-slate-500/20";
          const statusActionTitle =
            !isOwner
              ? "Hanya petugas penginput yang dapat mengubah status"
              : row.status === "BERKAS_MASUK"
              ? "Perbarui status (Selesai atau Batal)"
              : row.status === "SELESAI"
              ? "Perbarui status (Sudah Diambil)"
              : "Tidak ada aksi status lanjutan";
          return `
            <div class="grid min-w-[168px] grid-cols-4 gap-1">
              <button title="${isOwner ? "Cetak resi" : "Hanya petugas penginput yang dapat mencetak resi"}" aria-label="Cetak resi" class="btn-print-resi inline-flex h-8 w-8 items-center justify-center rounded-md border border-cyan-500/40 bg-cyan-500/15 text-cyan-50 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40" data-id="${row.trackingId}" ${isOwner ? "" : "disabled"}>${actionIcons.print}</button>
              <button title="${isOwner ? "Edit pengajuan" : "Hanya petugas penginput yang dapat mengedit"}" aria-label="Edit pengajuan" class="btn-edit-tracking inline-flex h-8 w-8 items-center justify-center rounded-md border border-sky-500/40 bg-sky-500/15 text-sky-50 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-40" data-id="${row.trackingId}" ${isOwner ? "" : "disabled"}>${actionIcons.edit}</button>
              <button title="${isOwner ? "Hapus pengajuan" : "Hanya petugas penginput yang dapat menghapus"}" aria-label="Hapus pengajuan" class="btn-delete-tracking inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-500/40 bg-rose-500/15 text-rose-50 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40" data-id="${row.trackingId}" ${isOwner ? "" : "disabled"}>${actionIcons.trash}</button>
              <button title="${statusActionTitle}" aria-label="${statusActionTitle}" class="btn-update-status inline-flex h-8 w-8 items-center justify-center rounded-md border transition ${statusActionClass} disabled:cursor-not-allowed disabled:opacity-40" data-id="${row.trackingId}" ${canUpdate ? "" : "disabled"}>${actionIcons.status}</button>
            </div>
          `;
        },
      },
      { data: "registrationNo", title: "No Registrasi" },
      { data: "nik", title: "NIK" },
      { data: "name", title: "Nama" },
      { data: "productName", title: "Jenis Pelayanan" },
      { data: "locationName", title: "Lokasi" },
      { data: "createdDate", title: "Tanggal" },
      { data: "createdTime", title: "Jam" },
      {
        data: "notes",
        title: "Catatan",
        render: (data: string) => {
          const value = String(data || "").trim();
          return value || "-";
        },
      },
      {
        data: "status",
        title: "Status",
        render: (data: string) => `<span class="inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(data)}">${statusLabel(data)}</span>`,
      },
      { data: "createdBy", title: "Petugas" },
    ],
    [allRowsSelected, selectedTrackingSet, currentUserId]
  );

  useEffect(() => {
    const activeIds = new Set(rows.map((row) => row.trackingId));
    setSelectedTrackingIds((prev) => prev.filter((id) => activeIds.has(id)));
  }, [rows]);

  useEffect(() => {
    const host = tableHostRef.current;
    if (!host) return;

    const headerChecks = Array.from(host.querySelectorAll("input.select-all-tracking")) as HTMLInputElement[];
    headerChecks.forEach((input) => {
      input.checked = allRowsSelected;
      input.indeterminate = !allRowsSelected && selectedRows.length > 0;
    });

    const rowChecks = Array.from(host.querySelectorAll("input.row-select-tracking")) as HTMLInputElement[];
    rowChecks.forEach((input) => {
      const id = Number(input.dataset.id || 0);
      input.checked = selectedTrackingSet.has(id);
    });
  }, [allRowsSelected, selectedRows.length, selectedTrackingSet]);

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

  async function fetchKelurahanOptions(value: string): Promise<WilayahOption[]> {
    if (!ktpelMeta || !value || value === "0") return [];
    if (kelurahanCache[value]) return kelurahanCache[value];

    setKelurahanLoadingKey(value);
    try {
      const params = new URLSearchParams({ no_kec: value });
      params.set("no_prop", ktpelMeta.defaults.noProp);
      params.set("no_kab", ktpelMeta.defaults.noKab);

      const res = await fetch(`/api/check/ktpel/kelurahan?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json().catch(() => ({}));
      const list: WilayahOption[] = json?.data?.kelurahan ?? json?.kelurahan ?? [];
      setKelurahanCache((prev) => ({ ...prev, [value]: list }));
      return list;
    } finally {
      setKelurahanLoadingKey(null);
    }
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

    try {
      await fetchKelurahanOptions(value);
    } catch (e: any) {
      setNotice({ kind: "error", title: "Kelurahan Gagal Dimuat", message: e?.message || "Gagal memuat daftar kelurahan" });
    }
  }

  async function lookupNikByValue(nik: string) {
    if (nik.length !== 16) return;
    setNikLookupLoading(true);

    try {
      const res = await fetch("/api/tracking-pengajuan/lookup-nik", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ nik }),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || json.success === false) {
        if (json.message) {
          setNotice({ kind: "error", title: "Lookup NIK Gagal", message: json.message });
        }
        return;
      }

      const data = json.data;
      if (!data?.found) return;

      const noKec = convertWilayahCode(String(data.noKec ?? "0"));
      const noKel = convertWilayahCode(String(data.noKel ?? "0"));
      const kecLabel = selectedWilayahLabel(kecamatanOptions, noKec);

      let kelLabel = "";
      if (noKec !== "0") {
        const list = await fetchKelurahanOptions(noKec);
        kelLabel = selectedWilayahLabel(list, noKel);
      }

      setForm((prev) => ({
        ...prev,
        nik: normalizeDigits(String(data.nik ?? prev.nik)),
        name: String(data.name ?? "").toUpperCase(),
        noKec,
        kecamatan: kecLabel,
        noKel,
        kelurahan: kelLabel,
        alamat: String(data.alamat ?? prev.alamat).toUpperCase(),
        rw: String(data.rw ?? prev.rw),
        rt: String(data.rt ?? prev.rt),
      }));
    } catch (e: any) {
      setNotice({ kind: "error", title: "Lookup NIK Gagal", message: e?.message || "Gagal mencari data NIK" });
    } finally {
      setNikLookupLoading(false);
    }
  }

  useEffect(() => {
    const normalized = normalizeDigits(form.nik);
    if (normalized.length !== 16) {
      lastNikLookupRef.current = "";
      return;
    }
    if (lastNikLookupRef.current === normalized) return;
    lastNikLookupRef.current = normalized;
    void lookupNikByValue(normalized);
  }, [form.nik]);

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
    const intervalId = window.setInterval(() => {
      void loadRows();
    }, 300000);
    return () => window.clearInterval(intervalId);
  }, [filters]);

  useEffect(() => {
    if (form.productId && !productsByLocation.some((item) => String(item.productId) === form.productId)) {
      setForm((prev) => ({ ...prev, productId: "" }));
    }
  }, [form.locationId, productsByLocation]);

  useEffect(() => {
    if (!isBblEligible && form.isBbl) {
      setForm((prev) => ({ ...prev, isBbl: false }));
    }
  }, [isBblEligible, form.isBbl]);

  useEffect(() => {
    if (!isEditBblEligible && editForm.isBbl) {
      setEditForm((prev) => ({ ...prev, isBbl: false }));
    }
  }, [isEditBblEligible, editForm.isBbl]);

  useEffect(() => {
    if (form.locationId && !inputLocations.some((item) => String(item.locationId) === form.locationId)) {
      setForm((prev) => ({ ...prev, locationId: "", productId: "" }));
    }
  }, [form.locationId, inputLocations]);

  useEffect(() => {
    if (filters.productId && !filterProducts.some((item) => String(item.productId) === filters.productId)) {
      setFilters((prev) => ({ ...prev, productId: "" }));
    }
  }, [filters.locationId, filterProducts]);

  useEffect(() => {
    if (quickTracking.productId && !quickTrackingProducts.some((item) => String(item.productId) === quickTracking.productId)) {
      setQuickTracking((prev) => ({ ...prev, productId: "" }));
    }
  }, [quickTracking.productId, quickTrackingProducts]);

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

    const headerChecks = Array.from(container.querySelectorAll("input.select-all-tracking")) as HTMLInputElement[];
    headerChecks.forEach((input) => {
      input.checked = allRowsSelected;
      input.indeterminate = !allRowsSelected && selectedRows.length > 0;
    });
    const rowChecks = Array.from(container.querySelectorAll("input.row-select-tracking")) as HTMLInputElement[];
    rowChecks.forEach((input) => {
      const id = Number(input.dataset.id || 0);
      input.checked = selectedTrackingSet.has(id);
    });
  };

  const onTableClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const rowSelect = target.closest("input.row-select-tracking") as HTMLInputElement | null;
    if (rowSelect) {
      const id = Number(rowSelect.dataset.id || 0);
      if (!id) return;
      setSelectedTrackingIds((prev) => {
        if (rowSelect.checked) {
          if (prev.includes(id)) return prev;
          return [...prev, id];
        }
        return prev.filter((item) => item !== id);
      });
      return;
    }
    const selectAll = target.closest("input.select-all-tracking") as HTMLInputElement | null;
    if (selectAll) {
      if (selectAll.checked) {
        setSelectedTrackingIds(rows.map((row) => row.trackingId));
      } else {
        setSelectedTrackingIds([]);
      }
      return;
    }
    const printBtn = target.closest("[data-id].btn-print-resi") as HTMLElement | null;
    const editBtn = target.closest("[data-id].btn-edit-tracking") as HTMLElement | null;
    const deleteBtn = target.closest("[data-id].btn-delete-tracking") as HTMLElement | null;
    const statusBtn = target.closest("[data-id].btn-update-status") as HTMLButtonElement | null;
    if (printBtn) {
      const row = rows.find((item) => item.trackingId === Number(printBtn.dataset.id));
      if (row && canManageTracking(row.createdBy)) {
        printReceipt(row);
      } else {
        setNotice({ kind: "error", title: "Akses Ditolak", message: "Hanya petugas penginput yang dapat mencetak resi." });
      }
      return;
    }
    if (editBtn) {
      const row = rows.find((item) => item.trackingId === Number(editBtn.dataset.id));
      if (row && canManageTracking(row.createdBy)) {
        void openEditModal(row.trackingId);
      } else {
        setNotice({ kind: "error", title: "Akses Ditolak", message: "Hanya petugas penginput yang dapat mengedit." });
      }
      return;
    }
    if (deleteBtn) {
      const row = rows.find((item) => item.trackingId === Number(deleteBtn.dataset.id));
      if (row && canManageTracking(row.createdBy)) {
        openDeleteModal(row);
      } else {
        setNotice({ kind: "error", title: "Akses Ditolak", message: "Hanya petugas penginput yang dapat menghapus." });
      }
      return;
    }
    if (statusBtn && !statusBtn.disabled) {
      const row = rows.find((item) => item.trackingId === Number(statusBtn.dataset.id));
      if (!row) return;
      if (!canManageTracking(row.createdBy)) {
        setNotice({ kind: "error", title: "Akses Ditolak", message: "Hanya petugas penginput yang dapat memperbarui status." });
        return;
      }
      openStatusModal(row);
    }
  };

  useEffect(() => () => detachTableClick(), []);

  function toggleSelectAllRows() {
    if (!rows.length) return;
    setSelectedTrackingIds(allRowsSelected ? [] : rows.map((row) => row.trackingId));
  }

  function escapeForSrcDoc(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function printSelectedRows() {
    if (!selectedRows.length) {
      setNotice({ kind: "error", title: "Belum Ada Pilihan", message: "Pilih minimal satu pengajuan untuk dicetak." });
      return;
    }

    if (!selectedOwnedRows.length) {
      setNotice({ kind: "error", title: "Akses Ditolak", message: "Tidak ada data milik Anda pada pilihan saat ini untuk dicetak." });
      return;
    }

    const docs = selectedOwnedRows
      .map((row) => printReceipt(row, { returnHtml: true, autoPrint: false }))
      .filter((item): item is string => typeof item === "string" && item.length > 0);

    if (!docs.length) {
      setNotice({ kind: "error", title: "Cetak Gagal", message: "Dokumen resi tidak berhasil dibentuk." });
      return;
    }

    const bulkWin = window.open("", "_blank", "width=980,height=900");
    if (!bulkWin) {
      setNotice({ kind: "error", title: "Popup Diblokir", message: "Izinkan popup browser lalu coba cetak massal lagi." });
      return;
    }

    const pages = docs
      .map(
        (doc) =>
          `<section class="bulk-page"><iframe class="bulk-frame" srcdoc="${escapeForSrcDoc(doc)}" loading="eager"></iframe></section>`
      )
      .join("");

    const bulkHtml = `<!doctype html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Cetak Massal Resi</title>
        <style>
          *{box-sizing:border-box}
          @page{size:A4 portrait;margin:0}
          html,body{margin:0;padding:0;background:#fff}
          body{width:210mm}
          .bulk-page{page-break-after:always;break-after:page;width:210mm;height:297mm;overflow:hidden;display:block}
          .bulk-page:last-child{page-break-after:auto;break-after:auto}
          .bulk-frame{display:block;width:210mm;height:297mm;border:0;overflow:hidden}
          @media print{
            html,body{margin:0;padding:0;width:210mm}
            .bulk-page{page-break-after:always;break-after:page}
            .bulk-page:last-child{page-break-after:auto;break-after:auto}
          }
        </style>
      </head>
      <body>
        ${pages}
        <script>
          window.onload = function () {
            const frames = Array.from(document.querySelectorAll('.bulk-frame'));
            if (!frames.length) {
              setTimeout(() => window.print(), 250);
              return;
            }
            let loaded = 0;
            const done = function () {
              loaded += 1;
              if (loaded >= frames.length) {
                setTimeout(() => window.print(), 300);
              }
            };
            frames.forEach((frame) => {
              frame.addEventListener('load', done, { once: true });
            });
          };
        </script>
      </body>
      </html>`;

    bulkWin.document.open();
    bulkWin.document.write(bulkHtml);
    bulkWin.document.close();

    setNotice({
      kind: "success",
      title: "Cetak Massal Diproses",
      message: `${selectedOwnedRows.length} pengajuan diproses dalam satu dokumen cetak. Simpan sebagai PDF untuk mendapatkan 1 file multi-halaman.`,
    });
  }

  async function completeSelectedRows() {
    const candidates = selectedOwnedRows.filter((row) => row.status === "BERKAS_MASUK");
    if (!candidates.length) {
      setNotice({ kind: "error", title: "Tidak Ada Yang Bisa Diselesaikan", message: "Hanya pengajuan berstatus Berkas Masuk yang dapat diselesaikan massal." });
      return;
    }

    setSaving(true);
    try {
      const results = await Promise.all(
        candidates.map(async (row) => {
          const res = await fetch(`/api/tracking-pengajuan/${row.trackingId}/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ status: "SELESAI", description: "" }),
          });
          const json = await res.json().catch(() => ({}));
          return {
            id: row.trackingId,
            ok: res.ok && json.success !== false,
            message: json.message || "",
          };
        })
      );

      const successCount = results.filter((item) => item.ok).length;
      const failed = results.filter((item) => !item.ok);
      await loadRows();
      setSelectedTrackingIds((prev) => prev.filter((id) => failed.some((item) => item.id === id)));

      if (failed.length) {
        setNotice({
          kind: "error",
          title: "Selesai Massal Sebagian",
          message: `${successCount} berhasil, ${failed.length} gagal. Cek status terbaru di tabel lalu ulangi untuk data yang gagal.`,
        });
      } else {
        setNotice({
          kind: "success",
          title: "Selesai Massal Berhasil",
          message: `${successCount} pengajuan berhasil diubah menjadi Selesai.`,
        });
      }
    } catch (e: any) {
      setNotice({ kind: "error", title: "Selesai Massal Gagal", message: e?.message || "Gagal menyelesaikan pengajuan massal" });
    } finally {
      setSaving(false);
    }
  }

  function resetTrackingForm() {
    setForm(emptyForm);
    lastNikLookupRef.current = "";
  }

  async function openEditModal(trackingId: number) {
    setEditLoading(true);
    setEditModalOpen(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/tracking-pengajuan/${trackingId}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat detail pengajuan");

      const item = json.data?.item;
      if (!item) throw new Error("Data pengajuan tidak ditemukan");

      const noKec = convertWilayahCode(String(item.noKec ?? item.kecamatan ?? "0"));
      const noKel = convertWilayahCode(String(item.noKel ?? item.kelurahan ?? "0"));

      if (noKec !== "0") {
        await fetchKelurahanOptions(noKec);
      }

      setEditForm({
        trackingId: String(trackingId),
        registrationNo: String(item.registrationNo ?? ""),
        locationId: String(item.locationId ?? ""),
        productId: String(item.productId ?? ""),
        noDok: String(item.noDok ?? ""),
        isBbl: hasBblFlag(String(item.extraNote ?? "")),
        nik: normalizeDigits(String(item.nik ?? "")),
        name: String(item.name ?? item.applicantName ?? "").toUpperCase(),
        noKec,
        noKel,
        alamat: String(item.alamat ?? "").toUpperCase(),
        rw: String(item.noRw ?? item.rw ?? ""),
        rt: String(item.noRt ?? item.rt ?? ""),
        phone: String(item.phone ?? ""),
        email: String(item.email ?? ""),
        notes: String(item.notes ?? ""),
      });
    } catch (e: any) {
      setEditModalOpen(false);
      setNotice({ kind: "error", title: "Edit Gagal", message: e?.message || "Gagal membuka data untuk diedit" });
    } finally {
      setEditLoading(false);
    }
  }

  function closeEditModal() {
    if (editLoading || editSaving) return;
    setEditModalOpen(false);
    setEditForm(emptyEditForm);
  }

  function openDeleteModal(row: TrackingRow) {
    setDeleteModal({ open: true, row });
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteModal({ open: false, row: null });
  }

  function openStatusModal(row: TrackingRow) {
    const next = nextStatuses(row.status);
    setStatusModal({ row, next });
    setStatusNote("");
  }

  async function resolveTrackingRow(trackingId: number) {
    const fromTable = rows.find((item) => item.trackingId === trackingId);
    if (fromTable) return fromTable;

    const res = await fetch(`/api/tracking-pengajuan/${trackingId}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat detail pengajuan");
    const item = json.data?.item;
    if (!item) throw new Error("Data pengajuan tidak ditemukan");

    return {
      trackingId: Number(item.trackingId ?? trackingId),
      registrationNo: String(item.registrationNo ?? ""),
      noDok: String(item.noDok ?? ""),
      extraNote: String(item.extraNote ?? ""),
      locationId: Number(item.locationId ?? 0),
      locationCode: String(item.locationCode ?? ""),
      locationName: String(item.locationName ?? ""),
      productId: Number(item.productId ?? 0),
      productCode: String(item.productCode ?? ""),
      productName: String(item.productName ?? ""),
      nik: String(item.nik ?? ""),
      name: String(item.name ?? item.applicantName ?? ""),
      kecamatan: String(item.kecamatan ?? item.noKec ?? ""),
      kelurahan: String(item.kelurahan ?? item.noKel ?? ""),
      alamat: String(item.alamat ?? ""),
      rw: String(item.noRw ?? item.rw ?? ""),
      rt: String(item.noRt ?? item.rt ?? ""),
      phone: String(item.phone ?? ""),
      email: String(item.email ?? ""),
      notes: String(item.notes ?? ""),
      status: String(item.status ?? "BERKAS_MASUK") as TrackingStatus,
      statusLabel: String(item.statusLabel ?? ""),
      createdBy: String(item.createdBy ?? ""),
      createdDate: String(item.createdDate ?? ""),
      createdTime: String(item.createdTime ?? ""),
    } as TrackingRow;
  }

  async function handleEditKecamatanChange(value: string) {
    setEditForm((prev) => ({
      ...prev,
      noKec: value,
      noKel: "0",
    }));
    if (value === "0" || kelurahanCache[value]) return;
    try {
      await fetchKelurahanOptions(value);
    } catch (e: any) {
      setNotice({ kind: "error", title: "Kelurahan Gagal Dimuat", message: e?.message || "Gagal memuat daftar kelurahan" });
    }
  }

  async function submitEditTracking() {
    const trackingId = Number(editForm.trackingId || 0);
    if (!trackingId) return;

    setEditSaving(true);
    setNotice(null);
    try {
      const payload = {
        locationId: editForm.locationId,
        productId: editForm.productId,
        noDok: showEditNoDokInput ? editForm.noDok : "",
        extraNote: editForm.isBbl ? BBL_EXTRA_NOTE : "",
        nik: editForm.nik,
        applicantName: editForm.name,
        noKec: editForm.noKec,
        noKel: editForm.noKel,
        alamat: editForm.alamat,
        noRw: editForm.rw,
        noRt: editForm.rt,
        phone: editForm.phone,
        email: editForm.email,
        source: "MANUAL",
        notes: editForm.notes || "",
      };

      const res = await fetch(`/api/tracking-pengajuan/${trackingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memperbarui pengajuan");

      const registrationNo = String(json.data?.item?.registrationNo || editForm.registrationNo || "-");
      setEditModalOpen(false);
      setEditForm(emptyEditForm);
      setNotice({
        kind: "success",
        title: "Pengajuan Diperbarui",
        message: `Nomor registrasi ${registrationNo} berhasil diperbarui.`,
      });
      await loadRows();
    } catch (e: any) {
      setNotice({ kind: "error", title: "Gagal Update", message: e?.message || "Gagal memperbarui pengajuan" });
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteTracking(row: TrackingRow) {
    setDeleting(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/tracking-pengajuan/${row.trackingId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menghapus pengajuan");
      setDeleteModal({ open: false, row: null });
      setNotice({ kind: "success", title: "Pengajuan Dihapus", message: json.message || "Data pengajuan berhasil dihapus" });
      await loadRows();
      if (searchRows.length) {
        setSearchRows((prev) => prev.filter((item) => item.trackingId !== row.trackingId));
      }
    } catch (e: any) {
      setNotice({ kind: "error", title: "Gagal Hapus", message: e?.message || "Gagal menghapus pengajuan" });
    } finally {
      setDeleting(false);
    }
  }

  async function saveTracking() {
    setSaving(true);
    setNotice(null);
    try {
      const payload = {
        locationId: form.locationId,
        productId: form.productId,
        noDok: showNoDokInput ? form.noDok : "",
        extraNote: form.isBbl ? BBL_EXTRA_NOTE : "",
        nik: form.nik,
        applicantName: form.name,
        noKec: form.noKec,
        noKel: form.noKel,
        alamat: form.alamat,
        noRw: form.rw,
        noRt: form.rt,
        phone: form.phone,
        email: form.email,
        source: "MANUAL",
        notes: form.notes || "",
      };
      const res = await fetch("/api/tracking-pengajuan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menyimpan pengajuan");
      const item = (json.data?.item || {}) as Partial<TrackingRow>;
      const registrationNo = item.registrationNo || form.nik || "-";
      resetTrackingForm();
      setNotice({
        kind: "success",
        title: "Pengajuan Disimpan",
        message: `Nomor registrasi ${registrationNo} berhasil dibuat. Silakan cetak resi dari tombol Resi di tabel.`,
      });
      await loadRows();
    } catch (e: any) {
      setNotice({ kind: "error", title: "Gagal Menyimpan", message: e?.message || "Gagal menyimpan pengajuan" });
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(nextStatus: TrackingStatus) {
    if (!statusModal) return;
    const cleanNote = statusNote.trim();
    if (nextStatus === "BATAL" && !cleanNote) {
      setNotice({ kind: "error", title: "Catatan Wajib", message: "Catatan petugas wajib diisi untuk status Batal." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/tracking-pengajuan/${statusModal.row.trackingId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ status: nextStatus, description: cleanNote }),
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

  async function searchTrackingByQuery(query: string) {
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: query.trim() });
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

  async function searchTracking() {
    const query = searchTerm.trim();
    if (!query) {
      setNotice({ kind: "error", title: "Pencarian Kosong", message: "Masukkan Nomor Registrasi atau NIK terlebih dahulu." });
      return;
    }
    await searchTrackingByQuery(query);
  }

  async function searchTrackingBySequence() {
    if (!quickTrackingRegistrationNo) {
      setNotice({
        kind: "error",
        title: "Data Tracking Cepat Belum Lengkap",
        message: "Pilih lokasi, produk, tanggal, dan isi no urut untuk membentuk nomor registrasi.",
      });
      return;
    }
    setSearchTerm(quickTrackingRegistrationNo);
    await searchTrackingByQuery(quickTrackingRegistrationNo);
  }

  async function handleSearchCardPrint(trackingId: number) {
    try {
      const row = await resolveTrackingRow(trackingId);
      printReceipt(row);
    } catch (e: any) {
      setNotice({ kind: "error", title: "Gagal Cetak", message: e?.message || "Gagal memuat data untuk cetak" });
    }
  }

  async function handleSearchCardStatus(trackingId: number) {
    try {
      const row = await resolveTrackingRow(trackingId);
      openStatusModal(row);
    } catch (e: any) {
      setNotice({ kind: "error", title: "Gagal Memuat Status", message: e?.message || "Gagal memuat data untuk update status" });
    }
  }

  function getLocationLabel(row: TrackingRow) {
    if (row.locationId >= 1 && row.locationId <= 30) {
      return `KECAMATAN ${row.locationName}`;
    }
    if (row.locationId >= 31 && row.locationId <= 36) {
      return `GEULIS ${row.locationName}`;
    }
    if (row.locationCode === "99" || row.locationName?.toUpperCase() === "DINAS") {
      return "DINAS KEPENDUDUKAN DAN PENCATATAN SIPIL KOTA BANDUNG";
    }
    return row.locationName;
  }

  function formatProductHeading(productName: string) {
    const normalized = productName?.trim()?.toUpperCase() || "";
    if (normalized.includes("KARTU IDENTITAS ANAK")) {
      return "KARTU IDENTITAS ANAK (KIA)";
    }
    return productName;
  }

  function printReceipt(row: TrackingRow, opts?: { returnHtml?: boolean; autoPrint?: boolean }) {
    const shouldReturnHtml = opts?.returnHtml === true;
    const shouldAutoPrint = opts?.autoPrint !== false;
    const win = shouldReturnHtml ? null : window.open("", "_blank", "width=760,height=980");
    if (!shouldReturnHtml && !win) return;

    const productName = (row.productName || "").trim().toUpperCase();
    const noDokInput = String(row.noDok || "").trim();
    const isBbl = hasBblFlag(row.extraNote);
    const isKelahiran = productName.includes("KELAHIRAN");
    const isKematian = productName.includes("KEMATIAN");
    const hideNikOnReceipt = !isBbl && (isKelahiran || isKematian) && (!row.nik || row.nik.trim() === "" || row.nik.trim() === DEFAULT_BABY_NIK);
    const isDinasLocation = row.locationCode === "99" || row.locationName?.toUpperCase() === "DINAS";
    const isGeraiLocation = row.locationId >= 31 && row.locationId <= 36;
    const nikDisplayLabel = isKelahiran ? "NIK Bayi" : isKematian ? "NIK Almarhum" : "NIK Pemohon";
    const namaDisplayLabel = isKelahiran ? "Nama Bayi" : isKematian ? "Nama Almarhum" : "Nama Pemohon";
    const isPindahKeluar = ["PINDAH KELUAR", "SURAT PINDAH", "SKPWNI"].some((keyword) => productName.includes(keyword));
    const isKtpelOrIkdService = [
      "KTP-EL",
      "KTP EL",
      "KTPEL",
      "KTP ELEKTRONIK",
      "PEREKAMAN KTP",
      "PENCETAKAN KTP",
      "IKD",
      "IDENTITAS KEPENDUDUKAN DIGITAL",
    ].some((keyword) => productName.includes(keyword));
    const isKiaService = ["KIA", "KARTU IDENTITAS ANAK"].some((keyword) => productName.includes(keyword));
    const isDinasPengambilan = [
      "PENERBITAN KEMBALI AKTA",
      "PENERBITAN ULANG",
      "PINDAH KELUAR",
      "NON PERMANEN",
      "PELAPORAN LUAR NEGERI",
      "WNA",
      "PERBAIKAN AKTA",
      "PEMBATALAN AKTA",
      "PEMBATALAN",
      "CATATAN PINGGIR",
      "PENGESAHAN ANAK",
      "PENGANGKATAN ANAK",
      "PENGAKUAN ANAK",
      "PEMBETULAN",
    ].some((keyword) => productName.includes(keyword));
    const useLegacyDinasReceipt = false;

    const formatShortDate = (value?: string | null) => {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "2-digit" }).format(date).replace(".", "").replace(".", "");
    };

    const formatBandungDate = (value?: string | null) => {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(date);
    };

    const formatDateForDisplay = (value?: string | null) => {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(date);
    };

    if (useLegacyDinasReceipt && isDinasPengambilan) {
      const nomorResi = row.registrationNo || "-";
      const noNik = row.nik || "-";
      const namaPemohon = row.name || "-";
      const tanggalSelesai = formatDateForDisplay(row.createdDate || new Date().toISOString());
      const tanggalBandung = formatDateForDisplay(row.createdDate || new Date().toISOString());

      const html = `<!doctype html>
        <html>
        <head>
          <meta charset="UTF-8" />
          <title>Resi Pengambilan ${nomorResi}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              background: #dfe4ea;
              font-family: Arial, Helvetica, sans-serif;
              color: #000;
            }
            .page {
              width: 900px;
              margin: 18px auto;
              background: #fff;
              border: 2px solid #000;
              padding: 0;
            }
            .header {
              width: 100%;
              display: flex;
              align-items: center;
              border-bottom: 2px solid #000;
              min-height: 92px;
            }
            .logo-box {
              width: 120px;
              min-height: 92px;
              border-right: 2px solid #000;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #f3f3f3;
              font-size: 12px;
              font-weight: 800;
            }
            .header-text {
              flex: 1;
              text-align: center;
              padding: 10px 16px;
            }
            .header-text h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 900;
              line-height: 1.2;
              letter-spacing: .03em;
            }
            .header-text h2 {
              margin: 4px 0 0;
              font-size: 18px;
              font-weight: 900;
              line-height: 1.2;
            }
            .header-text .alamat {
              margin-top: 8px;
              font-size: 12px;
              font-weight: 700;
            }
            .header-text .contact {
              margin-top: 4px;
              font-size: 12px;
              font-weight: 700;
            }
            .header-text .link-row {
              margin-top: 4px;
              font-size: 12px;
              font-weight: 700;
            }
            .header-text .link-row a {
              color: inherit;
              text-decoration: underline;
            }
            .content {
              padding: 14px 18px 10px;
            }
            .title {
              text-align: center;
              font-size: 26px;
              font-weight: 900;
              margin-top: 8px;
              text-transform: uppercase;
            }
            .subtitle {
              text-align: center;
              font-size: 11px;
              font-weight: 700;
              margin-top: 6px;
              line-height: 1.4;
            }
            .table-wrap {
              margin-top: 12px;
              border: 1px solid #000;
            }
            .info-table {
              width: 100%;
              border-collapse: collapse;
            }
            .info-table td {
              border: 1px solid #000;
              padding: 8px 8px;
              font-size: 14px;
              vertical-align: middle;
            }
            .info-table .label {
              width: 150px;
              font-weight: 700;
            }
            .info-table .value {
              font-weight: 700;
            }
            .date-row {
              display: grid;
              grid-template-columns: 1fr auto;
              align-items: end;
              margin-top: 10px;
              min-height: 54px;
              font-size: 16px;
              font-weight: 700;
            }
            .date-row .left {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .date-row .right {
              text-align: right;
              padding-right: 12px;
            }
            .qr-row {
              display: grid;
              grid-template-columns: 1fr 160px;
              align-items: end;
              margin-top: 10px;
            }
            .qr-box {
              width: 122px;
              height: 122px;
              border: 1px solid #000;
              display: grid;
              place-items: center;
              margin-left: auto;
              background: #fafafa;
              font-size: 10px;
              font-weight: 700;
            }
            .qr-box-inner {
              width: 92px;
              height: 92px;
              border: 2px solid #000;
              display: grid;
              place-items: center;
              background: repeating-conic-gradient(
                from 0deg,
                #000 0deg 8deg,
                #fff 8deg 16deg
              );
            }
            .loket {
              text-align: right;
              padding: 4px 8px 0 0;
              font-size: 14px;
              font-weight: 700;
            }
            .note-box {
              margin-top: 14px;
              border: 2px solid #000;
              padding: 8px 10px;
            }
            .note-box .title-note {
              font-size: 18px;
              font-weight: 900;
              margin-bottom: 8px;
            }
            .note-box ul {
              margin: 0;
              padding-left: 18px;
              font-size: 12px;
              line-height: 1.6;
            }
            .footer-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              gap: 18px;
              margin-top: 12px;
              font-size: 12px;
              font-weight: 700;
              border-top: 1px solid #000;
              padding-top: 8px;
            }
            @media print {
              body { margin: 0; background: #fff; }
              .page { margin: 0; border: none; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div class="logo-box">Logo</div>
              <div class="header-text">
                <h1>${RECEIPT_HEADER.city}</h1>
                <h2>${RECEIPT_HEADER.office}</h2>
                <div class="alamat">${RECEIPT_HEADER.address}</div>
                <div class="contact">${RECEIPT_HEADER.phoneFax}</div>
                <div class="link-row">Laman : <a href="${RECEIPT_HEADER.websiteHref}" target="_blank" rel="noreferrer">${RECEIPT_HEADER.websiteLabel}</a>, Pos-el : <a href="${RECEIPT_HEADER.emailHref}">${RECEIPT_HEADER.emailLabel}</a></div>
              </div>
            </div>

            <div class="content">
              <div class="title">RESI PENGAMBILAN</div>
              <div class="subtitle">(Penerbitan Ulang , Pindah Keluar, Pelaporan Luar Negeri, WNA, Catatan Pinggir, Pembedtulan)</div>

              <div class="table-wrap">
                <table class="info-table">
                  ${noDokInput ? `<tr><td class="label">No. Dokumen</td><td class="value">: ${noDokInput}</td></tr>` : ""}
                  ${hideNikOnReceipt ? "" : `<tr><td class="label">${nikDisplayLabel}</td><td class="value">: ${noNik}</td></tr>`}
                  <tr>
                    <td class="label">${namaDisplayLabel}</td>
                    <td class="value">: ${namaPemohon}</td>
                  </tr>
                  <tr>
                    <td class="label">Tanggal Selesai</td>
                    <td class="value">: ${tanggalSelesai}</td>
                  </tr>
                </table>
              </div>

              <div class="date-row">
                <div class="left"></div>
                <div class="right">Bandung, ${tanggalBandung}</div>
              </div>

              <div class="qr-row">
                <div></div>
                <div>
                  <div class="qr-box">
                    <div class="qr-box-inner"></div>
                  </div>
                  <div class="loket">Loket G</div>
                </div>
              </div>

              <div class="footer-row">
                <div>Layanan Pengaduan 0852-0888-1945</div>
                <div></div>
              </div>

              <div class="note-box">
                <div class="title-note">CATATAN:</div>
                <ul>
                  ${
                    isKiaService
                      ? `<li>Jika Anda sudah menerima email <strong>SIAK Online</strong> dari <strong>Ditjen Dukcapil Kemendagri</strong>, silakan <strong>pindai atau klik QR Code yang terdapat pada email tersebut</strong> untuk mengakses dokumen KIA.</li>
                  <li>Untuk pencetakan KIA, masyarakat dapat <strong>memilih cara yang paling sesuai dan mudah</strong>, baik dengan mencetak secara mandiri melalui <strong>Anjungan Dukcapil Mandiri (ADM)</strong> terdekat, mencetak melalui <strong>Gerai Geulis</strong> terdekat, maupun mengambil KIA melalui <strong>Loket Pengambilan Disdukcapil</strong> dengan membawa <strong>resi asli</strong> ini.</li>
                  <li>Untuk memperoleh informasi lebih lanjut atau menyampaikan pengaduan, silakan menghubungi <strong>Call Center 0852-0888-1945</strong>.</li>`
                      : isKtpelOrIkdService
                      ? `<li><strong>Cek Status Pencetakan KTP-el:</strong> Klik <strong><a href="${RECEIPT_HEADER.websiteHref}" target="_blank" rel="noreferrer">${RECEIPT_HEADER.websiteLabel}</a></strong> lalu pilih <strong>Pencetakan KTP-el</strong>.</li>
                  <li>Untuk memperoleh informasi lebih lanjut atau menyampaikan pengaduan, silakan menghubungi <strong>Call Center 0852-0888-1945</strong>.</li>`
                      : `<li>Jika Anda sudah menerima email <strong>SIAK Online</strong> dari <strong>Ditjen Dukcapil Kemendagri</strong>, silakan <strong>pindai atau klik QR CODE</strong> yang terdapat pada email tersebut untuk mengakses dokumen.</li>
                  <li>Dokumen dapat <strong>dicetak secara mandiri</strong> menggunakan kertas <strong>HVS ukuran A4 80 gram</strong>.</li>
                  ${isBbl ? '<li>Untuk keperluan pendaftaran atau pelayanan <strong>BPJS Kesehatan</strong> bagi bayi baru lahir, resi ini dapat ditunjukkan sebagai dokumen pendukung.</li>' : ""}
                  ${isDinasLocation ? '<li>Jika hingga <strong>jangka waktu penyelesaian</strong> berakhir Anda belum menerima <strong>email SIAK Online dari Ditjen Dukcapil Kemendagri</strong>, silakan mendatangi <strong>Loket Pengambilan Disdukcapil</strong> dengan membawa <strong>resi asli</strong> ini.</li>' : ""}
                  ${isGeraiLocation && isKematian ? `<li>Apabila terdapat kekeliruan pada <strong>Penerbitan Kutipan Akta Kematian</strong> dan email belum diterima dalam <strong>jangka waktu penyelesaian</strong>, mohon segera melapor ke <strong>${row.locationName}</strong>.</li>` : ""}
                  ${isPindahKeluar ? '<li>Khusus permohonan <strong>Surat Pindah/SKPWNI</strong>, dokumen berlaku selama <strong>60 (enam puluh) hari sejak tanggal diterbitkan</strong>.</li>' : ""}
                  <li>Untuk memperoleh informasi lebih lanjut atau menyampaikan pengaduan, silakan menghubungi <strong>Call Center 0852-0888-1945</strong>.</li>`
                  }
                </ul>
              </div>
            </div>
          </div>
          ${
            shouldAutoPrint
              ? `<script>
            window.onload = function () {
              setTimeout(() => window.print(), 250);
            };
          </script>`
              : ""
          }
        </body>
        </html>`;

      if (shouldReturnHtml) return html;
      win!.document.open();
      win!.document.write(html);
      win!.document.close();
      return;
    }

    const locationLabel = getLocationLabel(row);
    const productHeading = formatProductHeading(row.productName);
    const rt = String(row.rt ?? 0).padStart(3, "0");
    const rw = String(row.rw ?? 0).padStart(3, "0");
    const rtRw = `${rt}/${rw}`;
    const alamat = row.alamat || "-";
    const kelurahan = row.kelurahan || "-";
    const kecamatan = row.kecamatan || "-";
    const logoHeader = "/assets/plugins/images/receipt/header-resi.png";
    const logoWatermark = "/assets/plugins/images/receipt/watermark-resi.png";
    const icons = {
      user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>`,
      map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-5.5 7-12a7 7 0 10-14 0c0 6.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>`,
      clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4h6v3H9z"/></svg>`,
      shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
      calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>`,
      clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>`,
      phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 01-2.2 2A19.8 19.8 0 013 5.2 2 2 0 015 3h3a2 2 0 012 1.7l.4 2.6a2 2 0 01-.6 1.8l-1.6 1.6a16 16 0 007 7l1.6-1.6a2 2 0 011.8-.6l2.6.4A2 2 0 0122 16.9z"/></svg>`,
      fax: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V4h12v5"/><rect x="6" y="13" width="12" height="7" rx="2"/><path d="M6 17H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1"/><path d="M9 17h6"/></svg>`,
      mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`,
      globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>`,
    } as const;

    const receiptSection = (copyLabel: string) => {
      const isMasyarakatCopy = copyLabel === "UNTUK MASYARAKAT";
      return `
      <div class="receipt">
        <div class="watermark"><img src="${logoWatermark}" alt="Watermark" /></div>
        <div class="copy-tag">${copyLabel}</div>
        <div class="wrap">
          <div class="head">
            <img class="header-logo" src="${logoHeader}" alt="Header Resi" />
            <div class="header-text">
              <div class="small">${RECEIPT_HEADER.city}</div>
              <div class="big">${RECEIPT_HEADER.office}</div>
              <div class="meta">${RECEIPT_HEADER.address}</div>
              <div class="meta">${RECEIPT_HEADER.phoneFax}</div>
              <div class="meta meta-link">Laman : <a href="${RECEIPT_HEADER.websiteHref}" target="_blank" rel="noreferrer">${RECEIPT_HEADER.websiteLabel}</a>, Pos-el : <a href="${RECEIPT_HEADER.emailHref}">${RECEIPT_HEADER.emailLabel}</a></div>
            </div>
            <div class="head-spacer" aria-hidden="true"></div>
          </div>
          <div class="rule"></div>
          <div class="title-block">
            <div class="main">BUKTI REGISTRASI PENGAJUAN</div>
            <div class="sub">LAYANAN ADMINISTRASI KEPENDUDUKAN</div>
          </div>
          <div class="register-focus">
            <div class="register-focus-label">NOMOR REGISTRASI</div>
            <div class="register-focus-value">${row.registrationNo}</div>
          </div>
          <div class="rule"></div>
          <div class="content-grid">
            <div class="left-col">
              <div class="section">
                <div class="section-title">${icons.user}<span>1. IDENTITAS PENDUDUK</span></div>
                <table class="info-table">
                  <tbody>
                    ${isMasyarakatCopy ? `${isBbl && !hideNikOnReceipt ? `<tr><td class="label">${nikDisplayLabel}</td><td class="value">: ${row.nik}</td></tr>` : ""}<tr><td class="label">${namaDisplayLabel}</td><td class="value">: ${row.name}</td></tr>` : `
                    ${hideNikOnReceipt ? "" : `<tr><td class="label">${nikDisplayLabel}</td><td class="value">: ${row.nik}</td></tr>`}
                    <tr><td class="label">${namaDisplayLabel}</td><td class="value">: ${row.name}</td></tr>
                    <tr><td class="label icon-label">${icons.phone}<span>Nomor HP</span></td><td class="value">: ${row.phone || "-"}</td></tr>
                    <tr><td class="label icon-label">${icons.mail}<span>Email</span></td><td class="value">: ${row.email || "-"}</td></tr>`}
                  </tbody>
                </table>
              </div>
              ${isMasyarakatCopy ? "" : `<div class="section">
                <div class="section-title">${icons.map}<span>2. ALAMAT</span></div>
                <table class="info-table">
                  <tbody>
                    <tr><td class="label">Alamat</td><td class="value">: ${alamat}</td></tr>
                    <tr><td class="label">RT / RW</td><td class="value">: ${rtRw}</td></tr>
                    <tr><td class="label">Kelurahan</td><td class="value">: ${kelurahan}</td></tr>
                    <tr><td class="label">Kecamatan</td><td class="value">: ${kecamatan}</td></tr>
                  </tbody>
                </table>
              </div>`}
              <div class="section">
                <div class="section-title">${icons.clipboard}<span>${isMasyarakatCopy ? "2" : "3"}. DETAIL PENGAJUAN</span></div>
                <table class="info-table">
                  <tbody>
                    <tr><td class="label">Jenis Layanan</td><td class="value">: ${productHeading}</td></tr>
                    <tr><td class="label">Lokasi Layanan</td><td class="value">: ${locationLabel}</td></tr>
                    ${noDokInput ? `<tr><td class="label">No. Dokumen</td><td class="value">: ${noDokInput}</td></tr>` : ""}
                    <tr><td class="label icon-label">${icons.calendar}<span>Tanggal</span></td><td class="value">: ${row.createdDate}</td></tr>
                    <tr><td class="label icon-label">${icons.clock}<span>Jam</span></td><td class="value">: ${row.createdTime} WIB</td></tr>
                    <tr><td class="label">Status</td><td class="value"><span class="status">${row.statusLabel || statusLabel(row.status)}</span></td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="right-col">
              <div class="qr-box">
                <div class="qr-title">${icons.shield}<span>4. VERIFIKASI</span></div>
                <img src="${qrUrl(row.registrationNo)}" alt="QR Code" />
                <div class="qr-note">Pindai QR Code atau kunjungi disdukcapil.bandung.go.id dan masukkan Nomor Registrasi.</div>
              </div>
              <div class="doc-meta">
                <table class="meta-table">
                  <tbody>
                    <tr><td class="meta-label">Dokumen</td><td class="meta-value">: Bukti Registrasi</td></tr>
                    <tr><td class="meta-label">No.</td><td class="meta-value">: ${row.registrationNo}</td></tr>
                    <tr><td class="meta-label">Tanggal Cetak</td><td class="meta-value">: ${row.createdDate} ${row.createdTime} WIB</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="rule"></div>
          <div class="notes">
            <div class="notes-title">CATATAN</div>
            <ul>
              ${
                isKiaService
                  ? `<li>Jika Anda sudah menerima email <strong>SIAK Online</strong> dari <strong>Ditjen Dukcapil Kemendagri</strong>, silakan <strong>pindai atau klik QR Code yang terdapat pada email tersebut</strong> untuk mengakses dokumen KIA.</li>
              <li>Untuk pencetakan KIA, masyarakat dapat <strong>memilih cara yang paling sesuai dan mudah</strong>, baik dengan mencetak secara mandiri melalui <strong>Anjungan Dukcapil Mandiri (ADM)</strong> terdekat, mencetak melalui <strong>Gerai Geulis</strong> terdekat, maupun mengambil KIA melalui <strong>Loket Pengambilan Disdukcapil</strong> dengan membawa <strong>resi asli</strong> ini.</li>
              <li>Untuk memperoleh informasi lebih lanjut atau menyampaikan pengaduan, silakan menghubungi <strong>Call Center 0852-0888-1945</strong>.</li>`
                  : isKtpelOrIkdService
                  ? `<li><strong>Cek Status Pencetakan KTP-el:</strong> Klik <strong><a href="${RECEIPT_HEADER.websiteHref}" target="_blank" rel="noreferrer">${RECEIPT_HEADER.websiteLabel}</a></strong> lalu pilih <strong>Pencetakan KTP-el</strong>.</li>
              <li>Untuk memperoleh informasi lebih lanjut atau menyampaikan pengaduan, silakan menghubungi <strong>Call Center 0852-0888-1945</strong>.</li>`
                  : `<li>Jika Anda sudah menerima email <strong>SIAK Online</strong> dari <strong>Ditjen Dukcapil Kemendagri</strong>, silakan <strong>pindai atau klik QR CODE</strong> yang terdapat pada email tersebut untuk mengakses dokumen.</li>
              <li>Dokumen dapat <strong>dicetak secara mandiri</strong> menggunakan kertas <strong>HVS ukuran A4 80 gram</strong>.</li>
              ${isBbl ? '<li>Untuk keperluan pendaftaran atau pelayanan <strong>BPJS Kesehatan</strong> bagi bayi baru lahir, resi ini dapat ditunjukkan sebagai dokumen pendukung.</li>' : ""}
              ${isDinasLocation ? '<li>Jika hingga <strong>jangka waktu penyelesaian</strong> berakhir Anda belum menerima <strong>email SIAK Online dari Ditjen Dukcapil Kemendagri</strong>, silakan mendatangi <strong>Loket Pengambilan Disdukcapil</strong> dengan membawa <strong>resi asli</strong> ini.</li>' : ""}
              ${isGeraiLocation && isKematian ? `<li>Apabila terdapat kekeliruan pada <strong>Penerbitan Kutipan Akta Kematian</strong> dan email belum diterima dalam <strong>jangka waktu penyelesaian</strong>, mohon segera melapor ke <strong>${row.locationName}</strong>.</li>` : ""}
              ${isPindahKeluar ? '<li>Khusus permohonan <strong>Surat Pindah/SKPWNI</strong>, dokumen berlaku selama <strong>60 (enam puluh) hari sejak tanggal diterbitkan</strong>.</li>' : ""}
              <li>Untuk memperoleh informasi lebih lanjut atau menyampaikan pengaduan, silakan menghubungi <strong>Call Center 0852-0888-1945</strong>.</li>`
              }
            </ul>
          </div>
          <div class="rule"></div>
          <div class="footer">
            <span class="footer-shield">${icons.shield}</span>
            <span>Dokumen ini merupakan bukti registrasi pengajuan layanan administrasi kependudukan melalui Sistem MONALISA. Gunakan QR Code atau Nomor Registrasi untuk memantau status pengajuan.</span>
            <span>Kontak: disdukcapilkotabdg@gmail.com</span>
          </div>
        </div>
      </div>
    `;
    };
    const html = `<!doctype html>
      <html>
      <head>
        <title>Bukti Registrasi Pengajuan ${row.registrationNo}</title>
        <style>
          *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          body{font-family:Arial,sans-serif;margin:0;padding:0;background:#fff;color:#111}
          @page{size:A4 portrait;margin:5mm}
          .sheet{width:200mm;height:287mm;display:grid;grid-template-rows:141mm 1mm 141mm}
          .receipt{height:141mm;padding:4mm 4.5mm;page-break-inside:avoid;overflow:hidden;position:relative}
          .cut-line{border-top:1px dashed #777;margin:0}
          .watermark{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;user-select:none}
          .watermark img{width:690px;height:690px;object-fit:contain;opacity:.12;filter:grayscale(1) contrast(1.05)}
          .copy-tag{position:absolute;top:4mm;right:4.5mm;background:#000;color:#fff;padding:1px 8px;font-size:8.6px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
          .wrap{width:100%;margin:0 auto;display:grid;gap:4px;position:relative;z-index:1}
          .rule{height:1px;background:#000}
          .head{display:grid;grid-template-columns:68px 1fr 68px;gap:6px;align-items:center}
          .header-logo{width:68px;height:44px;object-fit:contain}
          .header-text{display:flex;flex-direction:column;gap:1px;align-items:center;text-align:center}
          .header-text .small{font-size:8.6px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
          .header-text .big{font-size:11.4px;font-weight:800;text-transform:uppercase;line-height:1.05;text-align:center}
          .header-text .meta{font-size:7.6px;font-weight:600;color:#222;line-height:1.2;text-align:center}
          .header-text .meta-link a{color:inherit;text-decoration:underline}
          .head-spacer{width:68px;height:44px}
          .title-block{display:grid;gap:2px;text-align:center;margin-top:2px}
          .title-block .main{font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:.03em}
          .title-block .sub{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.02em}
          .register-focus{border-top:1px solid #000;border-bottom:1px solid #000;padding:2px 6px;text-align:center}
          .register-focus-label{font-size:8.6px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
          .register-focus-value{font-size:13px;font-weight:900;letter-spacing:.01em;line-height:1.1;margin-top:1px;word-break:break-word}
          .content-grid{display:grid;grid-template-columns:68% 32%;gap:8px;align-items:start}
          .left-col{display:grid;gap:3px}
          .section{display:grid;gap:2px}
          .section-title{display:flex;align-items:center;gap:5px;font-size:9.6px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;border-top:1px solid #000;border-bottom:1px solid #000;padding:1px 0}
          .section-title svg{width:13px;height:13px;flex:none}
          .info-table{width:100%;border-collapse:collapse;table-layout:fixed}
          .info-table td{padding:.5px 0;font-size:9.2px;vertical-align:top;line-height:1.15}
          .info-table .label{width:104px;font-weight:600;white-space:nowrap;padding-right:6px}
          .info-table .label.icon-label{display:flex;align-items:center;gap:3px}
          .info-table .label.icon-label svg{width:11px;height:11px;flex:none}
          .info-table .value{font-weight:500;word-break:break-word}
          .right-col{display:grid;gap:4px}
          .qr-box{border:1px solid #000;padding:4px;display:grid;justify-items:center;gap:3px}
          .qr-box .qr-title{display:flex;align-items:center;gap:4px;font-size:8.8px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
          .qr-box .qr-title svg{width:12px;height:12px;flex:none}
          .qr-box img{width:112px;height:112px;display:block}
          .qr-note{font-size:7.8px;line-height:1.2;text-align:center;font-weight:500;color:#333}
          .doc-meta{border:1px dashed #8a8a8a;padding:4px}
          .meta-table{width:100%;border-collapse:collapse;table-layout:fixed}
          .meta-table td{font-size:8.6px;line-height:1.15;vertical-align:top;padding:.5px 0}
          .meta-label{width:72px;font-weight:600;white-space:nowrap}
          .meta-value{font-weight:500;word-break:break-word}
          .status{display:inline-block;padding:1px 8px;border:1.2px solid #000;font-weight:800;text-transform:uppercase;font-size:8.6px;letter-spacing:.03em}
          .footer{font-size:8.3px;line-height:1.2;color:#333;text-align:center;display:grid;gap:1px;justify-items:center;padding-top:1px}
          .footer-shield svg{width:12px;height:12px}
          .footer strong{font-weight:800}
          .notes{border:1px solid #000;border-radius:2px;padding:3px 4px;display:grid;gap:2px}
          .notes-title{font-size:8.4px;font-weight:900;letter-spacing:.03em;text-transform:uppercase}
          .notes ul{margin:0;padding-left:12px;display:grid;gap:1px}
          .notes li{font-size:7.2px;line-height:1.2;color:#222}
          .notes strong{font-weight:800}
          @media print{
            body{margin:0}
            .noprint{display:none}
            .sheet{width:200mm;height:287mm}
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          ${receiptSection("UNTUK MASYARAKAT")}
          <div class="cut-line"></div>
          ${receiptSection("UNTUK DI BERKAS")}
        </div>
        ${
          shouldAutoPrint
            ? `<script>
          window.onload = function() {
            const images = Array.from(document.querySelectorAll('img.header-logo'));
            if (!images.length || images.every((img) => img.complete)) {
              setTimeout(() => window.print(), 250);
              return;
            }
            let resolved = 0;
            const done = function() {
              resolved += 1;
              if (resolved >= images.length) {
                setTimeout(() => window.print(), 250);
              }
            };
            images.forEach((img) => {
              if (img.complete) {
                done();
                return;
              }
              img.addEventListener('load', done, { once: true });
              img.addEventListener('error', done, { once: true });
            });
          }
        </script>`
            : ""
        }
      </body>
      </html>`;
    if (shouldReturnHtml) return html;
    win!.document.open();
    win!.document.write(html);
    win!.document.close();
  }

  return (
    <div className="relative mt-16 space-y-8 px-4 pb-10 pt-6 text-gray-100 sm:px-6 md:px-8 md:pt-8">
      <SettingPageHeader
        lead="Pelayanan"
        title="Tracking Pengajuan"
        description="Registrasi manual, monitoring status, pencarian pengajuan, dan cetak resi pelayanan Disdukcapil."
        badges={<span className="rounded-full border border-cyan-400/50 bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-100">Manual Tracking</span>}
      />

      <section className="grid grid-cols-1 gap-6">
        <div className="rounded-3xl border border-cyan-900/50 bg-[#05070d]/80 p-5 shadow-[0_0_34px_#00ffff22]">
          <div className="mb-4 flex items-center gap-2 text-cyan-100">
            <FilePlus2 className="h-5 w-5 text-cyan-300" />
            <h2 className="text-sm font-semibold">Input Pengajuan</h2>
          </div>
          <div className="grid gap-3">
            <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none">
              <option value="">Pilih Lokasi Layanan</option>
              {inputLocations.map((item) => <option key={item.locationId} value={item.locationId}>{item.code} - {item.name}</option>)}
            </select>
            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none">
              <option value="">Pilih Jenis Pelayanan</option>
              {productsByLocation.map((item) => <option key={item.productId} value={item.productId}>{item.code} - {item.name}</option>)}
            </select>
            <input
              value={form.nik}
              onChange={(e) =>
                setForm({
                  ...form,
                  nik: normalizeDigits(e.target.value),
                })
              }
              placeholder={
                form.isBbl
                  ? "NIK Bayi Baru Lahir BPJS (Wajib 16 digit)"
                  : isNikOptionalInput
                  ? "NIK (Opsional, jika kosong isi No. Dokumen)"
                  : "NIK Pemohon"
              }
              disabled={!isNikEnabled}
              className={`rounded-xl border px-3 py-2 text-sm outline-none ${isNikEnabled ? "border-cyan-800/60 bg-[#0f172a] text-cyan-50" : "border-slate-700 bg-slate-900 text-slate-400"}`}
            />
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
              placeholder="Nama Pemohon"
              disabled={!isDetailFieldsEnabled}
              className={`rounded-xl border px-3 py-2 text-sm outline-none ${isDetailFieldsEnabled ? "border-cyan-800/60 bg-[#0f172a] text-cyan-50" : "border-slate-700 bg-slate-900 text-slate-400"}`}
            />
            {showNoDokInput ? (
              <input
                value={form.noDok}
                onChange={(e) => setForm({ ...form, noDok: e.target.value.toUpperCase().slice(0, 100) })}
                placeholder="No. Dokumen (Opsional)"
                disabled={!isDetailFieldsEnabled}
                className={`rounded-xl border px-3 py-2 text-sm outline-none ${isDetailFieldsEnabled ? "border-cyan-800/60 bg-[#0f172a] text-cyan-50" : "border-slate-700 bg-slate-900 text-slate-400"}`}
              />
            ) : null}
            {isBblEligible ? (
              <label className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50">
                <input
                  type="checkbox"
                  checked={form.isBbl}
                  onChange={(e) => setForm((prev) => ({ ...prev, isBbl: e.target.checked }))}
                  className="h-4 w-4 accent-cyan-400"
                />
                <span>BBL (Bayi Baru Lahir BPJS)</span>
              </label>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectDark
                value={form.noKec}
                onChange={(e) => void handleKecamatanChange(e.target.value)}
                disabled={!isDetailFieldsEnabled}
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
                disabled={!isDetailFieldsEnabled || form.noKec === "0" || kelurahanLoadingKey === form.noKec}
                className="rounded-xl"
              >
                {kelurahanSelectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {kelurahanLoadingKey === form.noKec && opt.value === "0" ? "Memuat kelurahan..." : opt.label}
                  </option>
                ))}
              </SelectDark>
            </div>
            <textarea
              value={form.alamat}
              onChange={(e) => setForm({ ...form, alamat: e.target.value.toUpperCase() })}
              placeholder="Alamat"
              disabled={!isDetailFieldsEnabled}
              rows={2}
              className={`min-h-[64px] rounded-xl border px-3 py-2 text-sm outline-none ${isDetailFieldsEnabled ? "border-cyan-800/60 bg-[#0f172a] text-cyan-50" : "border-slate-700 bg-slate-900 text-slate-400"}`}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={form.rt}
                onChange={(e) => setForm({ ...form, rt: e.target.value.replace(/[^\d]/g, "").slice(0, 3) })}
                placeholder="No RT"
                disabled={!isDetailFieldsEnabled}
                className={`rounded-xl border px-3 py-2 text-sm outline-none ${isDetailFieldsEnabled ? "border-cyan-800/60 bg-[#0f172a] text-cyan-50" : "border-slate-700 bg-slate-900 text-slate-400"}`}
              />
              <input
                value={form.rw}
                onChange={(e) => setForm({ ...form, rw: e.target.value.replace(/[^\d]/g, "").slice(0, 3) })}
                placeholder="No RW"
                disabled={!isDetailFieldsEnabled}
                className={`rounded-xl border px-3 py-2 text-sm outline-none ${isDetailFieldsEnabled ? "border-cyan-800/60 bg-[#0f172a] text-cyan-50" : "border-slate-700 bg-slate-900 text-slate-400"}`}
              />
              
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d+]/g, "").slice(0, 20) })}
                placeholder="No HP"
                disabled={!isDetailFieldsEnabled}
                className={`rounded-xl border px-3 py-2 text-sm outline-none ${isDetailFieldsEnabled ? "border-cyan-800/60 bg-[#0f172a] text-cyan-50" : "border-slate-700 bg-slate-900 text-slate-400"}`}
              />
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email"
                disabled={!isDetailFieldsEnabled}
                className={`rounded-xl border px-3 py-2 text-sm outline-none ${isDetailFieldsEnabled ? "border-cyan-800/60 bg-[#0f172a] text-cyan-50" : "border-slate-700 bg-slate-900 text-slate-400"}`}
              />
            </div>
            <button
              onClick={() => void saveTracking()}
              disabled={!isSaveEnabled || saving}
              className={`mt-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-black shadow-lg ${isSaveEnabled ? "bg-gradient-to-r from-cyan-400 to-blue-500 hover:opacity-95" : "bg-slate-700 text-slate-300 cursor-not-allowed"}`}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Simpan
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
              <DateRangePopup start={filters.start} end={filters.end} onChange={(start, end) => setFilters({ ...filters, start, end })} months={2} minWidth={660} className="min-w-0" />
              <select value={filters.locationId} onChange={(e) => setFilters({ ...filters, locationId: e.target.value })} className="min-w-0 w-full sm:w-auto rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50">
                <option value="">Semua Lokasi</option>
                {filteredLocations.map((item) => <option key={item.locationId} value={item.locationId}>{item.code} - {item.name}</option>)}
              </select>
              <select value={filters.productId} onChange={(e) => setFilters({ ...filters, productId: e.target.value })} className="min-w-0 w-full sm:w-auto rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50">
                <option value="">Semua Pelayanan</option>
                {filterProducts.map((item) => <option key={item.productId} value={item.productId}>{item.name}</option>)}
              </select>
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="min-w-0 w-full sm:w-auto rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50">
                <option value="">Semua Status</option>
                {STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
              </select>
              <input value={filters.petugas} onChange={(e) => setFilters({ ...filters, petugas: e.target.value })} placeholder="Petugas" className="min-w-0 w-full sm:w-32 rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50" />
              <input value={filters.nik} onChange={(e) => setFilters({ ...filters, nik: normalizeDigits(e.target.value) })} placeholder="NIK" className="min-w-0 w-full sm:w-40 rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50" />
              <input value={filters.registrationNo} onChange={(e) => setFilters({ ...filters, registrationNo: e.target.value.toUpperCase() })} placeholder="Nomor Registrasi" className="min-w-0 w-full sm:w-56 rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50" />
              <button onClick={() => void loadRows()} disabled={loading} className="min-w-0 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/30">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Filter
              </button>
              <button onClick={() => void loadRows()} disabled={loading} className="min-w-0 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-800/60 bg-white/5 px-3 py-2 text-sm text-cyan-100">
                <RefreshCcw className="h-4 w-4" />
                Reload
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-cyan-900/50 bg-[#05070d]/80 p-5 shadow-[0_0_34px_#00ffff22]">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-cyan-100">
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-cyan-300" />
            <h2 className="text-sm font-semibold">Monitoring Pengajuan</h2>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/85">
              Terpilih: <span className="font-semibold text-cyan-50">{selectedRows.length}</span> | Milik Saya: <span className="font-semibold text-cyan-50">{selectedOwnedRows.length}</span>
            </span>
            <button
              onClick={toggleSelectAllRows}
              disabled={!rows.length || saving || loading}
              className="inline-flex items-center justify-center rounded-lg border border-cyan-700/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {allRowsSelected ? "Batal Pilih Semua" : "Pilih Semua"}
            </button>
            <button
              onClick={printSelectedRows}
              disabled={!selectedOwnedRows.length || saving || loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-50 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" /> Cetak Terpilih
            </button>
            <button
              onClick={() => void completeSelectedRows()}
              disabled={!selectedOwnedRows.length || saving || loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-50 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Selesaikan Terpilih
            </button>
          </div>
        </div>
        {loading ? (
          <div className="py-8 text-center text-cyan-100/70"><Loader2 className="mx-auto h-5 w-5 animate-spin" /><p className="mt-2 text-xs">Memuat data...</p></div>
        ) : (
          <JQDataTable data={rows as any[]} columns={columns} pageLength={25} tableClassName="dt-cyberpunk tracking-table" minWidth={0} onApiReady={handleApiReady} />
        )}
      </section>

      <section className="rounded-3xl border border-cyan-900/50 bg-[#05070d]/80 p-5 shadow-[0_0_34px_#00ffff22]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-cyan-100">
            <ShieldCheck className="h-5 w-5 text-cyan-300" />
            <h2 className="text-sm font-semibold">Tracking</h2>
          </div>
          <div className="ml-auto flex flex-1 flex-wrap justify-end gap-2">
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && searchTracking()} placeholder="Nomor Registrasi atau NIK" className="min-w-0 w-full max-w-[420px] rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50" />
            <button onClick={() => void searchTracking()} disabled={searching} className="min-w-0 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-500/30">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Cari
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-6">
          <select
            value={quickTracking.locationId}
            onChange={(e) => setQuickTracking((prev) => ({ ...prev, locationId: e.target.value }))}
            className="min-w-0 rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 md:col-span-2"
          >
            <option value="">Pilih Lokasi</option>
            {filteredLocations.map((item) => <option key={item.locationId} value={item.locationId}>{item.code} - {item.name}</option>)}
          </select>
          <select
            value={quickTracking.productId}
            onChange={(e) => setQuickTracking((prev) => ({ ...prev, productId: e.target.value }))}
            className="min-w-0 rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 md:col-span-2"
          >
            <option value="">Pilih Produk</option>
            {quickTrackingProducts.map((item) => <option key={item.productId} value={item.productId}>{item.name}</option>)}
          </select>
          <input
            type="date"
            value={quickTracking.date}
            onChange={(e) => setQuickTracking((prev) => ({ ...prev, date: e.target.value }))}
            className="min-w-0 rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50"
          />
          <input
            value={quickTracking.sequence}
            onChange={(e) => setQuickTracking((prev) => ({ ...prev, sequence: e.target.value.replace(/[^\d]/g, "").slice(0, 3) }))}
            onKeyDown={(e) => e.key === "Enter" && void searchTrackingBySequence()}
            placeholder="No Urut (001)"
            className="min-w-0 rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-xs text-cyan-100/70">Nomor otomatis: <span className="font-semibold text-cyan-50">{quickTrackingRegistrationNo || "-"}</span></p>
          <button
            onClick={() => void searchTrackingBySequence()}
            disabled={searching}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-800/60 bg-white/5 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-white/10"
          >
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Cari dari No Urut
          </button>
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
                  {item.notes?.trim() ? (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-100">Catatan Petugas: {item.notes}</p>
                  ) : null}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {canManageTracking(item.createdBy) ? (
                    <>
                      <button
                        onClick={() => void handleSearchCardPrint(item.trackingId)}
                        className="inline-flex items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1.5 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/25"
                      >
                        Cetak
                      </button>
                      <button
                        onClick={() => void openEditModal(item.trackingId)}
                        className="inline-flex items-center justify-center rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1.5 text-xs font-semibold text-sky-50 hover:bg-sky-500/25"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => openDeleteModal({
                          trackingId: item.trackingId,
                          registrationNo: item.registrationNo,
                          noDok: "",
                          locationId: 0,
                          locationCode: "",
                          locationName: item.locationName,
                          productId: 0,
                          productCode: "",
                          productName: item.productName,
                          nik: item.nik,
                          name: item.name,
                          kecamatan: "",
                          kelurahan: "",
                          alamat: "",
                          rw: "",
                          rt: "",
                          phone: "",
                          email: "",
                          notes: item.notes || "",
                          status: item.status,
                          statusLabel: item.statusLabel,
                          createdBy: item.createdBy || "",
                          createdDate: item.date,
                          createdTime: "",
                        })}
                        className="inline-flex items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-50 hover:bg-rose-500/25"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => void handleSearchCardStatus(item.trackingId)}
                        disabled={nextStatuses(item.status).length === 0}
                        className={`inline-flex items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                          item.status === "BERKAS_MASUK"
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-50 hover:bg-emerald-500/25"
                            : item.status === "SELESAI"
                            ? "border-blue-500/40 bg-blue-500/15 text-blue-50 hover:bg-blue-500/25"
                            : "border-slate-600/40 bg-slate-500/10 text-slate-200 hover:bg-slate-500/20"
                        }`}
                      >
                        Perbarui Status
                      </button>
                    </>
                  ) : (
                    <p className="col-span-2 rounded-lg border border-cyan-800/60 bg-white/5 px-2.5 py-2 text-center text-[11px] text-cyan-100/70">
                      Data ini hanya dapat dikelola oleh petugas penginput.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {editModalOpen ? (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-cyan-500/30 bg-[#0b0f1c] p-5 shadow-[0_16px_40px_rgba(0,0,0,.55)]">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 h-5 w-5 text-cyan-300" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-cyan-50">Update Pengajuan</h3>
                <p className="mt-1 text-xs text-cyan-100/65">{editForm.registrationNo || "-"} - {editForm.nik || "-"}</p>
              </div>
              <button onClick={closeEditModal} disabled={editLoading || editSaving} className="rounded-lg border border-cyan-800/50 p-2 text-cyan-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
                <X className="h-4 w-4" />
              </button>
            </div>

            {editLoading ? (
              <div className="py-8 text-center text-cyan-100/70">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                <p className="mt-2 text-xs">Memuat data edit...</p>
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                <div className="grid gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100/70">Nama Pemohon</p>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value.toUpperCase() }))}
                    placeholder="Nama Pemohon"
                    className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none"
                  />
                </div>
                <div className="grid gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100/70">Alamat</p>
                  <textarea
                    value={editForm.alamat}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, alamat: e.target.value.toUpperCase() }))}
                    placeholder="Alamat"
                    rows={2}
                    className="min-h-[64px] rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none"
                  />
                </div>
                {showEditNoDokInput ? (
                  <div className="grid gap-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100/70">No. Dokumen (Opsional)</p>
                    <input
                      value={editForm.noDok}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, noDok: e.target.value.toUpperCase().slice(0, 100) }))}
                      placeholder="No. Dokumen"
                      className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none"
                    />
                  </div>
                ) : null}
                {isEditBblEligible ? (
                  <label className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50">
                    <input
                      type="checkbox"
                      checked={editForm.isBbl}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, isBbl: e.target.checked }))}
                      className="h-4 w-4 accent-cyan-400"
                    />
                    <span>BBL (Bayi Baru Lahir BPJS)</span>
                  </label>
                ) : null}
                <div className="grid gap-1 sm:grid-cols-2 sm:gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100/70">No RT</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100/70">No RW</p>
                  
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={editForm.rt}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, rt: e.target.value.replace(/[^\d]/g, "").slice(0, 3) }))}
                    placeholder="No RT"
                    className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none"
                  />
                  <input
                    value={editForm.rw}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, rw: e.target.value.replace(/[^\d]/g, "").slice(0, 3) }))}
                    placeholder="No RW"
                    className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none"
                  />
                  
                </div>
                <div className="grid gap-1 sm:grid-cols-2 sm:gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100/70">Kecamatan</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100/70">Kelurahan</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectDark value={editForm.noKec} onChange={(e) => void handleEditKecamatanChange(e.target.value)} className="rounded-xl">
                    {kecamatanSelectOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </SelectDark>
                  <SelectDark
                    value={editForm.noKel}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, noKel: e.target.value }))}
                    disabled={editForm.noKec === "0" || kelurahanLoadingKey === editForm.noKec}
                    className="rounded-xl"
                  >
                    {editKelurahanSelectOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {kelurahanLoadingKey === editForm.noKec && opt.value === "0" ? "Memuat kelurahan..." : opt.label}
                      </option>
                    ))}
                  </SelectDark>
                </div>
                <div className="grid gap-1 sm:grid-cols-2 sm:gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100/70">No HP</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100/70">Email</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={editForm.phone}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value.replace(/[^\d+]/g, "").slice(0, 20) }))}
                    placeholder="No HP"
                    className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none"
                  />
                  <input
                    value={editForm.email}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Email"
                    className="rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none"
                  />
                </div>
                <div className="mt-1 flex flex-wrap justify-end gap-2">
                  <button
                    onClick={closeEditModal}
                    disabled={editSaving}
                    className="inline-flex items-center justify-center rounded-xl border border-cyan-800/60 bg-white/5 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => void submitEditTracking()}
                    disabled={!isEditSaveEnabled || editSaving}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-black shadow-lg ${isEditSaveEnabled ? "bg-gradient-to-r from-cyan-400 to-blue-500 hover:opacity-95" : "bg-slate-700 text-slate-300 cursor-not-allowed"}`}
                  >
                    {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Update
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {deleteModal.open && deleteModal.row ? (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#0b0f1c] p-5 shadow-[0_16px_40px_rgba(0,0,0,.55)]">
            <div className="flex items-start gap-3">
              <X className="mt-1 h-5 w-5 text-rose-300" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-rose-50">Konfirmasi Hapus Pengajuan</h3>
                <p className="mt-1 text-xs text-cyan-100/70">Data yang dihapus akan dinonaktifkan dari daftar aktif.</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-rose-900/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-50">
              <p className="font-semibold">{deleteModal.row.registrationNo || "-"}</p>
              <p className="mt-1">{deleteModal.row.name || "-"} - {deleteModal.row.nik || "-"}</p>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                onClick={closeDeleteModal}
                disabled={deleting}
                className="inline-flex items-center justify-center rounded-xl border border-cyan-800/60 bg-white/5 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={() => void deleteTracking(deleteModal.row as TrackingRow)}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/50 bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-50 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {statusModal ? (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-[#0b0f1c] p-5 shadow-[0_16px_40px_rgba(0,0,0,.55)]">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-300" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-cyan-50">Perbarui Status</h3>
                <p className="mt-1 break-words text-xs text-cyan-100/65">{statusModal.row.registrationNo} - {statusModal.row.name}</p>
              </div>
              <button onClick={() => setStatusModal(null)} className="rounded-lg border border-cyan-800/50 p-2 text-cyan-100 hover:bg-white/10"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 grid gap-3">
              {statusModal.row.status === "BERKAS_MASUK" ? (
                <>
                  <div className="grid gap-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100/70">Catatan Petugas (Wajib untuk Batal)</p>
                    <textarea
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      rows={3}
                      placeholder="Isi catatan petugas. Contoh: Berkas tidak lengkap..."
                      className="resize-none rounded-xl border border-cyan-800/60 bg-[#0f172a] px-3 py-2 text-sm text-cyan-50 outline-none"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      onClick={() => void updateStatus("SELESAI")}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Selesai
                    </button>
                    <button
                      onClick={() => void updateStatus("BATAL")}
                      disabled={saving || !statusNote.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-50 hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      Batal
                    </button>
                  </div>
                </>
              ) : statusModal.row.status === "SELESAI" ? (
                <button
                  onClick={() => void updateStatus("DIAMBIL")}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500/20 px-4 py-2 text-sm font-semibold text-blue-50 hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Sudah Diambil
                </button>
              ) : (
                <div className="rounded-xl border border-cyan-800/50 bg-white/5 px-3 py-2 text-xs text-cyan-100/75">
                  Status ini tidak memiliki aksi lanjutan.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <NeonModal open={!!notice} kind={notice?.kind || "info"} title={notice?.title} message={notice?.message} onClose={() => setNotice(null)} />
    </div>
  );
}
