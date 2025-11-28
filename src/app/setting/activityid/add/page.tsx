"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";

type GroupOption = {
  user_level: number;
  level_name: string;
};

type FormState = {
  activity: string;
  group_id: string;
};

type ModalState = {
  open: boolean;
  kind: ModalKind;
  title: string;
  message: string;
  goBack?: boolean;
};

const initialForm: FormState = {
  activity: "",
  group_id: "0",
};

export default function SettingActivityIdAddPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);

  useEffect(() => {
    void fetchGroups();
  }, []);

  async function fetchGroups() {
    try {
      setLoadingGroups(true);
      const res = await fetch("/api/setting/activityid/groups", {
        cache: "no-store",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Gagal memuat daftar group user.");
      }
      const list: GroupOption[] = Array.isArray(json?.data?.rows) ? json.data.rows : [];
      setGroups(list);
    } catch (e: any) {
      setModal({
        open: true,
        kind: "error",
        title: "Gagal Memuat Group",
        message: e?.message || "Tidak dapat memuat daftar group user.",
      });
    } finally {
      setLoadingGroups(false);
    }
  }

  const handleChange =
    (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = field === "activity" ? event.target.value.toUpperCase() : event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  function validate(values: FormState) {
    if (!values.activity.trim()) return "Activity Name wajib diisi.";
    if (!values.group_id || values.group_id === "0") return "Silakan pilih group user.";
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
      const res = await fetch("/api/setting/activityid", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_nm: form.activity,
          user_level: form.group_id,
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Gagal menyimpan activity.");
      }
      setModal({
        open: true,
        kind: "success",
        title: "Activity Ditambahkan",
        message: json?.message || "Activity baru berhasil disimpan.",
        goBack: true,
      });
      setForm(initialForm);
    } catch (e: any) {
      setModal({
        open: true,
        kind: "error",
        title: "Gagal Menyimpan",
        message: e?.message || "Terjadi kesalahan saat menyimpan activity.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      {/* Ambient glow – sama seperti list page */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[8%] top-[-25%] h-[900px] w-[900px] rounded-full bg-cyan-500/20 blur-[220px]" />
        <div className="absolute right-[12%] bottom-[-30%] h-[900px] w-[900px] rounded-full bg-fuchsia-600/15 blur-[220px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl overflow-hidden">
        {/* ===== Header mengikuti style halaman list ===== */}
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              <div>
                <h1 className="text-base font-semibold tracking-wide text-cyan-200">
                  Tambah Activity ID
                </h1>
                <p className="text-xs text-cyan-200/70">
                  Mendaftarkan activity baru dan mengaitkannya dengan group level user.
                </p>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/setting/activityid")}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Kembali ke List
              </button>
            </div>
          </div>
        </header>

        {/* ===== Body: form ===== */}
        <div className="space-y-6 px-5 py-6">
          <p className="text-xs text-cyan-200/75">
            Activity yang ditambahkan akan dipakai sebagai referensi monitoring harian dan
            dibatasi berdasarkan group user yang dipilih.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Activity Name">
              <input
                value={form.activity}
                onChange={handleChange("activity")}
                className="field-input"
                placeholder="Nama activity"
              />
            </Field>
            <Field label="Group User">
              <select
                value={form.group_id}
                onChange={handleChange("group_id")}
                className="field-input"
                disabled={loadingGroups}
              >
                <option value="0">-- Pilih Group --</option>
                {groups.map((group) => (
                  <option key={group.user_level} value={group.user_level}>
                    {group.level_name}
                  </option>
                ))}
              </select>
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
              Simpan Activity
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
            if (goBack) router.push("/setting/activityid");
          }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col text-sm text-cyan-100/90">
      <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
