// FILE: src/app/setting/app/page.tsx
"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { Loader2, RefreshCcw, Save } from "lucide-react";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";
import { normalizeCutoffInput, formatCutoffForDisplay } from "@/lib/setting-app";
import type { SettingAppConfig } from "@/types/setting-app";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import TypeableSelect from "@/components/ui/TypeableSelect";

type ModalState = {
  open: boolean;
  kind: ModalKind;
  title: string;
  message: string;
};

const initialForm: SettingAppConfig = {
  no_prop: "",
  no_kab: "",
  nm_prop: "",
  nm_kab: "",
  siak_dblink: "",
  cetak_dblink: "",
  rekam_dblink: "",
  master_dblink: "",
  dkb_bio: "",
  dkb_kk: "",
  dkb_tahun: "",
  dkb_cutoff: "",
  default_pass: "",
  give_kec: "0",
  give_kel: "0",
};

const yesNoOptions = [
  { value: "1", label: "Ya" },
  { value: "0", label: "Tidak" },
];

export default function SettingAppPage() {
  const [form, setForm] = useState<SettingAppConfig>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/setting/app", {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Gagal memuat setting aplikasi");
      }
      setForm(buildFormState(json?.data));
    } catch (e: any) {
      setError(e?.message || "Gagal memuat setting aplikasi");
      setForm(initialForm);
    } finally {
      setLoading(false);
    }
  }

  function buildFormState(payload?: Partial<SettingAppConfig>): SettingAppConfig {
    const next: SettingAppConfig = { ...initialForm };
    (Object.keys(next) as (keyof SettingAppConfig)[]).forEach((key) => {
      const raw = payload?.[key];
      if (raw !== undefined && raw !== null) {
        next[key] = String(raw);
      }
    });
    next.give_kec = next.give_kec === "1" ? "1" : "0";
    next.give_kel = next.give_kel === "1" ? "1" : "0";
    next.dkb_cutoff = next.dkb_cutoff ? formatCutoffForDisplay(next.dkb_cutoff) : "";
    return next;
  }

  const handleChange =
    (field: keyof SettingAppConfig) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  function handleCutoffBlur() {
    if (!form.dkb_cutoff) return;
    const normalized = normalizeCutoffInput(form.dkb_cutoff);
    if (normalized) {
      setForm((prev) => ({ ...prev, dkb_cutoff: normalized.display }));
    }
  }

  function validateForm(values: SettingAppConfig) {
    const digits2 = /^\d{1,2}$/;
    const trimmed: SettingAppConfig = Object.fromEntries(
      (Object.entries(values) as [keyof SettingAppConfig, string][]).map(([key, val]) => [
        key,
        val?.toString().trim(),
      ])
    ) as SettingAppConfig;

    if (!digits2.test(trimmed.no_prop)) {
      return { ok: false as const, message: "No Provinsi wajib 1-2 digit angka." };
    }
    if (!digits2.test(trimmed.no_kab)) {
      return { ok: false as const, message: "No Kabupaten wajib 1-2 digit angka." };
    }
    if (!trimmed.nm_prop) return { ok: false as const, message: "Nama Provinsi wajib diisi." };
    if (!trimmed.nm_kab) return { ok: false as const, message: "Nama Kabupaten wajib diisi." };
    if (!trimmed.siak_dblink) return { ok: false as const, message: "SIAK DBLink wajib diisi." };
    if (!trimmed.cetak_dblink) return { ok: false as const, message: "Cetak DBLink wajib diisi." };
    if (!trimmed.rekam_dblink) return { ok: false as const, message: "Rekam DBLink wajib diisi." };
    if (!trimmed.master_dblink)
      return { ok: false as const, message: "Monitoring DBLink wajib diisi." };
    if (!trimmed.dkb_bio) return { ok: false as const, message: "DKB Biodata wajib diisi." };
    if (!trimmed.dkb_kk) return { ok: false as const, message: "DKB Keluarga wajib diisi." };
    if (!trimmed.dkb_tahun) return { ok: false as const, message: "Tahun DKB wajib diisi." };
    if (!trimmed.default_pass)
      return { ok: false as const, message: "Default password wajib diisi." };
    if (trimmed.give_kec !== "0" && trimmed.give_kec !== "1") {
      return { ok: false as const, message: "Pilih status akses semua kecamatan." };
    }
    if (trimmed.give_kel !== "0" && trimmed.give_kel !== "1") {
      return { ok: false as const, message: "Pilih status akses semua kelurahan." };
    }

    const cutoff = normalizeCutoffInput(trimmed.dkb_cutoff);
    if (!cutoff) {
      return {
        ok: false as const,
        message: "Tanggal cutoff DKB wajib format DD-MM-YYYY.",
      };
    }

    const payload: SettingAppConfig = {
      ...trimmed,
      dkb_cutoff: cutoff.display,
    };
    return { ok: true as const, payload };
  }

  async function handleSave() {
    const validation = validateForm(form);
    if (!validation.ok) {
      setModal({
        open: true,
        kind: "warning",
        title: "Validasi Gagal",
        message: validation.message,
      });
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/setting/app", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.payload),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Gagal menyimpan setting aplikasi");
      }
      setModal({
        open: true,
        kind: "success",
        title: "Tersimpan",
        message: json?.message || "Setting aplikasi berhasil disimpan.",
      });
      setForm(validation.payload);
    } catch (e: any) {
      setModal({
        open: true,
        kind: "error",
        title: "Gagal Menyimpan",
        message: e?.message || "Terjadi kesalahan saat menyimpan data.",
      });
    } finally {
      setSaving(false);
    }
  }

  const formDisabled = loading || saving;
  const headerActions = (
    <button
      type="button"
      onClick={() => void loadData()}
      className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-60"
      disabled={loading}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
      Refresh
    </button>
  );

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[12%] top-[-20%] h-[1000px] w-[1000px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[14%] bottom-[-25%] h-[900px] w-[900px] rounded-full bg-fuchsia-600/12 blur-[200px]" />
      </div>

      <SettingPageHeader
        lead="Pengaturan Aplikasi"
        title="Setting App Monitoring"
        description="Konfigurasi identitas wilayah, koneksi database operasional, serta parameter default yang digunakan lintas modul monitoring."
        actions={headerActions}
      />

      {error && (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <section className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Identitas Wilayah" description="Parameter dasar wilayah kerja pelayanan.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="No Provinsi">
                <input
                  value={form.no_prop}
                  onChange={handleChange("no_prop")}
                  className="field-input"
                  maxLength={2}
                  inputMode="numeric"
                  disabled={formDisabled}
                />
              </Field>
              <Field label="No Kabupaten/Kota">
                <input
                  value={form.no_kab}
                  onChange={handleChange("no_kab")}
                  className="field-input"
                  maxLength={2}
                  inputMode="numeric"
                  disabled={formDisabled}
                />
              </Field>
              <Field label="Nama Provinsi">
                <input
                  value={form.nm_prop}
                  onChange={handleChange("nm_prop")}
                  className="field-input"
                  disabled={formDisabled}
                />
              </Field>
              <Field label="Nama Kabupaten/Kota">
                <input
                  value={form.nm_kab}
                  onChange={handleChange("nm_kab")}
                  className="field-input"
                  disabled={formDisabled}
                />
              </Field>
            </div>
          </Card>

          <Card title="Kredensial & DBLink" description="Lokasi database untuk operasi SIAK, cetak, rekam dan monitoring.">
            <div className="grid gap-4">
              <Field label="SIAK DBLink">
                <input
                  value={form.siak_dblink}
                  onChange={handleChange("siak_dblink")}
                  className="field-input"
                  disabled={formDisabled}
                />
              </Field>
              <Field label="Cetak DBLink">
                <input
                  value={form.cetak_dblink}
                  onChange={handleChange("cetak_dblink")}
                  className="field-input"
                  disabled={formDisabled}
                />
              </Field>
              <Field label="Rekam DBLink">
                <input
                  value={form.rekam_dblink}
                  onChange={handleChange("rekam_dblink")}
                  className="field-input"
                  disabled={formDisabled}
                />
              </Field>
              <Field label="Monitoring DBLink">
                <input
                  value={form.master_dblink}
                  onChange={handleChange("master_dblink")}
                  className="field-input"
                  disabled={formDisabled}
                />
              </Field>
              <Field label="Default Password User" hint="Dipakai saat admin membuat user baru atau reset password.">
                <input
                  value={form.default_pass}
                  onChange={handleChange("default_pass")}
                  className="field-input"
                  disabled={formDisabled}
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Parameter DKB" description="Referensi dataset kependudukan untuk laporan monitoring.">
            <div className="grid gap-4">
              <Field label="DKB Biodata">
                <input
                  value={form.dkb_bio}
                  onChange={handleChange("dkb_bio")}
                  className="field-input"
                  disabled={formDisabled}
                />
              </Field>
              <Field label="DKB Keluarga">
                <input
                  value={form.dkb_kk}
                  onChange={handleChange("dkb_kk")}
                  className="field-input"
                  disabled={formDisabled}
                />
              </Field>
              <Field label="Tahun DKB Aktif">
                <input
                  value={form.dkb_tahun}
                  onChange={handleChange("dkb_tahun")}
                  className="field-input"
                  disabled={formDisabled}
                />
              </Field>
              <Field label="Tanggal Cutoff DKB" hint="Format: DD-MM-YYYY">
                <input
                  value={form.dkb_cutoff}
                  onChange={handleChange("dkb_cutoff")}
                  onBlur={handleCutoffBlur}
                  className="field-input"
                  placeholder="DD-MM-YYYY"
                  disabled={formDisabled}
                />
              </Field>
            </div>
          </Card>

          <Card
            title="Hak Akses Default"
            description="Menentukan apakah user mendapatkan akses seluruh kecamatan/kelurahan."
          >
            <div className="grid gap-4">
              <Field label="Akses Semua Kecamatan">
                <TypeableSelect
                  value={form.give_kec}
                  onChange={handleChange("give_kec")}
                 
                  disabled={formDisabled}
                >
                  {yesNoOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </TypeableSelect>
              </Field>
              <Field label="Akses Semua Kelurahan">
                <TypeableSelect
                  value={form.give_kel}
                  onChange={handleChange("give_kel")}
                 
                  disabled={formDisabled}
                >
                  {yesNoOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </TypeableSelect>
              </Field>
            </div>
          </Card>
        </div>

        <div className="flex justify-end border-t border-cyan-900/30 pt-4">
          <button
            type="button"
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/50 bg-emerald-500/10 px-6 py-2 text-sm font-semibold text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,.25)] hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:opacity-60"
            disabled={formDisabled}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Pengaturan
          </button>
        </div>
      </section>

      {modal && (
        <NeonModal
          open={modal.open}
          kind={modal.kind}
          title={modal.title}
          message={modal.message}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-cyan-900/40 bg-[#05070d]/60 p-5 shadow-[0_0_30px_rgba(6,182,212,.08)]">
      <h2 className="text-lg font-semibold text-cyan-50">{title}</h2>
      {description && <p className="mt-1 text-sm text-cyan-100/70">{description}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <label className="flex flex-col text-sm text-cyan-100/90">
      <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-xs text-cyan-200/70">{hint}</p> : null}
    </label>
  );
}


