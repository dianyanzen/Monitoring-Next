"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Pencil, Plus, RefreshCcw, Trash2, LifeBuoy } from "lucide-react";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";

type Row = {
  helpdesk_id: number;
  helpdesk_nm: string;
};

type ModalState = {
  open: boolean;
  kind: ModalKind;
  title: string;
  message: string;
};

export default function SettingHelpdeskPage() {
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [confirm, setConfirm] = useState<{ open: boolean; target: Row | null; loading: boolean }>({
    open: false,
    target: null,
    loading: false,
  });

  useEffect(() => {
    void fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchRows() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/setting/helpdesk", { cache: "no-store", credentials: "include" });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat helpdesk");
      const list: Row[] = Array.isArray(json?.data?.rows) ? json.data.rows : [];
      setRows(list);
    } catch (e: any) {
      setRows([]);
      setError(e?.message || "Gagal memuat helpdesk");
    } finally {
      setLoading(false);
    }
  }

  const total = rows.length;

  function openDelete(row: Row) {
    setConfirm({ open: true, target: row, loading: false });
  }

  async function handleDelete() {
    if (!confirm.target) return;
    try {
      setConfirm((p) => ({ ...p, loading: true }));
      const res = await fetch(`/api/setting/helpdesk/${confirm.target.helpdesk_id}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal menghapus helpdesk");
      setModal({
        open: true,
        kind: "success",
        title: "Helpdesk Dihapus",
        message: json?.message || "Helpdesk berhasil dihapus.",
      });
      await fetchRows();
    } catch (e: any) {
      setModal({
        open: true,
        kind: "error",
        title: "Gagal Menghapus",
        message: e?.message || "Terjadi kesalahan saat menghapus helpdesk.",
      });
    } finally {
      setConfirm({ open: false, target: null, loading: false });
    }
  }

  const bodyState = useMemo(() => {
    if (loading) {
      return (
        <tr>
          <td colSpan={3} className="px-4 py-8 text-center text-cyan-100/70">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            <p className="mt-2 text-xs">Memuat daftar helpdesk...</p>
          </td>
        </tr>
      );
    }
    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={3} className="px-4 py-6 text-center text-cyan-100/70">
            {error ?? "Belum ada helpdesk yang terdaftar."}
          </td>
        </tr>
      );
    }
    return rows.map((row, idx) => (
      <tr key={row.helpdesk_id} className="hover:bg-cyan-500/5">
        <td className="px-4 py-3 text-sm text-cyan-100/80">{idx + 1}</td>
        <td className="px-4 py-3 text-cyan-50">{row.helpdesk_nm}</td>
        <td className="px-4 py-3 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/40 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-400/15 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              onClick={() => router.push(`/setting/helpdesk/lihat/${row.helpdesk_id}`)}
            >
              <Eye className="h-3.5 w-3.5" />
              Lihat
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-500/15 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              onClick={() => router.push(`/setting/helpdesk/edit/${row.helpdesk_id}`)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 px-2 py-1 text-xs text-rose-100 hover:bg-rose-500/15 focus:outline-none focus:ring-2 focus:ring-rose-400/40"
              onClick={() => openDelete(row)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus
            </button>
          </div>
        </td>
      </tr>
    ));
  }, [error, loading, rows, router]);

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
                <h1 className="text-base font-semibold tracking-wide text-cyan-200">
                  Setting Helpdesk
                </h1>
                <p className="text-xs text-cyan-200/70">
                  Mengelola opsi helpdesk yang dipakai pada aplikasi dan Android.
                </p>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="hidden sm:inline-flex items-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
                <LifeBuoy className="mr-1 h-3.5 w-3.5" />
                Total {total} opsi
              </div>

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
                onClick={() => router.push("/setting/helpdesk/add")}
                className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-3 py-1.5 text-[11px] font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Helpdesk
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-6 px-5 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-900/40 bg-[#05070d]/50 px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-cyan-200/80">
              <LifeBuoy className="h-4 w-4" />
              <span>{total} helpdesk</span>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            {error ? <div className="text-xs text-rose-300/80">{error}</div> : null}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-cyan-900/40 bg-[#04060b]/60">
            <table className="min-w-full divide-y divide-cyan-900/50 text-sm">
              <thead className="bg-cyan-950/40 text-xs uppercase tracking-wide text-cyan-200/60">
                <tr>
                  <th className="px-4 py-3 text-left">No</th>
                  <th className="px-4 py-3 text-left">Helpdesk</th>
                  <th className="px-4 py-3 text-center">Operasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-900/30">{bodyState}</tbody>
            </table>
          </div>
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

      {confirm.open && confirm.target && (
        <NeonModal
          open={confirm.open}
          kind="confirm"
          title="Hapus Helpdesk?"
          message={`Anda akan menghapus opsi helpdesk "${confirm.target.helpdesk_nm}".`}
          confirmText="Ya, hapus"
          cancelText="Batal"
          loading={confirm.loading}
          onConfirm={() => void handleDelete()}
          onClose={() => {
            if (confirm.loading) return;
            setConfirm({ open: false, target: null, loading: false });
          }}
        />
      )}
    </div>
  );
}
