// src/components/espasi/EspasiLoketCallLayout.tsx
"use client";

import { ArrowLeft, Download, RefreshCw, RotateCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getLoketSocketEventByLokasi } from "@/lib/espasi/loket-socket";

type Endpoint = "antrian-loket" | "antrian-loket-terlewat" | "antrian-loket-sudah" | "antrian-loket-menunggu";
type FinalStatus = "PENDING" | "SUDAH" | "MENUNGGU" | "SELESAI";

type QueueRow = {
  NIK?: string;
  NAMA?: string;
  KODE_PELAYANAN?: string;
  URUTAN?: string;
  STATUS_PELAYANAN?: string;
  TGL_PELAYANAN?: string;
  HARI?: string;
  TELEPON?: string;
  LOKASI?: string;
};

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

type LegacyLoketData = {
  antrian?: QueueRow[];
  urutan_sekarang?: QueueRow | null;
};

type LoketApiResponse = ApiEnvelope<LegacyLoketData> | LegacyLoketData;

type Props = {
  title: string;
  endpoint: Endpoint;
  defaultLokasi: string;
  defaultLoket?: string;
  showLayanan?: boolean;
  showDownload?: boolean;
  emptyText: string;
  completeStatus: FinalStatus;
  cancelStatus: FinalStatus;
  cancelLabel: "Lewat" | "Batalkan";
};

const DEFAULT_SOCKET_URL = process.env.NEXT_PUBLIC_ESPASI_APP_HOST_URL ?? "http://10.32.73.7:1111";
const PAGE_SIZE_OPTIONS = [15, 25, 50, 100, 150];
const LOCATION_OPTIONS = ["DISDUK", "KIWARI", "BTC", "MIM", "DPRD"];
const LOKET_OPTIONS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function toText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function readLegacyAuth() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("authUserAntrian");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildSearchBucket(row: QueueRow) {
  return [
    getRowValue(row, "NIK"),
    getRowValue(row, "NAMA"),
    getRowValue(row, "KODE_PELAYANAN"),
    getRowValue(row, "URUTAN"),
    getRowValue(row, "STATUS_PELAYANAN"),
    getRowValue(row, "TGL_PELAYANAN"),
    getRowValue(row, "HARI"),
    getRowValue(row, "TELEPON"),
    getRowValue(row, "LOKASI"),
  ]
    .map((value) => toText(value).toUpperCase())
    .join(" ");
}

function getRowValue(row: QueueRow | null | undefined, key: keyof QueueRow) {
  if (!row) return "";
  return (row as any)[key] ?? (row as any)[String(key).toLowerCase()] ?? "";
}

