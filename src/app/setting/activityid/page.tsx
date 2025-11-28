// FILE: src/app/setting/activityid/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCcw, Pencil, Trash2, Shield, Eye } from "lucide-react";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";

type GroupOption = {
  user_level: number;
  level_name: string;
};

type ActivityRow = {
  activity_id: number;
  activity: string;
  user_level: number;
  level_name: string;
};

type ModalState = {
  open: boolean;
  kind: ModalKind;
  title: string;
  message: string;
};

export default function SettingActivityIdPage() {
  const router = useRouter();

  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);

  const [filters, setFilters] = useState<{ group_id: string }>({ group_id: "0" });

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [alert, setAlert] = useState<ModalState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    row: ActivityRow | null;
    loading: boolean;
  }>({ open: false, row: null, loading: false });

  useEffect(() => {
    void fetchGroups();
    void fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchGroups() {
    try {
      setGroupLoading(true);
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
      setAlert({
        open: true,
        kind: "error",
        title: "Gagal Memuat Group",
        message: e?.message || "Tidak dapat memuat daftar group user.",
      });
    } finally {
      setGroupLoading(false);
    }
  }

  async function fetchRows(targetGroup?: string) {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      const groupParam = targetGroup ?? filters.group_id;
      if (groupParam && groupParam !== "0") params.set("group_id", groupParam);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/setting/activityid${qs}`, {
        cache: "no-store",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Gagal memuat daftar activity.");
      }
      const list: ActivityRow[] = Array.isArray(json?.data?.rows) ? json.data.rows : [];
      setRows(
        list.map((item) => ({
          activity_id: Number(item.activity_id),
          activity: item.activity?.trim() ?? "",
          user_level: Number(item.user_level),
          level_name: item.level_name?.trim() ?? "",
        }))
      );
    } catch (e: any) {
      setRows([]);
      setError(e?.message || "Gagal memuat daftar activity.");
    } finally {
      setLoading(false);
    }
  }

  const selectedGroup = useMemo(() => {
    if (!filters.group_id || filters.group_id === "0") return null;
    const lvl = Number(filters.group_id);
    return groups.find((g) => g.user_level === lvl) ?? null;
  }, [filters.group_id, groups]);

  function handleGroupChange(value: string) {
    setFilters({ group_id: value });
    void fetchRows(value);
  }

  const filterDirty = filters.group_id !== "0";

  function handleResetFilter() {
    if (!filterDirty) return;
    setFilters({ group_id: "0" });
    void fetchRows("0");
  }

  function openDeleteConfirm(row: ActivityRow) {
    setConfirmDelete({ open: true, row, loading: false });
  }

  async function handleDelete() {
    if (!confirmDelete.row) return;
    try {
      setConfirmDelete((prev) => ({ ...prev, loading: true }));
      const res = await fetch(`/api/setting/activityid/${confirmDelete.row.activity_id}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Gagal menghapus activity.");
      }
      setAlert({
        open: true,
        kind: "success",
        title: "Activity Dihapus",
        message: json?.message || "Activity berhasil dihapus.",
      });
      await fetchRows();
    } catch (e: any) {
      setAlert({
        open: true,
        kind: "error",
        title: "Gagal Menghapus",
        message: e?.message || "Terjadi kesalahan saat menghapus activity.",
      });
    } finally {
      setConfirmDelete({ open: false, row: null, loading: false });
    }
  }

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[8%] top-[-25%] h-[900px] w-[900px] rounded-full bg-cyan-500/20 blur-[220px]" />
        <div className="absolute right-[12%] bottom-[-30%] h-[900px] w-[900px] rounded-full bg-fuchsia-600/15 blur-[220px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        {/* ===== Header (mengikuti Manajemen User) ===== */}
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              <div>
                <h1 className="text-base font-semibold tracking-wide text-cyan-200">
                  Setting Activity ID
                </h1>
                <p className="text-xs text-cyan-200/70">
                  Mengelola daftar activity harian yang dikaitkan dengan level user.
                </p>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="hidden sm:inline-flex items-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
                <Shield className="mr-1 h-3.5 w-3.5" />
                {selectedGroup ? `Group: ${selectedGroup.level_name}` : "Semua group user"}
              </div>

              <button
                type="button"
                onClick={() => void fetchRows()}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCcw className="h-3.5 w-3.5" />
                )}
                Refresh
              </button>

              <button
                type="button"
                onClick={() => router.push("/setting/activityid/add")}
                className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-3 py-1.5 text-[11px] font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Activity
              </button>
            </div>
          </div>
        </header>

        {/* ===== Body ===== */}
        <div className="space-y-6 px-5 py-6">
          {/* Filter block */}
          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
            <div className="flex flex-wrap items-start gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.4em] text-cyan-400/60">
                  Filter
                </p>
                <h2 className="text-sm font-semibold text-cyan-100">Filter Activity</h2>
                <p className="text-xs text-cyan-200/70">
                  Pilih group user untuk menyaring daftar activity ID yang tampil.
                </p>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleResetFilter}
                  disabled={!filterDirty || loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-white/5 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => void fetchRows()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Shield className="h-4 w-4" />
                  )}
                  Terapkan
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,2fr)] md:items-end">
              <label className="flex flex-col text-sm text-cyan-100/90">
                <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
                  Pilih Group User
                </span>
                <select
                  value={filters.group_id}
                  onChange={(e) => handleGroupChange(e.target.value)}
                  className="field-input mt-1"
                  disabled={groupLoading}
                >
                  <option value="0">-- Semua Group --</option>
                  {groups.map((g) => (
                    <option key={g.user_level} value={g.user_level}>
                      {g.level_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? (
              <p className="mt-3 text-sm text-rose-300/90">{error}</p>
            ) : null}
          </div>

          {/* Summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-900/40 bg-[#05070d]/50 px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-cyan-200/80">
              <Shield className="h-4 w-4" />
              <span>{rows.length} activity</span>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            <div className="text-xs">
              <span
                className={`rounded-full border px-3 py-1 ${
                  filterDirty
                    ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100"
                    : "border-cyan-900/60 bg-cyan-900/20 text-cyan-200/70"
                }`}
              >
                {filterDirty
                  ? selectedGroup
                    ? `Filter group: ${selectedGroup.level_name}`
                    : "Filter group aktif"
                  : "Tanpa filter group"}
              </span>
            </div>
          </div>

          {/* Table block */}
          <div className="overflow-x-auto rounded-2xl border border-cyan-900/40 bg-[#04060b]/60">
            <table className="min-w-full divide-y divide-cyan-900/50 text-sm">
              <thead className="bg-cyan-950/40 text-xs uppercase tracking-wide text-cyan-200/60">
                <tr>
                  <th className="px-4 py-3 text-left">No</th>
                  <th className="px-4 py-3 text-left">Activity</th>
                  <th className="px-4 py-3 text-left">Group User</th>
                  <th className="px-4 py-3 text-center">Operasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-900/30">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-cyan-100/60">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      <p className="mt-2 text-xs">Memuat daftar activity...</p>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-cyan-100/60">
                      {error ? error : "Belum ada activity untuk filter yang dipilih."}
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr key={row.activity_id} className="hover:bg-cyan-500/5">
                      <td className="px-4 py-3 text-sm text-cyan-100/70">{idx + 1}</td>
                      <td className="px-4 py-3 text-cyan-50">{row.activity}</td>
                      <td className="px-4 py-3 text-cyan-100/80">{row.level_name}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {/* tombol LIHAT baru */}
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/40 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-400/15 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                            onClick={() =>
                              router.push(`/setting/activityid/lihat/${row.activity_id}`)
                            }
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Lihat
                          </button>

                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-500/15 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                            onClick={() => router.push(`/setting/activityid/edit/${row.activity_id}`)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 px-2 py-1 text-xs text-rose-100 hover:bg-rose-500/15 focus:outline-none focus:ring-2 focus:ring-rose-400/40"
                            onClick={() => openDeleteConfirm(row)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Hapus
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

      {alert && (
        <NeonModal
          open={alert.open}
          kind={alert.kind}
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      {confirmDelete.open && confirmDelete.row && (
        <NeonModal
          open={confirmDelete.open}
          kind="confirm"
          title="Hapus Activity?"
          message={`Anda akan menghapus activity "${confirmDelete.row.activity}". Data harian terkait akan dipindahkan ke backup sebelum dihapus.`}
          confirmText="Ya, hapus"
          cancelText="Batal"
          loading={confirmDelete.loading}
          onConfirm={() => void handleDelete()}
          onClose={() => {
            if (confirmDelete.loading) return;
            setConfirmDelete({ open: false, row: null, loading: false });
          }}
        />
      )}
    </div>
  );
}

