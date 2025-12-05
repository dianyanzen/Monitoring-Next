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

type BarangOption = { BARANG_ID: number; JENIS_BARANG: string; SATUAN?: string; HARGA?: number };

type Row = {
  SEQ_ID: number;
  KODE_BARANG: number;
  JENIS_BARANG: string;
  JUMLAH: number;
  SATUAN: string;
  HARGA: number;
  TANGGAL: string;
  RECEIVED: string;
  KETERANGAN?: string;
};

type ApiResp<T> = { success?: boolean; message?: string; data?: T };

const fmtIdr = (v?: number) =>
  new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(Number(v || 0));

export default function BarangMasukPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [options, setOptions] = useState<BarangOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [barangId, setBarangId] = useState<string>("0");
  const [jumlah, setJumlah] = useState<string>("0");
  const [received, setReceived] = useState("");
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
      {
        data: null,
        title: "Jumlah",
        render: (_: any, __: any, row: Row) => `${row.JUMLAH} ${row.SATUAN || ""}`,
      },
      {
        data: "HARGA",
        title: "Nilai",
        render: (d: any) => `Rp ${fmtIdr(Number(d || 0))}`,
        className: "dt-body-right",
      },
      { data: "TANGGAL", title: "Tanggal", width: "110px" },
      { data: "RECEIVED", title: "Penerima" },
      { data: "KETERANGAN", title: "Keterangan" },
      {
        data: null,
        title: "Action",
        orderable: false,
        render: (_: any, __: any, row: Row) =>
          `<div class="flex gap-2">
            <button class="btn-edit inline-flex items-center gap-1 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-50 hover:bg-cyan-500/20 transition" data-edit-id="${row.SEQ_ID}">
              Edit
            </button>
            <button class="btn-delete inline-flex items-center gap-1 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-1 text-xs text-rose-50 hover:bg-rose-500/20 transition" data-del-id="${row.SEQ_ID}">
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
    setBarangId("0");
    setJumlah("0");
    setReceived("");
    setKeterangan("");
  };

  const fetchOptions = async () => {
    try {
      const res = await fetch("/api/barang/options");
      const json = (await res.json().catch(() => ({}))) as ApiResp<BarangOption[]>;
      if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat master barang");
      setOptions(Array.isArray(json.data) ? json.data : []);
    } catch (e: any) {
      setOptions([]);
      setError(e?.message || "Gagal memuat opsi barang");
    }
  };

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/barang/masuk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResp<Row[]>;
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
      const res = await fetch("/api/barang/masuk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detail", id }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResp<Row>;
      if (!res.ok || json.success === false) throw new Error(json.message || "Data tidak ditemukan");
      const row = (json.data || {}) as any;
      setEditingId(id);
      setBarangId(String(row.KODE_BARANG ?? "0"));
      setJumlah(String(row.JUMLAH ?? "0"));
      setReceived(row.RECEIVED || "");
      setKeterangan(row.KETERANGAN || "");
      setMessage(null);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat detail");
    }
  };

  const handleDelete = async (id: number) => {
    const okConfirm = window.confirm("Hapus transaksi barang masuk ini?");
    if (!okConfirm) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/barang/masuk", {
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
    const kode = Number(barangId);
    const jml = Number(jumlah);
    if (!kode) return setError("Pilih barang terlebih dahulu.");
    if (!jml) return setError("Jumlah wajib diisi.");
    if (!received.trim()) return setError("Penerima wajib diisi.");
    if (!keterangan.trim()) return setError("Keterangan wajib diisi.");

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload: Record<string, any> = {
        action: editingId ? "update" : "create",
        id: editingId ?? undefined,
        kd_brg: kode,
        jumlah: jml,
        received,
        keterangan,
      };
      const res = await fetch("/api/barang/masuk", {
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
    void fetchOptions();
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
        title="Barang Masuk"
        description="Catat barang masuk dan penerimanya. Data tersimpan ke SIAK_BARANG_MASUK."
      />

      <section className="rounded-3xl border border-cyan-900/60 bg-[#05070d]/70 p-5 shadow-[0_0_32px_#00ffff22] backdrop-blur-xl">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Jenis Barang</label>
            <select
              value={barangId}
              onChange={(e) => setBarangId(e.target.value)}
              className="w-full rounded-xl border border-cyan-800/60 bg-[#0c1224] px-3 py-2 text-sm text-cyan-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
            >
              <option value="0">-- Pilih Barang --</option>
              {options.map((o) => (
                <option key={o.BARANG_ID} value={o.BARANG_ID}>
                  {o.BARANG_ID}. {o.JENIS_BARANG}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Jumlah</label>
            <input
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
              className="w-full rounded-xl border border-cyan-800/60 bg-[#0c1224] px-3 py-2 text-sm text-cyan-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Penerima</label>
            <input
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              className="w-full rounded-xl border border-cyan-800/60 bg-[#0c1224] px-3 py-2 text-sm text-cyan-50 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/30"
              placeholder="Nama penerima"
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
            className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-2 text-sm font-semibold text-black shadow-lg transition hover:from-emerald-300 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
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
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">Barang Masuk</p>
            <h2 className="text-lg font-semibold text-cyan-100">Riwayat Barang Masuk</h2>
          </div>
          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
            Total: {rows.length}
          </span>
        </header>
        <div className="p-4">
          <DataShell loading={loading} hasData={rows.length > 0}>
            <JQDataTable
              id="dt-barang-masuk"
              data={rows as any[]}
              columns={columns as any[]}
              minWidth={1000}
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
