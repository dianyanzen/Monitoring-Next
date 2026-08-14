"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";
import TypeableSelect from "@/components/ui/TypeableSelect";

type FormState = {
  nip: string;
  nama: string;
  jabatan: string;
  is_struktural: "1" | "0";
};

type ModalState = {
  open: boolean;
  kind: ModalKind;
  title: string;
  message: string;
  goBack?: boolean;
};

const initialForm: FormState = {
  nip: "",
  nama: "",
  jabatan: "",
  is_struktural: "0",
};

export default function SettingPejabatAddPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);

  const handleChange =
    (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        field === "nip"
          ? event.target.value.replace(/[^\d]/g, "")
          : field === "nama" || field === "jabatan"
            ? event.target.value.toUpperCase()
            : event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  function validateForm(values: FormState) {
    if (!values.nip.trim()) return "NIP pejabat wajib diisi.";
    if (values.nip.length < 8 || values.nip.length > 30) return "Panjang NIP tidak valid.";
    if (!values.nama.trim()) return "Nama pejabat wajib diisi.";
    if (!values.jabatan.trim()) return "Jabatan pejabat wajib diisi.";
    return null;
  }

  async function handleSubmit() {
    const validationError = validateForm(form);
    if (validationError) {
      setModal({
        open: true,
        kind: "warning",
        title: "Validasi Gagal",
        message: validationError,
      });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/setting/pejabat", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal menyimpan data");
      setModal({
        open: true,
        kind: "success",
        title: "Pejabat Ditambahkan",
        message: json?.message || "Data pejabat berhasil disimpan.",
        goBack: true,
      });
    } catch (e: any) {
      setModal({
        open: true,
        kind: "error",
        title: "Gagal Menyimpan",
        message: e?.message || "Terjadi kesalahan saat menyimpan data.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-cyan-900/40 bg-[#05070d]/70 p-6 shadow-[0_0_35px_rgba(6,182,212,.15)]">
        <button
          type="button"
          onClick={() => router.push("/setting/pejabat")}
          className="inline-flex items-center gap-2 text-sm text-cyan-200/80 hover:text-cyan-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke List Pejabat
        </button>
        <h1 className="mt-3 text-2xl font-extrabold text-cyan-50">Tambah Pejabat</h1>
        <p className="mt-2 text-sm text-cyan-100/70">
          Lengkapi identitas pejabat yang akan menjadi referensi pembina user.
        </p>
      </section>

      <section className="rounded-3xl border border-cyan-900/40 bg-[#05070d]/60 p-5 shadow-[0_0_30px_rgba(6,182,212,.08)]">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="NIP">
            <input
              value={form.nip}
              onChange={handleChange("nip")}
              className="field-input"
              placeholder="NIP pejabat"
              inputMode="numeric"
              maxLength={30}
            />
          </Field>
          <Field label="Nama Pejabat">
            <input
              value={form.nama}
              onChange={handleChange("nama")}
              className="field-input"
              placeholder="Tulis huruf kapital"
            />
          </Field>
          <Field label="Jabatan">
            <input
              value={form.jabatan}
              onChange={handleChange("jabatan")}
              className="field-input"
              placeholder="Jabatan pejabat"
            />
          </Field>
          <Field label="Pejabat Struktural">
            <TypeableSelect value={form.is_struktural} onChange={handleChange("is_struktural")}>
              <option value="1">YA</option>
              <option value="0">TIDAK</option>
            </TypeableSelect>
          </Field>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/50 bg-emerald-500/10 px-5 py-2 text-sm font-semibold text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,.25)] hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Pejabat
          </button>
        </div>
      </section>

      {modal && (
        <NeonModal
          open={modal.open}
          kind={modal.kind}
          title={modal.title}
          message={modal.message}
          onClose={() => {
            setModal(null);
            if (modal.goBack) router.push("/setting/pejabat");
          }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col text-sm text-cyan-100/90">
      <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}


