"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Undo2,
} from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import { DataShell } from "@/components/ui/LoadingOverlay";
import NeonModal from "@/components/ui/NeonModal";

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => (
    <div className="px-3 py-4 text-sm text-cyan-100/80">
      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
      Menyiapkan tabel...
    </div>
  ),
});

type BarangRow = {
  BARANG_ID: number;
  JENIS_BARANG: string;
  SATUAN: string;
  HARGA: number;
  KETERANGAN?: string;
  TANGGAL?: string;
};

type ApiResp<T> = { success?: boolean; message?: string; data?: T };

const fmtIdr = (v?: number) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(Number(v || 0));

export default function BarangMasterPage() {
  const [rows, setRows] = useState<BarangRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [jenis, setJenis] = useState("");
  const [satuan, setSatuan] = useState("");
  const [harga, setHarga] = useState("0");
  const [keterangan, setKeterangan] = useState("");
  const [modal, setModal] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: "",
    message: "",
  });

  const tableContainerRef = useRef<HTMLElement | null>(null);

  const columns = useMemo(
    () => [
      { data: null, title: "No", render: (_: any, __: any, ___: any, meta: any) => meta.row + 1 },
      { data: "JENIS_BARANG", title: "Jenis Barang" },
      { data: "SATUAN", title: "Satuan", width: "120px" },
      {
        data: "HARGA",
        title: "Harga Satuan",
        render: (d: any) => `Rp ${fmtIdr(Number(d || 0))}`,
        className: "dt-body-right",
      },
      { data: "KETERANGAN", title: "Keterangan" },
      {
        data: null,
        title: "Action",
        orderable: false,
        render: (_: any, __: any, row: BarangRow) =>
          `<div class="flex gap-2">
            <button class="btn-edit inline-flex items-center gap-1 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-50 hover:bg-cyan-500/20 transition" data-edit-id="${row.BARANG_ID}">
              Edit
            </button>
            <button class="btn-delete inline-flex items-center gap-1 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-1 text-xs text-rose-50 hover:bg-rose-500/20 transition" data-del-id="${row.BARANG_ID}">
              Hapus
            </button>
          </div>`,
      },
    ],
    []
  );

  const attachTableEvents = (api: any | null) => {
    if (!api) {
      if (tableContainerRef.current) {
        tableContainerRef.current.removeEventListener("click", onTableClick as any);
        tableContainerRef.current = null;
      }
      return;
    }
    const container = api.table().container() as HTMLElement;
    if (tableContainerRef.current && tableContainerRef.current !== container) {
      tableContainerRef.current.removeEventListener("click", onTableClick as any);
    }
    tableContainerRef.current = container;
    container.addEventListener("click", onTableClick as any);
  };

  const onTableClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const btnEdit = target.closest("[data-edit-id]") as HTMLElement | null;
    const btnDel = target.closest("[data-del-id]") as HTMLElement | null;
    if (btnEdit) {
      const id = Number(btnEdit.dataset.editId || "0");
      if (id) handleEdit(id);
    } else if (btnDel) {
      const id = Number(btnDel.dataset.delId || "0");
      if (id) void handleDelete(id);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setJenis("");
    setSatuan("");
    setHarga("0");
    setKeterangan("");
  };

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/barang/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResp<BarangRow[]>;
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat data");
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (id: number) => {
    try {
      const res = await fetch("/api/barang/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detail", id }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResp<BarangRow>;
      if (!res.ok || json.success === false) throw new Error(json.message || "Data tidak ditemukan");
      const row = (json.data || {}) as any;
      setEditingId(id);
      setJenis(row.JENIS_BARANG || "");
      setSatuan(row.SATUAN || "");
      setHarga(String(row.HARGA ?? "0"));
      setKeterangan(row.KETERANGAN || "");
      setMessage(null);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat detail");
    }
  };

  const handleDelete = async (id: number) => {
    const okConfirm = window.confirm("Hapus data barang ini beserta transaksi masuk/keluar?");
    if (!okConfirm) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/barang/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResp<any>;
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menghapus");
      setModal({ open: true, title: "Berhasil", message: json.message || "Data dihapus" });
      if (editingId === id) resetForm();
      await fetchRows();
    } catch (e: any) {
      setModal({ open: true, title: "Gagal", message: e?.message || "Gagal menghapus" });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const priceNum = Number(harga.toString().replace(/[^\d.-]/g, "")) || 0;
    if (!jenis.trim()) return setError("Jenis barang wajib diisi.");
    if (!satuan.trim()) return setError("Satuan wajib diisi.");
    if (!priceNum) return setError("Harga wajib diisi.");
    if (!keterangan.trim()) return setError("Keterangan wajib diisi.");

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload: Record<string, any> = {
        action: editingId ? "update" : "create",
        id: editingId ?? undefined,
        jenis_barang: jenis,
        satuan,
        harga: priceNum,
        keterangan,
      };
      const res = await fetch("/api/barang/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResp<any>;
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal menyimpan");
      setMessage(json.message || "Berhasil disimpan");
      resetForm();
      await fetchRows();
    } catch (e: any) {
      setError(e?.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void fetchRows();
    return () => {
      if (tableContainerRef.current) {
        tableContainerRef.current.removeEventListener("click", onTableClick as any);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-14 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[-25%] h-[820px] w-[820px] rounded-full bg-cyan-500/12 blur-[200px]" />
        <div className="absolute right-[8%] bottom-[-20%] h-[780px] w-[780px] rounded-full bg-fuchsia-600/10 blur-[180px]" />
      </div>

      {modal.open ? (
        <NeonModal
          open={modal.open}
          kind={modal.title === "Berhasil" ? "success" : "error"}
          title={modal.title}
          message={modal.message}
          onClose={() => setModal((p) => ({ ...p, open: false }))}
        />
      ) : null}

      <SettingPageHeader
        lead="Barang"
        title="Master Barang"
        description="Kelola daftar barang (jenis, satuan, harga) sebagai sumber dropdown transaksi masuk/keluar."
      />

      <section className="rounded-3xl border border-cyan-900/60 bg-[#05070d]/70 p-5 shadow-[0_0_32px_#00ffff22] backdrop-blur-xl">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Jenis Barang</label>
            <input
              value={jenis}
              onChange={(e) => setJenis(e.target.value)}
              className="w-full rounded-xl border border-cyan-800/60 bg-[#0c1224] px-3 py-2 text-sm text-cyan-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
              placeholder="cth: Toner, Kertas"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Satuan</label>
            <input
              value={satuan}
              onChange={(e) => setSatuan(e.target.value)}
              className="w-full rounded-xl border border-cyan-800/60 bg-[#0c1224] px-3 py-2 text-sm text-cyan-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
              placeholder="cth: box, pcs"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Harga Satuan (Rp)</label>
            <input
              value={harga}
              onChange={(e) => setHarga(e.target.value)}
              className="w-full rounded-xl border border-cyan-800/60 bg-[#0c1224] px-3 py-2 text-sm text-cyan-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
              inputMode="decimal"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Keterangan</label>
            <textarea
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              className="w-full rounded-xl border border-cyan-800/60 bg-[#0c1224] px-3 py-2 text-sm text-cyan-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
              rows={1}
              placeholder="Catatan singkat"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? "Update" : "Save"}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-white/5 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-white/10"
          >
            <Undo2 className="h-4 w-4" />
            Clear
          </button>
          <button
            type="button"
            onClick={() => void fetchRows()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-60"
          >
            <RefreshCcw className="h-4 w-4" />
            Reload
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {message ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-50">
              <CheckCircle2 className="h-4 w-4" />
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-50">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : null}
          {editingId ? (
            <div className="text-xs text-cyan-200/70">
              Sedang mengedit ID: <span className="font-semibold text-cyan-100">{editingId}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-cyan-900/60 bg-[#05070f]/70 shadow-[0_0_32px_#00ffff22] backdrop-blur-xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-900/50 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">Master Barang</p>
            <h2 className="text-lg font-semibold text-cyan-100">Daftar Barang</h2>
          </div>
          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
            Total: {rows.length}
          </span>
        </header>
        <div className="p-4">
          <DataShell loading={loading} hasData={rows.length > 0}>
            <JQDataTable
              id="dt-master-barang"
              data={rows as any[]}
              columns={columns as any[]}
              minWidth={900}
              pageLength={25}
              onApiReady={attachTableEvents}
              options={{
                columnDefs: [{ className: "dt-left", targets: "_all" }],
              }}
            />
          </DataShell>
        </div>
      </section>
    </div>
  );
}
