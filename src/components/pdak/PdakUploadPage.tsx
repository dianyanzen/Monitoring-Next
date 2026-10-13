"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DATASETS, DatasetType } from "@/lib/pdak/config";
import UploadCard, {
  CardStatus,
  PreviewResult,
  formatTime,
} from "./UploadCard";
import UploadHistory from "./UploadHistory";
import Link from "next/link";
import { CalendarDays, RefreshCcw, Table2, UploadCloud } from "lucide-react";
import NeonModal from "@/components/ui/NeonModal";
import { uploadRequest } from "./uploadRequest";
export default function PdakUploadPage() {
  const [date, setDate] = useState(""),
    [statuses, setStatuses] = useState<CardStatus[]>([]),
    [files, setFiles] = useState<Partial<Record<DatasetType, File>>>({}),
    [results, setResults] = useState<Record<string, PreviewResult>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [phases, setPhases] = useState<Record<string, string>>({}),
    [version, setVersion] = useState(0);
  const mutex = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState<{
    label: string;
    percent: number | null;
  } | null>(null);
  const [completion, setCompletion] = useState("");
  const filesRef = useRef(files);
  filesRef.current = files;
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/pdak/upload/status", { cache: "no-store" });
      const p = await r.json();
      if (!r.ok || !p.success) throw new Error(p.message);
      setDate(p.data.date);
      setStatuses(p.data.items);
      setError("");
      setVersion((v) => v + 1);
    } catch (e) {
      setStatuses([]);
      setError(e instanceof Error ? e.message : "Status gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    return () => clearInterval(timer);
  }, [refresh]);
  async function preview(chosen: File[]) {
    if (mutex.current) return;
    if (!chosen.length || chosen.length > 4) {
      setError("Pilih satu sampai empat file.");
      return;
    }
    mutex.current = true;
    setBusy(true);
    setError("");
    setCompletion("");
    setProgress({ label: "Mengirim file untuk validasi", percent: 0 });
    setPhases(
      Object.fromEntries(DATASETS.map((d) => [d.type, "Memvalidasi…"])),
    );
    try {
      const form = new FormData();
      chosen.forEach((f) => form.append("files", f));
      const response = await uploadRequest(
        "/api/pdak/upload/preview",
        form,
        (percent) => {
          setProgress({
            label:
              percent === null
                ? "Memvalidasi file"
                : "Mengirim file untuk validasi",
            percent,
          });
        },
      );
      const p = response.payload;
      if (!response.ok || !p.success) throw new Error(p.message);
      const nextFiles = { ...filesRef.current },
        nextResults: Record<string, PreviewResult> = { ...results };
      for (const [i, result] of (p.data.results as PreviewResult[]).entries()) {
        if (!result.type) {
          setError(result.message);
          continue;
        }
        const type = result.type as DatasetType;
        if (!statuses.find((s) => s.type === type)?.canUpload) {
          setError(`${type}: upload hari ini terkunci.`);
          continue;
        }
        if (nextFiles[type]) {
          nextResults[type] = {
            ...result,
            status: "error",
            state: "INVALID",
            message:
              "Konflik: lebih dari satu file untuk kategori ini. Hapus file lalu pilih ulang.",
          };
        } else {
          nextFiles[type] = chosen[i];
          nextResults[type] = result;
        }
      }
      setFiles(nextFiles);
      setResults(nextResults);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview gagal.");
    } finally {
      mutex.current = false;
      setBusy(false);
      setPhases({});
      setProgress(null);
    }
  }
  const ready = DATASETS.filter(
    (d) =>
      files[d.type] &&
      results[d.type]?.status === "success" &&
      statuses.find((s) => s.type === d.type)?.canUpload,
  );
  async function save() {
    if (mutex.current || !ready.length) return;
    mutex.current = true;
    setBusy(true);
    setError("");
    setCompletion("");
    let saved = 0;
    try {
      for (const d of ready) {
        setProgress({ label: `Mengirim ${d.label}`, percent: 0 });
        setPhases({ [d.type]: "Mengirim dan menyimpan…" });
        const form = new FormData();
        form.append("files", files[d.type]!);
        form.append("expectedTypes", d.type);
        try {
          const r = await uploadRequest("/api/pdak/upload", form, (percent) => {
            setProgress({
              label:
                percent === null
                  ? `Menyimpan ${d.label} ke database (${saved + 1}/${ready.length})`
                  : `Mengirim ${d.label} (${saved + 1}/${ready.length})`,
              percent,
            });
          });
          const p = r.payload;
          if (!r.ok || !p.success) throw new Error(p.message);
          const result = p.data.results[0] as PreviewResult;
          setResults((prev) => ({ ...prev, [d.type]: result }));
          if (result.status === "success") {
            saved++;
            setFiles((prev) => {
              const next = { ...prev };
              delete next[d.type];
              return next;
            });
          }
        } catch (e) {
          setResults((prev) => ({
            ...prev,
            [d.type]: {
              type: d.type,
              status: "error",
              state: "ERROR",
              message:
                e instanceof Error
                  ? e.message
                  : "Hasil belum terkonfirmasi. Refresh status.",
              recordCount: 0,
              sourceFile: files[d.type]!.name,
            },
          }));
        }
      }
      setCompletion(
        saved === ready.length
          ? `Upload selesai. ${saved} kategori berhasil disimpan ke database.`
          : `Proses upload selesai: ${saved} dari ${ready.length} kategori berhasil. Periksa hasil kategori yang gagal sebelum mencoba kembali.`,
      );
      await refresh();
    } finally {
      mutex.current = false;
      setBusy(false);
      setPhases({});
      setProgress(null);
    }
  }
  const complete = statuses.filter((s) => s.status === "SUCCESS");
  const latest =
    complete
      .map((s) => s.uploadedAt)
      .filter(Boolean)
      .sort()
      .at(-1) || null;
  return (
    <div
      className="pdak-upload"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!busy && !loading) void preview(Array.from(e.dataTransfer.files));
      }}
    >
      <section className="pdak-panel">
        <header className="pdak-upload__heading">
          <div>
            <h1>
              <UploadCloud size={19} /> Upload Data PDAK
            </h1>
            <p>Monitoring Data Kependudukan • Kota Bandung</p>
          </div>
          <div className="pdak-toolbar">
            <Link className="pdak-upload__refresh" href="/pdak/data">
              <Table2 size={15} /> Lihat Data
            </Link>
            <Link className="pdak-upload__refresh" href="/pdak/ikd/ranking">
              Klasemen IKD
            </Link>
            <button
              className="pdak-upload__refresh"
              disabled={busy || loading}
              onClick={() => void refresh()}
            >
              <RefreshCcw size={15} /> Refresh
            </button>
          </div>
        </header>
        <section className="pdak-upload__entry">
          <div>
            <span>Tanggal Entry</span>
            <strong>
              {date
                ? new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "long",
                    timeZone: "Asia/Jakarta",
                  }).format(new Date(date + "T12:00:00+07:00"))
                : "Memuat tanggal server…"}
            </strong>
          </div>
          <span className="pdak-upload__badge">
            <CalendarDays size={13} /> Otomatis WIB
          </span>
        </section>
        {error && (
          <p className="pdak-upload__alert" role="alert">
            {error}
          </p>
        )}
        <section className="pdak-upload__date">
          <label className="pdak-upload__refresh">
            Pilih beberapa file
            <input
              type="file"
              multiple
              accept=".xls,.xlsx"
              disabled={busy || loading || !statuses.length}
              onChange={(e) => {
                void preview(Array.from(e.target.files || []));
                e.target.value = "";
              }}
            />
          </label>
          <span role="status" aria-live="polite">
            {busy
              ? "Memproses kategori…"
              : "File dikenali otomatis berdasarkan header."}
          </span>
        </section>
        <section className="pdak-upload__grid" aria-label="Dataset PDAK">
          {DATASETS.map((d) => (
            <UploadCard
              key={d.type}
              dataset={d}
              status={statuses.find((s) => s.type === d.type)}
              file={files[d.type]}
              result={results[d.type]}
              phase={phases[d.type]}
              busy={busy || loading}
              onChoose={(f) => void preview(f)}
              onClear={() => {
                setFiles((prev) => {
                  const n = { ...prev };
                  delete n[d.type];
                  return n;
                });
                setResults((prev) => {
                  const n = { ...prev };
                  delete n[d.type];
                  return n;
                });
              }}
            />
          ))}
        </section>
        {progress && (
          <div className="pdak-transfer" role="status" aria-live="polite">
            <div>
              <strong>{progress.label}</strong>
              <span>
                {progress.percent === null
                  ? "Memproses..."
                  : `${progress.percent}%`}
              </span>
            </div>
            <progress
              aria-label={progress.label}
              max={100}
              value={progress.percent ?? undefined}
            />
          </div>
        )}
        {completion && (
          <p className="pdak-completion" role="status" aria-live="polite">
            {completion}
          </p>
        )}
        <div className="pdak-upload__actions pdak-upload__save-actions">
          <div className="pdak-upload__summary-heading">
            <strong>Ringkasan Upload</strong>
            <span>
              {Object.keys(files).length} dari 4 file dipilih • {ready.length}{" "}
              siap
            </span>
          </div>
          <div
            className="pdak-upload__selection-track"
            role="meter"
            aria-label="Kategori siap disimpan"
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={ready.length}
          >
            <span style={{ width: `${ready.length * 25}%` }} />
          </div>
          <button
            className="pdak-upload__button"
            disabled={busy || loading || !ready.length}
            onClick={() => setConfirmOpen(true)}
          >
            <UploadCloud size={15} />{" "}
            {busy ? "Memproses…" : "Simpan ke Database"}
          </button>
        </div>
        <details className="pdak-upload__daily">
          <summary>
            Status Upload Hari Ini • {complete.length}/4 selesai
          </summary>
          <div className="pdak-upload__summary">
            <span>
              Sudah Upload <strong>{complete.length}/4</strong>
            </span>
            <span>
              Belum Upload <strong>{4 - complete.length}/4</strong>
            </span>
            <span>
              Baris Tersimpan{" "}
              <strong>{statuses.reduce((n, s) => n + s.recordCount, 0)}</strong>
            </span>
            <span>
              Terakhir Upload <strong>{formatTime(latest)}</strong>
            </span>
          </div>
        </details>
        <p className="pdak-upload__hint">
          Drag dan drop atau pilih file untuk melihat preview. Setiap kategori
          menyimpan 182 wilayah dan hanya dapat diupload sekali per hari WIB.
        </p>
      </section>
      <UploadHistory version={version} />
      <NeonModal
        open={confirmOpen}
        kind="confirm"
        title="Simpan Data PDAK"
        message={`${ready.map((d) => `${d.label}: 182 baris`).join("\n")}\nSnapshot mengikuti tanggal WIB saat penyimpanan dimulai. Setiap kategori hanya boleh berhasil sekali sehari.`}
        confirmText="Simpan"
        cancelText="Batal"
        loading={busy}
        onConfirm={() => {
          setConfirmOpen(false);
          void save();
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