function exportCsv(rows: QueueRow[], showLayanan: boolean, filename: string) {
  const columns = ["NIK", "NAMA", ...(showLayanan ? ["KODE_PELAYANAN"] : []), "URUTAN", "STATUS_PELAYANAN", "TGL_PELAYANAN", "HARI", "TELEPON"];
  const csv = [
    columns.join(","),
    ...rows.map((row) =>
      columns
        .map((key) => {
          const value = toText(getRowValue(row, key as keyof QueueRow)).replace(/"/g, '""');
          return `"${value}"`;
        })
        .join(",")
    ),
  ].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EspasiLoketCallLayout({
  title,
  endpoint,
  defaultLokasi,
  defaultLoket = "A",
  showLayanan = true,
  showDownload = false,
  emptyText,
  completeStatus,
  cancelStatus,
  cancelLabel,
}: Props) {
  const authRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const [lokasi, setLokasi] = useState(defaultLokasi);
  const [loket, setLoket] = useState(defaultLoket);
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [current, setCurrent] = useState<QueueRow | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [callButton, setCallButton] = useState<"Panggil" | "Selesai">("Panggil");
  const [disabledByOther, setDisabledByOther] = useState(false);

  useEffect(() => {
    const auth = readLegacyAuth();
    authRef.current = auth;
    if (auth?.lokasi) setLokasi(String(auth.lokasi).toUpperCase());
    if (auth?.loket) setLoket(String(auth.loket).toUpperCase());
  }, []);

  async function loadData(nextLokasi = lokasi, nextLoket = loket) {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        lokasi: nextLokasi,
        loket: nextLoket,
        page: "1",
        limit: "150",
        sort: "tgl_pelayanan",
        sortType: "asc",
      });
      const res = await fetch(`/api/espasi/${endpoint}?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as LoketApiResponse | null;
      const isEnvelope = Boolean(json && "success" in json);
      const okResponse = res.ok && (!isEnvelope || Boolean((json as ApiEnvelope<LegacyLoketData>).success));
      const payload = isEnvelope ? (json as ApiEnvelope<LegacyLoketData>).data : (json as LegacyLoketData | null);

      if (!okResponse) {
        setRows([]);
        setCurrent(null);
        setError((json as ApiEnvelope<LegacyLoketData> | null)?.message || "Gagal memuat data antrian");
        return;
      }

      const nextRows = Array.isArray(payload?.antrian) ? payload.antrian : [];
      setRows(nextRows);
      setCurrent(payload?.urutan_sekarang || nextRows[0] || null);
      setCallButton("Panggil");
      setPage(1);
    } catch (e: any) {
      setRows([]);
      setCurrent(null);
      setError(e?.message || "Gagal memuat data antrian");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(lokasi, loket);
  }, [endpoint, lokasi, loket]);

  useEffect(() => {
    const socket = io(DEFAULT_SOCKET_URL, { transports: ["websocket", "polling"], reconnection: true });
    socketRef.current = socket;
    const eventName = getLoketSocketEventByLokasi(lokasi);
    const doneEvent = `${eventName}_selesai`;

    socket.on(eventName, (payload: any) => {
      const auth = authRef.current;
      if (auth?.id && String(payload?.user_id) !== String(auth.id)) setDisabledByOther(true);
    });
    socket.on(doneEvent, () => setDisabledByOther(false));

    return () => {
      socket.off(eventName);
      socket.off(doneEvent);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [lokasi]);

  const filteredRows = useMemo(() => {
    const needle = q.trim().toUpperCase();
    if (!needle) return rows;
    return rows.filter((row) => buildSearchBucket(row).includes(needle));
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const colSpan = showLayanan ? 9 : 8;
  const disabled = busy || loading || disabledByOther || !current;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function pickRow(row: QueueRow) {
    setCurrent(row);
    setCallButton("Panggil");
  }

  function emitCall() {
    if (!current) return;
    const auth = authRef.current;
      const eventName = getLoketSocketEventByLokasi(toText(getRowValue(current, "LOKASI")) || lokasi);
    socketRef.current?.emit(eventName, {
      user_id: auth?.id ?? auth?.S_USER_ID ?? "NEXT",
      loket,
      urutan: toText(getRowValue(current, "URUTAN")),
    });
  }

  function resetPanel() {
    const eventName = getLoketSocketEventByLokasi(lokasi);
    socketRef.current?.emit(`${eventName}_selesai`);
    setDisabledByOther(false);
    setCallButton("Panggil");
  }

  async function updateStatus(status: FinalStatus) {
    if (!current) return;
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/espasi/antrian-loket-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nik: toText(getRowValue(current, "NIK")),
          telepon: toText(getRowValue(current, "TELEPON")),
          layanan: toText(getRowValue(current, "KODE_PELAYANAN")),
          lokasi: toText(getRowValue(current, "LOKASI")) || lokasi,
          status,
        }),
      });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<unknown> | null;
      if (!res.ok || !json?.success) {
        setError(json?.message || "Gagal memperbarui status antrian");
        return;
      }
      resetPanel();
      await loadData(lokasi, loket);
    } catch (e: any) {
      setError(e?.message || "Gagal memperbarui status antrian");
    } finally {
      setBusy(false);
    }
  }

  async function onPrimaryAction() {
    if (callButton === "Panggil") {
      emitCall();
      setCallButton("Selesai");
      return;
    }
    await updateStatus(completeStatus);
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] px-3 py-3 md:px-4">
      <div className="mb-2 border border-[#e8e8e8] bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => history.back()} className="text-[#262626]" title="Kembali">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold uppercase text-[#38b87c]">{title}</h1>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_270px]">
        <section className="bg-white p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setPage(1);
              }}
              placeholder="Cari..."
              className="h-9 w-[270px] border border-[#d9d9d9] px-3 text-sm text-[#595959] outline-none focus:border-[#40a9ff]"
            />
            {showDownload ? (
              <button
                type="button"
                onClick={() => exportCsv(filteredRows, showLayanan, title.toLowerCase().replace(/\s+/g, "-"))}
                className="inline-flex h-9 items-center gap-1 border border-[#42b983] bg-[#42b983] px-3 text-sm font-semibold text-white"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            ) : null}
            <select value={lokasi} onChange={(event) => setLokasi(event.target.value)} className="ml-auto h-9 border border-[#d9d9d9] px-2 text-sm outline-none">
              {LOCATION_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {lokasi !== "DISDUK" ? (
              <select value={loket} onChange={(event) => setLoket(event.target.value)} className="h-9 border border-[#d9d9d9] px-2 text-sm outline-none">
                {LOKET_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    Loket {item}
                  </option>
                ))}
              </select>
            ) : null}
            <button type="button" onClick={() => void loadData()} className="inline-flex h-9 items-center gap-1 border border-[#d9d9d9] px-3 text-sm">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto border border-[#e8e8e8]">
            <table className="w-full min-w-[1120px] border-collapse text-sm text-[#3f4a5a]">
              <thead>
                <tr className="bg-[#42b983] text-left text-xs font-bold uppercase text-white">
                  <th className="border-r border-white/50 px-3 py-3">NIK</th>
                  <th className="border-r border-white/50 px-3 py-3">Nama</th>
                  {showLayanan ? <th className="border-r border-white/50 px-3 py-3">Layanan</th> : null}
                  <th className="border-r border-white/50 px-3 py-3">Urutan</th>
                  <th className="border-r border-white/50 px-3 py-3">Status</th>
                  <th className="border-r border-white/50 px-3 py-3">Tanggal</th>
                  <th className="border-r border-white/50 px-3 py-3">Hari</th>
                  <th className="border-r border-white/50 px-3 py-3">Telepon</th>
                  <th className="px-3 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={colSpan} className="px-3 py-8 text-center text-[#7a8699]">
                      Memuat data...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={colSpan} className="px-3 py-8 text-center text-red-600">
                      {error}
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="px-3 py-8 text-center text-[#7a8699]">
                      {emptyText}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row, index) => (
                    <tr key={`${toText(getRowValue(row, "NIK"))}-${toText(getRowValue(row, "URUTAN"))}-${index}`} className={`border-t border-[#e8e8e8] ${current === row ? "bg-[#eaf7ff]" : "bg-white"}`}>
                      <td className="px-3 py-2">{toText(getRowValue(row, "NIK")) || "-"}</td>
                      <td className="px-3 py-2">{toText(getRowValue(row, "NAMA")) || "-"}</td>
                      {showLayanan ? <td className="px-3 py-2">{toText(getRowValue(row, "KODE_PELAYANAN")) || "-"}</td> : null}
                      <td className="px-3 py-2">{toText(getRowValue(row, "URUTAN")) || "-"}</td>
                      <td className="px-3 py-2">{toText(getRowValue(row, "STATUS_PELAYANAN")) || "-"}</td>
                      <td className="px-3 py-2">{toText(getRowValue(row, "TGL_PELAYANAN")) || "-"}</td>
                      <td className="px-3 py-2">{toText(getRowValue(row, "HARI")) || "-"}</td>
                      <td className="px-3 py-2">{toText(getRowValue(row, "TELEPON")) || "-"}</td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => pickRow(row)} className="font-medium text-[#7048e8] hover:underline">
                          Panggil
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2 text-sm text-[#3f4a5a]">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="px-2 text-lg disabled:opacity-30">
              &lt;
            </button>
            <span className="border border-[#1890ff] px-2 py-1 text-[#1890ff]">{page}</span>
            <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages} className="px-2 text-lg disabled:opacity-30">
              &gt;
            </button>
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-8 border border-[#d9d9d9] px-2">
              {PAGE_SIZE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value} / page
                </option>
              ))}
            </select>
          </div>
        </section>

        <aside className="bg-white p-8">
          <button type="button" onClick={resetPanel} className="ml-auto block text-[#595959]" title="Reset panel">
            <RotateCw className="h-5 w-5" />
          </button>
          <div className="text-center">
            <h2 className="mt-1 text-sm font-medium text-[#111827]">Antrian</h2>
            <div className="mt-7 text-7xl font-bold leading-none text-[#555]">{toText(getRowValue(current, "URUTAN")) || 0}</div>
            <h3 className="mt-8 text-sm font-medium text-[#111827]">Total</h3>
            <div className="mt-5 text-6xl font-bold leading-none text-[#555]">{filteredRows.length}</div>
          </div>

          <div className="mt-14 space-y-2">
            <button type="button" disabled={disabled} onClick={() => void onPrimaryAction()} className="h-8 w-full bg-[#1890ff] text-sm text-white disabled:opacity-50">
              {busy ? "Memproses..." : callButton}
            </button>
            <button type="button" disabled={disabled || callButton !== "Selesai"} onClick={emitCall} className="h-8 w-full bg-[#66b7ff] text-sm text-white disabled:opacity-50">
              Ulang
            </button>
            <button type="button" disabled={disabled} onClick={() => void updateStatus(cancelStatus)} className="h-8 w-full border border-dashed border-[#d9d9d9] text-sm text-[#595959] disabled:opacity-50">
              {cancelLabel}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
