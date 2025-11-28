"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, LifeBuoy } from "lucide-react";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";

type Detail = {
  helpdesk_id: string;
  helpdesk_nm: string;
};

type ModalState = {
  open: boolean;
  kind: ModalKind;
  title: string;
  message: string;
  redirect?: string | null;
};

const emptyDetail: Detail = {
  helpdesk_id: "",
  helpdesk_nm: "",
};

export default function SettingHelpdeskEditPage() {
  const router = useRouter();
  const params = useParams<{ helpdeskId?: string }>();
  const helpdeskIdParam = useMemo(() => {
    const raw = params?.helpdeskId;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [detail, setDetail] = useState<Detail>(emptyDetail);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);

  useEffect(() => {
    if (!helpdeskIdParam) {
      setModal({
        open: true,
        kind: "error",
        title: "ID tidak valid",
        message: "Helpdesk ID tidak ditemukan pada URL.",
        redirect: "/setting/helpdesk",
      });
      setLoading(false);
      return;
    }
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helpdeskIdParam]);

  async function loadDetail() {
    try {
      setLoading(true);
      const res = await fetch(`/api/setting/helpdesk/${helpdeskIdParam}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Gagal memuat data helpdesk.");
      }
      const data = json?.data ?? {};
      setDetail({
        helpdesk_id: String(data.helpdesk_id ?? ""),
        helpdesk_nm: String(data.helpdesk_nm ?? "").toUpperCase(),
      });
    } catch (e: any) {
      setModal({
        open: true,
        kind: "error",
        title: "Gagal Memuat",
        message: e?.message || "Tidak dapat memuat detail helpdesk.",
        redirect: "/setting/helpdesk",
      });
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value.toUpperCase();
    setDetail((prev) => ({ ...prev, helpdesk_nm: value }));
  };

  function validate(values: Detail) {
    if (!values.helpdesk_nm.trim()) return "Nama helpdesk wajib diisi.";
    return null;
  }

  async function handleSubmit() {
    const validation = validate(detail);
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
      const res = await fetch(`/api/setting/helpdesk/${helpdeskIdParam}`, {
        method: "PUT",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpdesk_nm: detail.helpdesk_nm }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Gagal menyimpan helpdesk.");
      }
      setModal({
        open: true,
        kind: "success",
        title: "Helpdesk Diperbarui",
        message: json?.message || "Perubahan helpdesk berhasil disimpan.",
        redirect: "/setting/helpdesk",
      });
    } catch (e: any) {
      setModal({
        open: true,
        kind: "error",
        title: "Gagal Menyimpan",
        message: e?.message || "Terjadi kesalahan saat menyimpan helpdesk.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[8%] top-[-25%] h-[900px] w-[900px] rounded-full bg-cyan-500/20 blur-[220px]" />
        <div className="absolute right-[12%] bottom-[-30%] h-[900px] w-[900px] rounded-full bg-fuchsia-600/15 blur-[220px]" />
      </div>

      <section className="overflow-hidden rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              <div>
                <h1 className="text-base font-semibold tracking-wide text-cyan-200">
                  Edit Helpdesk
                </h1>
                <p className="text-xs text-cyan-200/70">Perbarui nama helpdesk.</p>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!loading && detail.helpdesk_id && (
                <span className="hidden rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/90 sm:inline-flex items-center gap-1">
                  Kode: {detail.helpdesk_id}
                </span>
              )}

              <button
                type="button"
                onClick={() => router.push("/setting/helpdesk")}
                className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-3 py-1.5 text-[11px] font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Kembali ke List
              </button>
            </div>
          </div>
        </header>

        <div className="px-5 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-cyan-200/70">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="mt-3 text-sm">Memuat detail helpdesk...</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Helpdesk Code">
                  <input value={detail.helpdesk_id} className="field-input" readOnly />
                </Field>
                <Field label="Helpdesk Name" hint="Gunakan huruf kapital untuk konsistensi">
                  <input value={detail.helpdesk_nm} onChange={handleChange} className="field-input" />
                </Field>
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
              modal.redirect || (modal.kind === "success" ? "/setting/helpdesk" : null);
            setModal(null);
            if (redirect) router.push(redirect);
          }}
        />
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col text-sm text-cyan-100/90">
      <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {hint ? <span className="mt-1 text-[11px] text-cyan-300/70">{hint}</span> : null}
    </label>
  );
}
