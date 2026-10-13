"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Plus,
  RefreshCw,
  Download,
  Search,
  ArrowUpDown,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  MENU_PATHS,
  allowed,
  type InventoryMode,
} from "@/lib/barang/navigation";
import type { DataRow } from "@/lib/barang/repository";
import { csvCell } from "@/lib/barang/validation";
import InventoryDialog from "./InventoryDialog";
type Column = {
  key: string;
  label: string;
  numeric?: boolean;
  money?: boolean;
  sort?: string;
};
const identity: Column[] = [
  { key: "BARANG_ID", label: "Kode", sort: "BARANG_ID" },
  { key: "JENIS_BARANG", label: "Jenis barang", sort: "JENIS_BARANG" },
];
const transaction: Column[] = [
  { key: "SEQ_ID", label: "No. transaksi", sort: "SEQ_ID" },
  { key: "JENIS_BARANG", label: "Barang", sort: "JENIS_BARANG" },
  { key: "JUMLAH", label: "Jumlah", numeric: true, sort: "JUMLAH" },
  { key: "SATUAN", label: "Satuan" },
  {
    key: "HARGA",
    label: "Nilai saat ini",
    numeric: true,
    money: true,
    sort: "HARGA",
  },
  { key: "TANGGAL", label: "Tanggal", sort: "SORT_DATE" },
  { key: "RECEIVED", label: "Penerima" },
];
const config: Record<
  InventoryMode,
  {
    title: string;
    description: string;
    endpoint: string;
    columns: Column[];
    mutable?: boolean;
  }
