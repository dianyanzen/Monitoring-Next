"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";

type FormState = {
  activity_id: string;
  activity: string;
  user_level: string;
  level_name: string;
};

type ModalState = {
  open: boolean;
  kind: ModalKind;
  title: string;
  message: string;
  redirect?: string | null;
};

const initialForm: FormState = {
  activity_id: "",
  activity: "",
  user_level: "",
  level_name: "",
};

export default function SettingActivityIdEditPage() {
  const router = useRouter();
  const params = useParams<{ activityId?: string }>();
  const activityIdParam = useMemo(() => {
    const raw = params?.activityId;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);

  useEffect(() => {
    if (!activityIdParam) {
      setModal({
        open: true,
        kind: "error",
        title: "ID tidak valid",
        message: "Activity ID tidak ditemukan pada URL.",
        redirect: "/setting/activityid",
      });
      setLoading(false);
      return;
    }
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityIdParam]);

  async function loadDetail() {
    try {
      setLoading(true);
      const res = await fetch(`/api/setting/activityid/${activityIdParam}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Gagal memuat data activity.");
      }
      const data = json?.data;
      setForm({
        activity_id: String(data?.activity_id ?? ""),
        activity: (data?.activity ?? "").toUpperCase(),
        user_level: String(data?.user_level ?? ""),
        level_name: data?.level_name ?? "",
      });
    } catch (e: any) {
      setModal({
        open: true,
        kind: "error",
        title: "Gagal Memuat",
        message: e?.message || "Tidak dapat memuat detail activity.",
        redirect: "/setting/activityid",
      });
    } finally {
      setLoading(false);
    }
  }

  const handleChange =
    (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value.toUpperCase();
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  function validate(values: FormState) {
    if (!values.activity.trim()) return "Activity Name wajib diisi.";
    return null;
  }

  async function handleSubmit() {
    const validation = validate(form);
    if (validation) {
      setModal({
        open: true,
        kind: "warning",
        title: "Validasi Gagal",
        message: validation,
      });
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/setting/activityid/${activityIdParam}`, {
        method: "PUT",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_nm: form.activity }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Gagal menyimpan activity.");
      }
      setModal({
        open: true,
        kind: "success",
        title: "Activity Diperbarui",
        message: json?.message || "Perubahan activity berhasil disimpan.",
        redirect: "/setting/activityid",
      });
    } catch (e: any) {
      setModal({
        open: true,
        kind: "error",
        title: "Gagal Menyimpan",
        message: e?.message || "Terjadi kesalahan saat menyimpan activity.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      {/* Ambient glow – sama seperti list/add/view */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[8%] top-[-25%] h-[900px] w-[900px] rounded-full bg-cyan-500/20 blur-[220px]" />
        <div className="absolute right-[12%] bottom-[-30%] h-[900px] w-[900px] rounded-full bg-fuchsia-600/15 blur-[220px]" />
      </div>

      <section className="overflow-hidden rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        {/* ===== Header: diselaraskan dengan halaman lain ===== */}
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              <div>
                <h1 className="text-base font-semibold tracking-wide text-cyan-200">
                  Edit Activity ID
                </h1>
                <p className="text-xs text-cyan-200/70">
                  Perbarui nama activity tanpa mengubah group user yang sudah terikat.
                </p>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!loading && form.activity_id && (
                <span className="hidden rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/90 sm:inline-flex items-center gap-1">
                  Kode: {form.activity_id}
                </span>
              )}
              {!loading && form.level_name && (
                <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-100/90 sm:inline-flex items-center gap-1">
                  Group: {form.level_name}
                </span>
              )}

              <button
                type="button"
                onClick={() => router.push("/setting/activityid")}
                className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-3 py-1.5 text-[11px] font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Kembali ke List
              </button>
            </div>
          </div>
        </header>

        {/* ===== Body ===== */}
        <div className="px-5 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-cyan-200/70">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="mt-3 text-sm">Memuat detail activity...</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Activity Code">
                  <input value={form.activity_id} className="field-input" readOnly />
                </Field>
                <Field label="Group User">
                  <input value={form.level_name} className="field-input" readOnly />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Activity Name">
                    <input
                      value={form.activity}
                      onChange={handleChange("activity")}
                      className="field-input"
                    />
                  </Field>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/50 bg-emerald-500/10 px-5 py-2 text-sm font-semibold text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,.25)] hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Simpan Perubahan
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {modal && (
        <NeonModal
          open={modal.open}
          kind={modal.kind}
          title={modal.title}
          message={modal.message}
          onClose={() => {
            const redirect =
              modal.redirect || (modal.kind === "success" ? "/setting/activityid" : null);
            setModal(null);
            if (redirect) router.push(redirect);
          }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col text-sm text-cyan-100/90">
      <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
