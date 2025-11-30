"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, Layers3 } from "lucide-react";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";

type Detail = {
  menu_id: string;
  parent_id: string;
  parent_title: string;
  title: string;
  menu_level: string;
  level_head: string;
  level_sub: string;
};

type ModalState = {
  open: boolean;
  kind: ModalKind;
  title: string;
  message: string;
  redirect?: string | null;
};

type ParentOption = { menu_id: number; title: string };

const emptyDetail: Detail = {
  menu_id: "",
  parent_id: "",
  parent_title: "",
  title: "",
  menu_level: "",
  level_head: "",
  level_sub: "",
};

export default function SettingMenuUserEditPage() {
  const router = useRouter();
  const params = useParams<{ menuId?: string }>();
  const menuIdParam = useMemo(() => {
    const raw = params?.menuId;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [detail, setDetail] = useState<Detail>(emptyDetail);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parents, setParents] = useState<ParentOption[]>([]);
  const [modal, setModal] = useState<ModalState | null>(null);

  useEffect(() => {
    if (!menuIdParam) {
      setModal({
        open: true,
        kind: "error",
        title: "ID tidak valid",
        message: "Menu ID tidak ditemukan pada URL.",
        redirect: "/setting/menuuser",
      });
      setLoading(false);
      return;
    }
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuIdParam]);

  async function loadParents(level: string) {
    if (!level) return;
    try {
      const res = await fetch(`/api/setting/menuuser/parents?menu_level=${encodeURIComponent(level)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat parent menu");
      const list: ParentOption[] = Array.isArray(json?.data) ? json.data : [];
      setParents(list);
    } catch (e) {
      setParents([]);
    }
  }

  async function loadDetail() {
    try {
      setLoading(true);
      const res = await fetch(`/api/setting/menuuser/${menuIdParam}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Gagal memuat data menu.");
      }
      const data = json?.data ?? {};
      const next: Detail = {
        menu_id: String(data.menu_id ?? ""),
        parent_id: data.parent_id == null ? "" : String(data.parent_id),
        parent_title: String(data.parent_title ?? ""),
        title: String(data.title ?? ""),
        menu_level: String(data.menu_level ?? ""),
        level_head: String(data.level_head ?? ""),
        level_sub: String(data.level_sub ?? ""),
      };
      setDetail(next);
      await loadParents(next.menu_level);
    } catch (e: any) {
      setModal({
        open: true,
        kind: "error",
        title: "Gagal Memuat",
        message: e?.message || "Tidak dapat memuat detail menu.",
        redirect: "/setting/menuuser",
      });
    } finally {
      setLoading(false);
    }
  }

  const handleChange =
    (field: keyof Detail) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setDetail((prev) => ({ ...prev, [field]: value }));
      if (field === "menu_level") {
        void loadParents(value);
      }
    };

  function validate(values: Detail) {
    if (!values.title.trim()) return "Title wajib diisi.";
    if (!values.menu_level.trim()) return "Menu level wajib diisi.";
    if (!values.level_head.trim()) return "Level head wajib diisi.";
    if (!values.level_sub.trim()) return "Level sub wajib diisi.";
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
      const res = await fetch(`/api/setting/menuuser/${menuIdParam}`, {
        method: "PUT",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: detail.title,
          parent_id: detail.parent_id === "" ? null : Number(detail.parent_id),
          menu_level: Number(detail.menu_level),
          level_head: Number(detail.level_head),
          level_sub: Number(detail.level_sub),
        }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Gagal menyimpan menu.");
      }
      setModal({
        open: true,
        kind: "success",
        title: "Menu Diperbarui",
        message: json?.message || "Perubahan menu berhasil disimpan.",
        redirect: "/setting/menuuser",
      });
    } catch (e: any) {
      setModal({
        open: true,
        kind: "error",
        title: "Gagal Menyimpan",
        message: e?.message || "Terjadi kesalahan saat menyimpan menu.",
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
                  Edit User Menu
                </h1>
                <p className="text-xs text-cyan-200/70">Perbarui struktur dan penamaan menu.</p>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!loading && detail.menu_id && (
                <span className="hidden rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/90 sm:inline-flex items-center gap-1">
                  Kode: {detail.menu_id}
                </span>
              )}

              <button
                type="button"
                onClick={() => router.push("/setting/menuuser")}
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
              <p className="mt-3 text-sm">Memuat detail menu...</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Menu ID">
                  <input value={detail.menu_id} className="field-input" readOnly />
                </Field>
                <Field label="Parent Menu">
                  <select
                    value={detail.parent_id}
                    onChange={handleChange("parent_id")}
                    className="field-input"
                    disabled={saving || parents.length === 0}
                  >
                    {parents.length === 0 ? (
                      <option value="">Tidak ada parent</option>
                    ) : (
                      parents.map((p) => (
                        <option key={p.menu_id} value={p.menu_id}>
                          {p.title}
                        </option>
                      ))
                    )}
                  </select>
                </Field>
                <div className="md:col-span-2">
                  <Field label="Title">
                    <input value={detail.title} onChange={handleChange("title")} className="field-input" />
                  </Field>
                </div>
                <Field label="Menu Level">
                  <select
                    value={detail.menu_level}
                    onChange={handleChange("menu_level")}
                    className="field-input"
                    disabled={saving}
                  >
                    <option value="1">Level 1</option>
                    <option value="2">Level 2</option>
                    <option value="3">Level 3</option>
                  </select>
                </Field>
                <Field label="Level Head">
                  <input value={detail.level_head} onChange={handleChange("level_head")} className="field-input" />
                </Field>
                <Field label="Level Sub">
                  <input value={detail.level_sub} onChange={handleChange("level_sub")} className="field-input" />
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
              modal.redirect || (modal.kind === "success" ? "/setting/menuuser" : null);
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
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
        <Layers3 className="h-3.5 w-3.5 text-cyan-300" />
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
