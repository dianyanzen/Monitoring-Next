// FILE: src/app/setting/user/page.tsx
"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  UserPlus,
  Search,
  RefreshCcw,
  Eye,
  Pencil,
  Trash2,
  KeyRound,
  Users,
} from "lucide-react";
import { useSession } from "@/contexts/session";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";
import TypeableSelect from "@/components/ui/TypeableSelect";

type LevelOption = { user_level: string; level_name: string; group_name?: string };
type UserRow = {
  no: number;
  user_id: string;
  nama_lgkp: string;
  nama_dpn?: string | null;
  nik: string;
  user_level: string;
  level_name?: string | null;
  group_name?: string | null;
  is_active: boolean;
};

type ModalState = {
  open: boolean;
  kind: ModalKind;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  mode: "notice" | "confirm";
  onConfirm?: (() => Promise<void>) | null;
};

const initialModal: ModalState = {
  open: false,
  kind: "info",
  title: "",
  message: "",
  mode: "notice",
  onConfirm: null,
};

export default function SettingUserPage() {
  const router = useRouter();
  const { user } = useSession();

  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(true);
  const [levelsError, setLevelsError] = useState<string | null>(null);

  const [filterLevel, setFilterLevel] = useState("0");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterUserNm, setFilterUserNm] = useState("");

  const [rows, setRows] = useState<UserRow[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>(initialModal);

  /* ---------------- Fetch level options ---------------- */
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        setLevelsLoading(true);
        setLevelsError(null);
        const res = await fetch("/api/setting/users/levels", {
          credentials: "include",
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat level");
        if (stop) return;
        const opts: LevelOption[] = Array.isArray(json?.data) ? json.data : [];
        setLevels(opts);
      } catch (e: any) {
        if (!stop) setLevelsError(e?.message || "Gagal memuat level");
      } finally {
        if (!stop) setLevelsLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, []);

  async function fetchRows(
    overrides?: Partial<{ level: string; userId: string; userNm: string }>
  ) {
    try {
      setTableLoading(true);
      setTableError(null);
      const nextLevel = overrides?.level ?? filterLevel;
      const nextUserId = (overrides?.userId ?? filterUserId).trim();
      const nextUserNm = (overrides?.userNm ?? filterUserNm).trim();
      const params = new URLSearchParams();
      if (nextLevel && nextLevel !== "0") params.set("level_id", nextLevel);
      if (nextUserId) params.set("user_id", nextUserId);
      if (nextUserNm) params.set("user_nm", nextUserNm);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/setting/users${qs}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat daftar user");
      const list: UserRow[] = Array.isArray(json?.data?.rows) ? json.data.rows : [];
      setRows(list);
    } catch (e: any) {
      setRows([]);
      setTableError(e?.message || "Gagal memuat daftar user");
    } finally {
      setTableLoading(false);
    }
  }

  useEffect(() => {
    void fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Actions ---------------- */
  function openNotice(kind: ModalKind, title: string, message: string) {
    setModal({
      open: true,
      kind,
      title,
      message,
      mode: "notice",
      onConfirm: null,
      loading: false,
    });
  }

  function askConfirm(title: string, message: string, confirmText: string, onConfirm: () => Promise<void>) {
    setModal({
      open: true,
      kind: "confirm",
      title,
      message,
      confirmText,
      cancelText: "Batal",
      mode: "confirm",
      loading: false,
      onConfirm,
    });
  }

  const handleResetPassword = (row: UserRow) => {
    askConfirm(
      "Reset Password",
      `Reset password user ${row.user_id} ke nilai default?`,
      "Reset Sekarang",
      async () => {
        try {
          setModal((prev) => ({ ...prev, loading: true }));
          const res = await fetch(`/api/setting/users/${encodeURIComponent(row.user_id)}/reset-password`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
          const json = await res.json();
          if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal mereset password");
          setModal({
            open: true,
            kind: "success",
            title: "Reset Password",
            message: `Password user ${row.user_id} berhasil direset menjadi ${json?.data?.new_password ?? "default"}.`,
            mode: "notice",
          });
        } catch (e: any) {
          setModal({
            open: true,
            kind: "error",
            title: "Reset Password",
            message: e?.message || "Terjadi kesalahan saat mereset password",
            mode: "notice",
          });
        }
      }
    );
  };

  const handleDelete = (row: UserRow) => {
    askConfirm(
      "Nonaktifkan User",
      `Apakah Anda yakin ingin menonaktifkan user ${row.user_id}?`,
      "Nonaktifkan",
      async () => {
        try {
          setModal((prev) => ({ ...prev, loading: true }));
          const res = await fetch(`/api/setting/users/${encodeURIComponent(row.user_id)}`, {
            method: "DELETE",
            credentials: "include",
          });
          const json = await res.json();
          if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal menonaktifkan user");
          setModal({
            open: true,
            kind: "success",
            title: "Nonaktifkan User",
            message: `User ${row.user_id} telah dinonaktifkan.`,
            mode: "notice",
          });
          void fetchRows();
        } catch (e: any) {
          setModal({
            open: true,
            kind: "error",
            title: "Nonaktifkan User",
            message: e?.message || "Tidak dapat menonaktifkan user",
            mode: "notice",
          });
        }
      }
    );
  };

  function closeModal() {
    if (modal.loading) return;
    setModal((prev) => ({ ...prev, open: false }));
  }

  const currentUser = (user as any)?.S_NAMA_LGKP ?? (user as any)?.S_USER_ID ?? "-";
  const filtersDirty =
    filterLevel !== "0" || filterUserId.trim().length > 0 || filterUserNm.trim().length > 0;

  function handleResetFilters() {
    if (!filtersDirty) return;
    setFilterLevel("0");
    setFilterUserId("");
    setFilterUserNm("");
    void fetchRows({ level: "0", userId: "", userNm: "" });
  }

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[8%] top-[-25%] h-[900px] w-[900px] rounded-full bg-cyan-500/20 blur-[220px]" />
        <div className="absolute right-[12%] bottom-[-30%] h-[900px] w-[900px] rounded-full bg-fuchsia-600/15 blur-[220px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              <div>
                <h1 className="text-base font-semibold tracking-wide text-cyan-200">Manajemen User</h1>
              </div>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="hidden sm:inline-flex items-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
                User: {currentUser}
              </div>
              <button
                type="button"
                onClick={() => void fetchRows()}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => router.push('/setting/user/add')}
                className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-3 py-1.5 text-[11px] font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Tambah
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-6 px-5 py-6">
          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
            <div className="flex flex-wrap items-start gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.4em] text-cyan-400/60">Filter</p>
                <h2 className="text-sm font-semibold text-cyan-100">Filter Data User</h2>
                <p className="text-xs text-cyan-200/70">
                  Gunakan filter untuk memperkecil hasil pencarian user.
                </p>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  disabled={!filtersDirty || tableLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-white/5 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => void fetchRows()}
                  disabled={tableLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {tableLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Terapkan
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="User ID">
                <input
                  id="filter-userid"
                  type="text"
                  value={filterUserId}
                  onChange={(e) => setFilterUserId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void fetchRows()}
                  className="field-input"
                  placeholder="Cari User ID"
                />
              </Field>
              <Field label="Nama User">
                <input
                  id="filter-username"
                  type="text"
                  value={filterUserNm}
                  onChange={(e) => setFilterUserNm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void fetchRows()}
                  className="field-input"
                  placeholder="Masukkan nama user"
                />
              </Field>
              <Field label="Level User" hint={levelsError ? <span>{levelsError}</span> : undefined}>
                <TypeableSelect
                  id="filter-level"
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  disabled={levelsLoading}
                 
                >
                  <option value="0">-- Semua Level --</option>
                  {levels.map((lvl) => (
                    <option key={lvl.user_level} value={lvl.user_level}>
                      {lvl.user_level} - {lvl.level_name}
                    </option>
                  ))}
                </TypeableSelect>
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-900/40 bg-[#05070d]/50 px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-cyan-200/80">
              <Users className="h-4 w-4" />
              <span>{rows.length} user</span>
              {tableLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            <div className="text-xs">
              <span
                className={`rounded-full border px-3 py-1 ${
                  filtersDirty
                    ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100"
                    : "border-cyan-900/60 bg-cyan-900/20 text-cyan-200/70"
                }`}
              >
                {filtersDirty ? "Filter aktif" : "Tanpa filter"}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-cyan-900/40 bg-[#04060b]/60">
            <table className="min-w-full divide-y divide-cyan-900/40 text-sm text-cyan-100">
              <thead className="bg-cyan-950/40 text-xs uppercase tracking-wide text-cyan-200/70">
                <tr>
                  <th className="px-4 py-3 text-center">No</th>
                  <th className="px-4 py-3 text-left">User ID</th>
                  <th className="px-4 py-3 text-left">Nama User</th>
                  <th className="px-4 py-3 text-left">Level</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-900/30">
                {tableLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-cyan-200/80">
                      <div className="inline-flex items-center gap-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat data user...
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-cyan-200/70">
                      {tableError ?? "Belum ada data yang ditampilkan."}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.user_id} className="hover:bg-cyan-500/5">
                      <td className="px-4 py-3 text-center text-xs text-cyan-200/70">
                        {row.no}
                      </td>
                      <td className="px-4 py-3 font-semibold tracking-wide">
                        {row.user_id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-cyan-100">
                          {row.nama_lgkp}
                        </div>
                        {row.nik ? (
                          <div className="text-xs text-cyan-200/70">NIK: {row.nik}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>{row.level_name ?? row.user_level}</div>
                        {row.group_name ? (
                          <div className="text-xs text-cyan-200/70">
                            {row.group_name}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            row.is_active
                              ? "bg-emerald-500/10 text-emerald-200 border border-emerald-400/30"
                              : "bg-rose-500/10 text-rose-200 border border-rose-400/30"
                          }`}
                        >
                          {row.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/setting/user/lihat/${encodeURIComponent(row.user_id)}`
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-xl border border-cyan-400/40 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                          >
                            <Eye className="h-3.5 w-3.5" /> Lihat
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/setting/user/edit/${encodeURIComponent(row.user_id)}`
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-xl border border-amber-400/40 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/10 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetPassword(row)}
                            className="inline-flex items-center gap-1 rounded-xl border border-sky-400/40 px-3 py-1.5 text-xs text-sky-100 hover:bg-sky-500/10 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                          >
                            <KeyRound className="h-3.5 w-3.5" /> Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            className="inline-flex items-center gap-1 rounded-xl border border-rose-400/40 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/10 focus:outline-none focus:ring-2 focus:ring-rose-400/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <NeonModal
        open={modal.open}
        kind={modal.kind}
        title={modal.title}
        message={modal.message}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        loading={modal.loading}
        onClose={closeModal}
        onConfirm={
          modal.mode === "confirm"
            ? () => {
                modal.onConfirm && modal.onConfirm();
              }
            : undefined
        }
      />
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {hint ? <div className="mt-1 text-xs text-amber-300/80">{hint}</div> : null}
    </label>
  );
}