> = {
  master: {
    title: "Master Barang",
    description: "Kelola jenis barang, satuan, harga dan catatan inventaris.",
    endpoint: "master",
    mutable: true,
    columns: [
      ...identity,
      { key: "SATUAN", label: "Satuan" },
      {
        key: "HARGA",
        label: "Harga satuan",
        numeric: true,
        money: true,
        sort: "HARGA",
      },
    ],
  },
  inputaset: {
    title: "Input Aset",
    description:
      "Daftarkan jenis aset pada master barang. Pencatatan ini belum mencakup unit atau nomor serial individual.",
    endpoint: "master",
    mutable: true,
    columns: [
      ...identity,
      { key: "SATUAN", label: "Satuan" },
      {
        key: "HARGA",
        label: "Harga satuan",
        numeric: true,
        money: true,
        sort: "HARGA",
      },
    ],
  },
  masuk: {
    title: "Barang Masuk",
    description: "Catat penerimaan dan telusuri riwayat penambahan stok.",
    endpoint: "masuk",
    mutable: true,
    columns: transaction,
  },
  keluar: {
    title: "Barang Keluar",
    description: "Catat pengeluaran sesuai saldo barang yang tersedia.",
    endpoint: "keluar",
    mutable: true,
    columns: transaction,
  },
  status: {
    title: "Status Barang",
    description: "Pantau saldo per jenis barang dan nilai persediaan saat ini.",
    endpoint: "status",
    columns: [
      ...identity,
      { key: "MASUK_QTY", label: "Masuk", numeric: true },
      { key: "KELUAR_QTY", label: "Keluar", numeric: true },
      { key: "SALDO_QTY", label: "Saldo", numeric: true, sort: "SALDO_QTY" },
      { key: "SATUAN", label: "Satuan" },
      {
        key: "HARGA_ASET",
        label: "Nilai persediaan",
        numeric: true,
        money: true,
      },
    ],
  },
  aset: {
    title: "Master Referensi Aset",
    description:
      "Kelola referensi jenis, keadaan, satuan kerja, kategori dan lokasi aset.",
    endpoint: "aset",
    mutable: true,
    columns: [
      { key: "NO", label: "Kode", sort: "NO" },
      { key: "DESCRIP", label: "Deskripsi", sort: "DESCRIP" },
    ],
  },
  cekaset: {
    title: "Status Aset Wilayah",
    description:
      "Saldo penerimaan dan pengeluaran aset berdasarkan transaksi wilayah.",
    endpoint: "cekaset",
    columns: [
      { key: "NAMA_WIL", label: "Wilayah", sort: "NAMA_WIL" },
      { key: "NAMA_BARANG", label: "Jenis aset", sort: "NAMA_BARANG" },
      { key: "MASUK_QTY", label: "Masuk", numeric: true },
      { key: "KELUAR_QTY", label: "Keluar", numeric: true },
      { key: "SALDO_QTY", label: "Saldo", numeric: true, sort: "SALDO_QTY" },
    ],
  },
  laporan: {
    title: "Laporan Barang",
    description:
      "Telusuri penerimaan dan pengeluaran pada rentang tanggal pilihan.",
    endpoint: "laporan",
    columns: [{ key: "KET", label: "Transaksi" }, ...transaction.slice(1)],
  },
  laporanaset: {
    title: "Laporan Aset Wilayah",
    description: "Telusuri transaksi aset IN/OUT per wilayah dan periode.",
    endpoint: "laporanaset",
    columns: [
      { key: "NAMA_WIL", label: "Wilayah", sort: "NAMA_WIL" },
      { key: "NAMA_BARANG", label: "Aset", sort: "NAMA_BARANG" },
      { key: "KATEGORI", label: "Transaksi" },
      { key: "JUMLAH", label: "Jumlah", numeric: true, sort: "JUMLAH" },
      { key: "TANGGAL", label: "Tanggal", sort: "SORT_DATE" },
      { key: "PENERIMA", label: "Penerima" },
    ],
  },
};
const categories = [
  "Jenis aset",
  "Keadaan aset",
  "Satuan kerja",
  "Kategori aset",
  "Lokasi aset",
  "Jenis aset wilayah",
];
const fmt = (v: unknown) =>
  v === null || v === undefined
    ? "—"
    : Number(v).toLocaleString("id-ID", { maximumFractionDigits: 2 });
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
async function api<T>(
  endpoint: string,
  body?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const read = !body || body.action === "list";
  const query =
    read && body
      ? "?" +
        new URLSearchParams(
          Object.entries(body)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)]),
        )
      : "";
  const res = await fetch(`/api/barang/${endpoint}${query}`, {
    method: read ? "GET" : "POST",
    headers: read ? undefined : { "Content-Type": "application/json" },
    body: read ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  const json = await res.json();
  if (!res.ok || !json.success)
    throw new Error(json.message || "Permintaan gagal.");
  return json.data;
}
export default function InventoryWorkspace({
  mode,
  permissions,
}: {
  mode: InventoryMode;
  permissions: string[];
}) {
  const c = config[mode],
    isReport = mode === "laporan" || mode === "laporanaset",
    isMaster = mode === "master" || mode === "inputaset";
  const [rows, setRows] = useState<DataRow[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [size, setSize] = useState(25),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [sect, setSect] = useState("1"),
    [start, setStart] = useState(() => today().slice(0, 7) + "-01"),
    [end, setEnd] = useState(today),
    [item, setItem] = useState(""),
    [category, setCategory] = useState(""),
    [sort, setSort] = useState(
      mode === "aset"
        ? "NO"
        : mode === "cekaset"
          ? "NAMA_WIL"
          : isReport || mode === "masuk" || mode === "keluar"
            ? "SORT_DATE"
            : "BARANG_ID",
    ),
    [direction, setDirection] = useState("desc"),
    [revision, setRevision] = useState(0),
    [options, setOptions] = useState<DataRow[]>([]),
    [summary, setSummary] = useState<{
      total: number;
      available: number;
      empty: number;
      negative: number;
      value: number;
    } | null>(null);
  const [dialog, setDialog] = useState<"form" | "detail" | "delete" | null>(
      null,
    ),
    [selected, setSelected] = useState<DataRow | null>(null),
    [form, setForm] = useState<Record<string, string>>({}),
    [formError, setFormError] = useState(""),
    [saving, setSaving] = useState(false);
  const busyRef = useRef(false),
    initialForm = useRef("");
  const body = useMemo(
    () => ({
      action: "list",
      page,
      pageSize: size,
      search,
      status,
      sect: Number(sect),
      start,
      end,
      barang: item,
      jenis: item,
      kategori: category,
      sort,
      direction,
    }),
    [
      page,
      size,
      search,
      status,
      sect,
      start,
      end,
      item,
      category,
      sort,
      direction,
    ],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<{ rows: DataRow[]; total: number }>(c.endpoint, body, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setRows(data.rows);
        setTotal(data.total);
        const max = Math.max(1, Math.ceil(data.total / size));
        if (page > max) setPage(max);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setRows([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [c.endpoint, body, revision, page, size]);
  useEffect(() => {
    const controller = new AbortController();
    if (["masuk", "keluar", "laporan"].includes(mode))
      api<DataRow[]>("options", undefined, controller.signal)
        .then(setOptions)
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    if (mode === "laporanaset")
      api<DataRow[]>("aset-options", undefined, controller.signal)
        .then(setOptions)
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    if (!["aset", "cekaset", "laporanaset"].includes(mode))
      api<NonNullable<typeof summary>>("summary", undefined, controller.signal)
        .then(setSummary)
        .catch(() => {});
    return () => controller.abort();
  }, [mode, revision]);
  const dirty =
    dialog === "form" && JSON.stringify(form) !== initialForm.current;
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  function close() {
    if (busyRef.current) return;
    if (dirty && !window.confirm("Buang perubahan yang belum disimpan?"))
      return;
    setDialog(null);
    setFormError("");
  }
  function openForm(row: DataRow | null) {
    setSelected(row);
    const f = isMaster
      ? {
          jenis_barang: String(row?.JENIS_BARANG ?? ""),
          satuan: String(row?.SATUAN ?? ""),
          harga: String(row?.HARGA ?? 0),
          keterangan: String(row?.KETERANGAN ?? ""),
        }
      : mode === "aset"
        ? { value_data: String(row?.DESCRIP ?? "") }
        : {
            kd_brg: String(row?.KODE_BARANG ?? ""),
            jumlah: String(row?.JUMLAH ?? ""),
            received: String(row?.RECEIVED ?? ""),
            keterangan: String(row?.KETERANGAN ?? ""),
          };
    setForm(f);
    initialForm.current = JSON.stringify(f);
    setFormError("");
    setDialog("form");
  }
  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    setFormError("");
    try {
      const action =
        dialog === "delete" ? "delete" : selected ? "update" : "create";
      await api(c.endpoint, {
        ...form,
        action,
        id: selected?.BARANG_ID ?? selected?.SEQ_ID ?? selected?.NO,
        no: selected?.NO,
        sect: Number(sect),
      });
      setDialog(null);
      setMessage(
        action === "delete"
          ? "Data berhasil dihapus."
          : "Perubahan berhasil disimpan.",
      );
      setRevision((r) => r + 1);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  }
  function reset() {
    setQuery("");
    setSearch("");
    setStatus("");
    setItem("");
    setCategory("");
    setPage(1);
  }
  function exportRows() {
    const cols = c.columns;
    const csv =
      "\uFEFF" +
      [
        cols.map((col) => csvCell(col.label)).join(","),
        ...rows.map((r) => cols.map((col) => csvCell(r[col.key])).join(",")),
      ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mode}-halaman-${page}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const setFilter = (setter: (s: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };
  const canEdit = mode !== "inputaset" || allowed(permissions, "master");
  return (
    <div className="monalisa-ops inventory-workspace">
      <nav className="ops-nav" aria-label="Navigasi Barang">
        {(Object.keys(config) as InventoryMode[])
          .filter((m) => allowed(permissions, m))
          .map((m) => (
            <Link
              key={m}
              href={"/" + MENU_PATHS[m][0]}
              aria-current={m === mode ? "page" : undefined}
            >
              {config[m].title.replace(" Wilayah", "")}
            </Link>
          ))}
      </nav>
      <div className="ops-header">
        <div>
          <p className="ops-eyebrow">
            <Package size={15} /> Manajemen Barang
          </p>
          <h1>{c.title}</h1>
          <p>{c.description}</p>
        </div>
        <div className="ops-actions">
          {c.mutable && (
            <button className="primary" onClick={() => openForm(null)}>
              <Plus size={17} />{" "}
              {mode === "aset"
                ? "Tambah referensi"
                : isMaster
                  ? "Tambah barang"
                  : "Catat transaksi"}
            </button>
          )}
          <button onClick={() => setRevision((r) => r + 1)} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={exportRows}
            disabled={loading || !rows.length}
            title="Ekspor baris pada halaman aktif"
          >
            <Download size={16} /> Ekspor halaman CSV
          </button>
        </div>
      </div>
      {summary && (
        <div className="ops-summary">
          <div>
            <Package size={18} />
            <span>Jenis barang</span>
            <strong>{fmt(summary.total)}</strong>
          </div>
          <div>
            <ArrowDownToLine size={18} />
            <span>Jenis dengan stok</span>
            <strong>{fmt(summary.available)}</strong>
          </div>
          <div>
            <ArrowUpFromLine size={18} />
            <span>Jenis stok kosong</span>
            <strong>{fmt(summary.empty)}</strong>
          </div>
          <div>
            <ClipboardList size={18} />
            <span>Saldo bermasalah</span>
            <strong>{fmt(summary.negative)}</strong>
          </div>
        </div>
      )}
      {summary && (
        <p className="ops-muted">
          Nilai persediaan saat ini: Rp {fmt(summary.value)} · Jumlah jenis
          berbeda dari jumlah unit; saldo ditampilkan menurut satuan
          masing-masing.
        </p>
      )}
      {message && (
        <div className="ops-notice" role="status">
          {message}
          <button
            onClick={() => setMessage("")}
            aria-label="Tutup pemberitahuan"
          >
            ×
          </button>
        </div>
      )}
      <section className="ops-panel">
        <div className="ops-toolbar">
          <label className="ops-search">
            <span>
              <Search size={16} /> Cari{" "}
              {mode === "aset" ? "deskripsi" : "barang"}
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ketik nama atau deskripsi…"
            />
          </label>
          {mode === "aset" && (
            <label>
              Kategori referensi
              <select
                value={sect}
                onChange={(e) => setFilter(setSect)(e.target.value)}
              >
                {categories.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === "status" && (
            <label>
              Status stok
              <select
                value={status}
                onChange={(e) => setFilter(setStatus)(e.target.value)}
              >
                <option value="">Semua status</option>
                <option value="available">Tersedia</option>
                <option value="empty">Kosong</option>
                <option value="negative">Saldo negatif</option>
              </select>
            </label>
          )}
          {isReport && (
            <>
              <label>
                Tanggal awal
                <input
                  type="date"
                  value={start}
                  max={end}
                  onChange={(e) => setFilter(setStart)(e.target.value)}
                />
              </label>
              <label>
                Tanggal akhir
                <input
                  type="date"
                  value={end}
                  min={start}
                  onChange={(e) => setFilter(setEnd)(e.target.value)}
                />
              </label>
              <label>
                {mode === "laporanaset" ? "Jenis aset" : "Jenis barang"}
                <select
                  value={item}
                  onChange={(e) => setFilter(setItem)(e.target.value)}
                >
                  <option value="">Semua jenis</option>
                  {options.map((o) => (
                    <option
                      key={String(o.BARANG_ID ?? o.ID)}
                      value={String(o.BARANG_ID ?? o.ID)}
                    >
                      {o.JENIS_BARANG ?? o.NAMA}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {mode === "laporanaset" && (
            <label>
              Transaksi
              <select
                value={category}
                onChange={(e) => setFilter(setCategory)(e.target.value)}
              >
                <option value="">Semua</option>
                <option value="IN">Penerimaan (IN)</option>
                <option value="OUT">Pengeluaran (OUT)</option>
              </select>
            </label>
          )}
          {(query || status || item || category) && (
            <button onClick={reset}>Hapus filter</button>
          )}
        </div>
        <div className="ops-table-heading">
          <h2>
            {isReport
              ? "Riwayat transaksi"
              : mode === "aset"
                ? categories[Number(sect) - 1]
                : "Daftar " +
                  (isMaster ? "barang" : mode === "status" ? "saldo" : "data")}
          </h2>
          <span className="ops-muted">
            {fmt(total)} hasil{search ? ` · “${search}”` : ""}
          </span>
        </div>
        {error ? (
          <div className="ops-empty danger" role="alert">
            {error}
            <button onClick={() => setRevision((r) => r + 1)}>Coba lagi</button>
          </div>
        ) : loading ? (
          <div className="ops-empty" role="status">
            Memuat data…
          </div>
        ) : !rows.length ? (
          <div className="ops-empty">
            <Package size={30} />
            <h3>
              {search || status || item
                ? "Tidak ada hasil yang cocok"
                : "Belum ada data"}
            </h3>
            <p>
              {search || status || item
                ? "Ubah pencarian atau hapus filter."
                : isReport
                  ? "Pilih periode lain untuk melihat transaksi."
                  : "Data akan muncul setelah pencatatan pertama."}
            </p>
            {c.mutable && (
              <button onClick={() => openForm(null)}>Tambah data</button>
            )}
          </div>
        ) : (
          <div
            className="ops-table-scroll"
            tabIndex={0}
            aria-label="Tabel data, geser untuk melihat kolom"
          >
            <table>
              <caption className="sr-only">{c.title}</caption>
              <thead>
                <tr>
                  {c.columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={col.numeric ? "numeric" : ""}
                      aria-sort={
                        sort === col.sort
                          ? direction === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      {col.sort ? (
                        <button
                          onClick={() => {
                            setSort(col.sort!);
                            setDirection(
                              sort === col.sort && direction === "asc"
                                ? "desc"
                                : "asc",
                            );
                            setPage(1);
                          }}
                        >
                          {col.label}
                          <ArrowUpDown size={13} />
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  ))}
                  {(mode === "status" || mode === "cekaset") && (
                    <th scope="col">Status</th>
                  )}
                  <th scope="col">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={`${row.BARANG_ID ?? row.SEQ_ID ?? row.NO ?? row.NO_KEC}-${row.JENIS_BARANG ?? ""}-${row.KET ?? ""}-${index}`}
                  >
                    {c.columns.map((col) => (
                      <td
                        key={col.key}
                        className={col.numeric ? "numeric" : ""}
                      >
                        {col.numeric
                          ? (col.money ? "Rp " : "") + fmt(row[col.key])
                          : String(row[col.key] ?? "—")}
                      </td>
                    ))}
                    {(mode === "status" || mode === "cekaset") && (
                      <td>
                        <span
                          className={`ops-badge ${Number(row.SALDO_QTY) < 0 ? "danger" : Number(row.SALDO_QTY) === 0 ? "warning" : "success"}`}
                        >
                          {Number(row.SALDO_QTY) < 0
                            ? "Perlu koreksi"
                            : Number(row.SALDO_QTY) === 0
                              ? "Kosong"
                              : "Tersedia"}
                        </span>
                      </td>
                    )}
                    <td>
                      <div className="ops-row-actions">
                        <button
                          aria-label={`Detail ${row.JENIS_BARANG ?? row.DESCRIP ?? row.NAMA_BARANG}`}
                          onClick={() => {
                            setSelected(row);
                            setDialog("detail");
                          }}
                        >
                          <Eye size={16} />
                          <span>Detail</span>
                        </button>
                        {c.mutable && canEdit && (
                          <>
                            <button
                              aria-label={`Edit ${row.JENIS_BARANG ?? row.DESCRIP}`}
                              onClick={() => openForm(row)}
                            >
                              <Pencil size={16} />
                              <span>Edit</span>
                            </button>
                            {
                              <button
                                className="danger"
                                aria-label={`Hapus ${row.JENIS_BARANG ?? row.DESCRIP}`}
                                onClick={() => {
                                  setSelected(row);
                                  setFormError("");
                                  setDialog("delete");
                                }}
                              >
                                <Trash2 size={16} />
                                <span>Hapus</span>
                              </button>
                            }
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="ops-pagination">
          <label>
            Baris per halaman
            <select
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <span aria-live="polite">
            {total
              ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} dari ${fmt(total)}`
              : "0 hasil"}
          </span>
          <div className="ops-actions">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Sebelumnya
            </button>
            <span>
              {page} / {Math.max(1, Math.ceil(total / size))}
            </span>
            <button
              disabled={page * size >= total || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Berikutnya
            </button>
          </div>
        </div>
      </section>
      {(mode === "masuk" || mode === "keluar" || isReport) && (
        <p className="ops-muted">
          Nilai transaksi dihitung menggunakan harga master saat ini. Tanggal
          pencatatan asli tetap dipertahankan ketika transaksi diedit.
        </p>
      )}
      {dialog && (
        <InventoryDialog
          title={
            dialog === "detail"
              ? "Detail data"
              : dialog === "delete"
                ? "Hapus data"
                : selected
                  ? "Edit data"
                  : mode === "aset"
                    ? "Tambah referensi"
                    : isMaster
                      ? "Tambah barang"
                      : "Catat barang " + mode
          }
          onClose={close}
          busy={saving}
        >
          {dialog === "detail" ? (
            <>
              <dl className="ops-detail">
                {Object.entries(selected ?? {})
                  .filter(([key]) => key !== "SORT_DATE")
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>
                        {c.columns.find((col) => col.key === key)?.label ??
                          key.replaceAll("_", " ").toLowerCase()}
                      </dt>
                      <dd>{value === null ? "—" : String(value)}</dd>
                    </div>
                  ))}
              </dl>
              <button onClick={close}>Tutup</button>
            </>
          ) : dialog === "delete" ? (
            <>
              <p>
                Hapus {String(selected?.JENIS_BARANG ?? "transaksi")}?{" "}
                {isMaster
                  ? "Barang dengan riwayat transaksi tidak dapat dihapus."
                  : "Saldo akan dihitung ulang; perubahan yang membuat saldo negatif ditolak."}
              </p>
              {formError && (
                <div className="ops-notice danger" role="alert">
                  {formError}
                </div>
              )}
              <div className="ops-actions">
                <button onClick={close} disabled={saving}>
                  Batal
                </button>
                <button
                  className="danger"
                  onClick={() => submit()}
                  disabled={saving}
                >
                  {saving ? "Memproses…" : "Hapus data"}
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={submit}>
              <div className="ops-form-grid">
                {isMaster ? (
                  <>
                    <label>
                      Jenis barang <span>*</span>
                      <input
                        required
                        maxLength={50}
                        value={form.jenis_barang ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            jenis_barang: e.target.value,
                          }))
                        }
                        autoFocus
                      />
                    </label>
                    <label>
                      Satuan <span>*</span>
                      <input
                        required
                        maxLength={20}
                        value={form.satuan ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, satuan: e.target.value }))
                        }
                        placeholder="rim, unit, kotak…"
                      />
                    </label>
                    <label>
                      Harga satuan (Rp) <span>*</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={form.harga ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, harga: e.target.value }))
                        }
                      />
                    </label>
                  </>
                ) : mode === "aset" ? (
                  <label className="wide">
                    Deskripsi — {categories[Number(sect) - 1]} <span>*</span>
                    <input
                      required
                      maxLength={150}
                      value={form.value_data ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, value_data: e.target.value }))
                      }
                      autoFocus
                    />
                  </label>
                ) : (
                  <>
                    <label className="wide">
                      Barang <span>*</span>
                      <select
                        required
                        value={form.kd_brg ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, kd_brg: e.target.value }))
                        }
                        autoFocus
                      >
                        <option value="">Pilih barang</option>
                        {options.map((o) => (
                          <option
                            key={String(o.BARANG_ID)}
                            value={String(o.BARANG_ID)}
                          >
                            {o.JENIS_BARANG} ({o.SATUAN})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Jumlah <span>*</span>
                      <input
                        type="number"
                        min="0.000001"
                        step="any"
                        required
                        value={form.jumlah ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, jumlah: e.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Penerima <span>*</span>
                      <input
                        required
                        maxLength={50}
                        value={form.received ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, received: e.target.value }))
                        }
                      />
                    </label>
                  </>
                )}
                {mode !== "aset" && (
                  <label className="wide">
                    Keterangan <small>(opsional)</small>
                    <textarea
                      maxLength={isMaster ? 200 : 300}
                      rows={3}
                      value={form.keterangan ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, keterangan: e.target.value }))
                      }
                    />
                  </label>
                )}
              </div>
              <p className="ops-muted">
                * Wajib diisi
                {selected?.TANGGAL
                  ? ` · Tanggal pencatatan: ${selected.TANGGAL}`
                  : ""}
              </p>
              {formError && (
                <div className="ops-notice danger" role="alert">
                  {formError}
                </div>
              )}
              <div className="ops-actions ops-form-actions">
                <button type="button" onClick={close} disabled={saving}>
                  Batal
                </button>
                <button type="submit" className="primary" disabled={saving}>
                  {saving ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </form>
          )}
        </InventoryDialog>
      )}
    </div>
  );
}
