"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCcw, Search, Pencil, Trash2 } from "lucide-react";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";
import SettingPageHeader from "@/components/setting/SettingPageHeader";

type PejabatRow = {
  pejabat_id: number;
  nip: string;
  nama: string;
  jabatan: string;
  is_struktural: boolean;
};

type ModalState = {
  open: boolean;
  kind: ModalKind;
  title: string;
  message: string;
};

export default function SettingPejabatPage() {
  const router = useRouter();
  const [filters, setFilters] = useState({ nip: "", nama: "" });
  const [rows, setRows] = useState<PejabatRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<ModalState | null>(null);
  const [deleteState, setDeleteState] = useState<{ row: PejabatRow | null; loading: boolean }>({
    row: null,
    loading: false,
  });

  useEffect(() => {
    void fetchRows();
  }, []);

  async function fetchRows() {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filters.nip.trim()) params.set("nip", filters.nip.trim());
      if (filters.nama.trim()) params.set("nama", filters.nama.trim());
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/setting/pejabat${qs}`, {
        cache: "no-store",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat data");
      const list: PejabatRow[] = Array.isArray(json?.data?.rows) ? json.data.rows : [];
      setRows(
        list.map((item) => ({
          pejabat_id: Number(item.pejabat_id),
          nip: item.nip,
          nama: item.nama,
          jabatan: item.jabatan,
          is_struktural: Boolean(item.is_struktural),
        }))
      );
    } catch (e: any) {
      setError(e?.message || "Gagal memuat data pejabat");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(field: "nip" | "nama", value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function openDeleteConfirm(row: PejabatRow) {
    setDeleteState({ row, loading: false });
  }

  async function confirmDelete() {
    if (!deleteState.row) return;
    try {
      setDeleteState((prev) => ({ ...prev, loading: true }));
      const res = await fetch(`/api/setting/pejabat/${deleteState.row.pejabat_id}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal menghapus data");
      setAlert({
        open: true,
        kind: "success",
        title: "Berhasil",
        message: json?.message || "Pejabat berhasil dihapus.",
      });
      await fetchRows();
    } catch (e: any) {
      setAlert({
        open: true,
        kind: "error",
        title: "Gagal Menghapus",
        message: e?.message || "Terjadi kesalahan saat menghapus pejabat.",
      });
    } finally {
      setDeleteState({ row: null, loading: false });
    }
  }

  const headerActions = (
    <>
      <button
        type="button"
        onClick={() => void fetchRows()}
        className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-60"
        disabled={loading}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
        Refresh
      </button>
      <button
        type="button"
        onClick={() => router.push("/setting/pejabat/add")}
        className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-3 py-1.5 text-[11px] font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400"
      >
        <Plus className="h-3.5 w-3.5" />
        Tambah
      </button>
    </>
  );

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[-15%] h-[950px] w-[950px] rounded-full bg-cyan-500/15 blur-[210px]" />
        <div className="absolute right-[15%] bottom-[-20%] h-[900px] w-[900px] rounded-full bg-fuchsia-600/12 blur-[190px]" />
      </div>

      <SettingPageHeader
        lead="Pengaturan Data Pejabat"
        title="List Pejabat Pembina"
        description="Kelola pejabat struktural/fungsional yang menjadi referensi penandatangan dan atasan pada berbagai modul."
        actions={headerActions}
      />

      {error && (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      <section className="rounded-3xl border border-cyan-900/40 bg-[#05070d]/60 p-5 shadow-[0_0_30px_rgba(6,182,212,.08)]">
        <h2 className="text-lg font-semibold text-cyan-50">Pencarian</h2>
        <p className="text-sm text-cyan-100/70">Filter data berdasarkan NIP atau nama pejabat.</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="NIP">
            <input
              value={filters.nip}
              onChange={(e) => handleFilterChange("nip", e.target.value.replace(/[^\d]/g, ""))}
              className="field-input"
              placeholder="NIP Pejabat"
              inputMode="numeric"
            />
          </Field>
          <Field label="Nama Pejabat">
            <input
              value={filters.nama}
              onChange={(e) => handleFilterChange("nama", e.target.value.toUpperCase())}
              className="field-input"
              placeholder="Nama lengkap"
            />
          </Field>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void fetchRows()}
            className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/40 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
          >
            <Search className="h-4 w-4" />
            Tampilkan
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-cyan-900/40 bg-[#05070d]/60 p-5 shadow-[0_0_30px_rgba(6,182,212,.08)]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-cyan-50">Daftar Pejabat</h2>
          <span className="text-sm text-cyan-200/70">{rows.length} data</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-cyan-900/50 text-sm text-cyan-100">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-cyan-300/80">
                <th className="px-3 py-2 text-left">No</th>
                <th className="px-3 py-2 text-left">NIP</th>
                <th className="px-3 py-2 text-left">Nama</th>
                <th className="px-3 py-2 text-left">Jabatan</th>
                <th className="px-3 py-2 text-center">Struktural</th>
                <th className="px-3 py-2 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-900/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-cyan-300" />
                    <p className="mt-2 text-xs uppercase tracking-wide text-cyan-300/70">Memuat data...</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-cyan-200/70">
                    {error ?? "Belum ada data yang ditampilkan."}
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row.pejabat_id} className="hover:bg-cyan-500/5">
                    <td className="px-3 py-3 text-xs text-cyan-200/70">{idx + 1}</td>
                    <td className="px-3 py-3 font-semibold tracking-wide">{row.nip || "-"}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{row.nama || "-"}</div>
                      <div className="text-xs text-cyan-200/70">ID: {row.pejabat_id}</div>
                    </td>
                    <td className="px-3 py-3 text-sm">{row.jabatan || "-"}</td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          row.is_struktural
                            ? "border border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                            : "border border-cyan-400/40 bg-cyan-500/10 text-cyan-100"
                        }`}
                      >
                        {row.is_struktural ? "YA" : "TIDAK"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/setting/pejabat/edit/${row.pejabat_id}`)}
                          className="inline-flex items-center gap-1 rounded-xl border border-amber-400/40 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/10 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteConfirm(row)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-400/40 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/10 focus:outline-none focus:ring-2 focus:ring-rose-400/40"
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
      </section>

      {deleteState.row && (
        <NeonModal
          open
          kind="confirm"
          title="Hapus Pejabat"
          message={`Apakah Anda yakin ingin menghapus ${deleteState.row.nama || deleteState.row.nip}?`}
          confirmText="Hapus"
          cancelText="Batal"
          loading={deleteState.loading}
          onConfirm={() => void confirmDelete()}
          onClose={() => {
            if (deleteState.loading) return;
            setDeleteState({ row: null, loading: false });
          }}
        />
      )}

      {alert && (
        <NeonModal
          open={alert.open}
          kind={alert.kind}
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert(null)}
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
