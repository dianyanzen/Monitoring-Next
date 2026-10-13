"use client";
import { useRef } from "react";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import type { DatasetConfig } from "@/lib/pdak/config";
import UploadPreview from "./UploadPreview";
export type CardStatus = {
  type: string;
  status: string;
  canUpload: boolean;
  recordCount: number;
  uploadedAt: string | null;
  user: string | null;
  sourceFile: string | null;
};
export type PreviewResult = {
  type: string | null;
  status: "success" | "error";
  state: string;
  message: string;
  recordCount: number;
  sourceFile: string;
  sampleRows?: Array<Record<string, string | number | null>>;
  previewedAt?: string;
};
export function formatTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Jakarta",
      }).format(new Date(value.endsWith("Z") ? value : value + "+07:00"))
    : "—";
}
export default function UploadCard({
  dataset,
  status,
  file,
  result,
  busy,
  phase,
  onChoose,
  onClear,
}: {
  dataset: DatasetConfig;
  status?: CardStatus;
  file?: File;
  result?: PreviewResult;
  busy: boolean;
  phase?: string;
  onChoose: (files: File[]) => void;
  onClear: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const disabled = busy || !status?.canUpload;
  return (
    <article className="pdak-upload__card">
      <div className="pdak-upload__card-top">
        <FileSpreadsheet aria-hidden="true" />
        <span className="pdak-upload__badge">
          {phase ||
            (!status
              ? "Memuat"
              : status.status === "SUCCESS"
                ? "Sudah Upload"
                : status.canUpload
                  ? "Belum Upload"
                  : "Perlu Rekonsiliasi")}
        </span>
      </div>
      <h2>
        {
          {
            KIA: "KIA",
            AKTA_KELAHIRAN: "Akta Kelahiran",
            PEREKAMAN_KTPL: "Perekaman KTP-el",
            IKD: "Aktivasi IKD",
          }[dataset.type]
        }
      </h2>
      <p className="pdak-upload__target">
        {file?.name ??
          {
            KIA: "KIA.xls",
            AKTA_KELAHIRAN: "Akta Kelahiran.xls",
            PEREKAMAN_KTPL: "Target Perekaman.xls",
            IKD: "Capaian Target Aktivasi IKD.xls",
          }[dataset.type]}
      </p>
      <button
        type="button"
        className="pdak-upload__dropzone"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) onChoose(Array.from(e.dataTransfer.files));
        }}
        aria-label={`Pilih file ${dataset.label}`}
      >
        <UploadCloud aria-hidden="true" />
        <span>{file ? "Ganti file" : "Drag file atau pilih"}</span>
        <small>
          {file
            ? `${(file.size / 1024).toFixed(1)} KiB`
            : ".xls HTML / .xlsx • maksimal 10 MiB"}
        </small>
      </button>
      <p className="pdak-upload__card-foot">182 wilayah per snapshot</p>
      <input
        ref={input}
        type="file"
        accept=".xls,.xlsx"
        hidden
        disabled={disabled}
        onChange={(e) => {
          onChoose(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      {file && (
        <button
          type="button"
          disabled={busy}
          className="pdak-upload__refresh"
          onClick={onClear}
        >
          Hapus file / konflik
        </button>
      )}
      {status?.status === "SUCCESS" && (
        <p className="pdak-upload__status-info">
          {status.recordCount} baris • {status.user} •{" "}
          {formatTime(status.uploadedAt)} • {status.sourceFile}. Terkunci sampai
          tanggal WIB berubah.
        </p>
      )}
      {status?.status === "LEGACY_RECONCILIATION_REQUIRED" && (
        <p role="alert">
          Data hari ini sudah ada tanpa batch. Hubungi administrator untuk
          rekonsiliasi.
        </p>
      )}
      {result && (
        <p role="status" className="pdak-upload__result">
          {result.state}: {result.message}
        </p>
      )}
      {result?.sampleRows && (
        <>
          <p>
            Preview: {formatTime(result.previewedAt || null)} •{" "}
            {result.recordCount} baris valid
          </p>
          <UploadPreview rows={result.sampleRows} dataset={dataset} />
        </>
      )}
    </article>
  );
}
