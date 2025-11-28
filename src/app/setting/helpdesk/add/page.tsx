"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, LifeBuoy } from "lucide-react";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";

type FormState = {
  helpdesk_nm: string;
};

type ModalState = {
  open: boolean;
  kind: ModalKind;
  title: string;
  message: string;
  goBack?: boolean;
};

const initialForm: FormState = { helpdesk_nm: "" };

export default function SettingHelpdeskAddPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value.toUpperCase();
    setForm({ helpdesk_nm: value });
  };

  function validate(values: FormState) {
    if (!values.helpdesk_nm.trim()) return "Nama helpdesk wajib diisi.";
    return null;
  }

  async function handleSubmit() {
    const validationError = validate(form);
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
      const res = await fetch("/api/setting/helpdesk", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpdesk_nm: form.helpdesk_nm }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal menyimpan helpdesk.");
      setModal({
        open: true,
        kind: "success",
        title: "Helpdesk Ditambahkan",
        message: json?.message || "Helpdesk baru berhasil disimpan.",
        goBack: true,
      });
      setForm(initialForm);
    } catch (e: any) {
      setModal({
        open: true,
        kind: "error",
        title: "Gagal Menyimpan",
        message: e?.message || "Terjadi kesalahan saat menyimpan helpdesk.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[8%] top-[-25%] h-[900px] w-[900px] rounded-full bg-cyan-500/20 blur-[220px]" />
        <div className="absolute right-[12%] bottom-[-30%] h-[900px] w-[900px] rounded-full bg-fuchsia-600/15 blur-[220px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl overflow-hidden">
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              <div>
                <h1 className="text-base font-semibold tracking-wide text-cyan-200">
                  Tambah Helpdesk
                </h1>
                <p className="text-xs text-cyan-200/70">
                  Mendaftarkan opsi helpdesk yang akan dipakai pengguna.
                </p>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/setting/helpdesk")}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Kembali ke List
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-6 px-5 py-6">
          <p className="text-xs text-cyan-200/75">
            Data helpdesk ini akan muncul di pilihan aplikasi mobile/web.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nama Helpdesk" icon={<LifeBuoy className="h-4 w-4 text-cyan-300" />}>
              <input
                value={form.helpdesk_nm}
                onChange={handleChange}
                className="field-input"
                placeholder="Tuliskan nama helpdesk"
              />
            </Field>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/50 bg-emerald-500/10 px-5 py-2 text-sm font-semibold text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,.25)] hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Helpdesk
            </button>
          </div>
        </div>
      </section>

      {modal && (
        <NeonModal
          open={modal.open}
          kind={modal.kind}
          title={modal.title}
          message={modal.message}
          onClose={() => {
            const goBack = modal.goBack;
            setModal(null);
            if (goBack) router.push("/setting/helpdesk");
          }}
        />
      )}
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col text-sm text-cyan-100/90">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
        {icon}
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
