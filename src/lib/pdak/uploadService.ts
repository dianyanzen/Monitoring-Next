import type { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { badRequest, err, ok } from "@/lib/http";
import { Log } from "@/lib/log";
import {
  authorize,
  noStore,
  readFiles,
  safeFileName,
} from "@/lib/pdak/request";
import { getPdakEntryDate } from "@/lib/pdak/date";
import { parsePdaKFile, UploadValidationError } from "@/lib/pdak/parser";
import { validateHierarchy } from "@/lib/pdak/validate";
import {
  loadRegionMaster,
  saveDataset,
  recordFailedAttempt,
} from "@/lib/pdak/uploadRepository";
import { DailyUploadConflict } from "@/lib/pdak/transaction";
import { allowPdakRequest } from "./rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function handleUpload(request: NextRequest, preview = false) {
  const started = Date.now();
  const date = getPdakEntryDate();
  try {
    const auth = await authorize();
    if (auth.response) return noStore(auth.response);
    if (!allowPdakRequest(auth.session!.S_USER_ID))
      return noStore(
        err("Terlalu banyak permintaan. Coba kembali dalam satu menit.", 429),
      );
    const { files, mode, types } = await readFiles(request);
    const validateOnly = preview || mode === "validate";
    if (!["save", "validate"].includes(mode))
      return noStore(badRequest("Mode tidak valid."));
    if (types.length && types.length !== files.length)
      return noStore(badRequest("Informasi kategori tidak lengkap."));
    const parsed = [];
    for (const [index, file] of files.entries()) {
      const buffer = Buffer.from(await file.arrayBuffer());
      try {
        const dataset = await parsePdaKFile(buffer);
        parsed.push({
          dataset,
          file: safeFileName(file.name),
          hash: createHash("sha256").update(buffer).digest("hex"),
          error:
            types[index] && types[index] !== dataset.config.type
              ? "File tidak sesuai kategori yang dipilih."
              : "",
          index,
        });
      } catch (e) {
        parsed.push({
          dataset: null,
          file: safeFileName(file.name),
          hash: "",
          error:
            e instanceof UploadValidationError
              ? e.message
              : "File tidak dapat dibaca.",
          index,
        });
      }
    }
    for (const item of parsed)
      if (
        item.dataset &&
        parsed.filter(
          (p) => p.dataset?.config.type === item.dataset.config.type,
        ).length > 1
      )
        item.error =
          "Dua file untuk kategori sama. Hapus konflik sebelum menyimpan.";
    const master = parsed.some((p) => p.dataset && !p.error)
      ? await loadRegionMaster()
      : null;
    const results = [];
    for (const item of parsed) {
      const d = item.dataset;
      if (d && !item.error && master)
        try {
          validateHierarchy(d.rows, master);
        } catch (e) {
          item.error =
            e instanceof UploadValidationError
              ? e.message
              : "Master wilayah tidak sesuai.";
        }
      const base = {
        type: d?.config.type || types[item.index] || null,
        datasetType: d?.config.type || null,
        label: d?.config.label || "File tidak dikenal",
        sourceFile: item.file,
        total: d?.rows.length || 0,
      };
      if (!d || item.error) {
        results.push({
          ...base,
          status: "error",
          state: "INVALID",
          message: item.error,
          recordCount: 0,
          inserted: 0,
          errorCode: "INVALID_FILE",
        });
        if (!validateOnly)
          await Log.info({
            scope: "API",
            msg: "pdak/upload/invalid",
            user: auth.session!.S_USER_ID,
            tookMs: Date.now() - started,
            extra: {
              date,
              dataset: base.datasetType,
              sourceFile: item.file,
              errorCode: "INVALID_FILE",
            },
          }).catch(() => {});
        if (!validateOnly)
          await recordFailedAttempt(
            date,
            auth.session!.S_USER_ID,
            base.type,
            item.file,
            "INVALID_FILE",
          ).catch(() => {});
        continue;
      }
      if (validateOnly) {
        results.push({
          ...base,
          status: "success",
          state: "READY",
          message: "Validasi berhasil; belum disimpan.",
          recordCount: d.rows.length,
          inserted: 0,
          sampleRows: d.rows.slice(0, 5),
          counts: { city: 1, district: 30, village: 151 },
          previewedAt: new Date().toISOString(),
        });
        continue;
      }
      let result;
      try {
        await saveDataset(
          d,
          date,
          auth.session!.S_USER_ID,
          item.file,
          item.hash,
        );
        result = {
          ...base,
          status: "success",
          state: "SUCCESS",
          message: "182 baris berhasil disimpan.",
          recordCount: 182,
          inserted: 182,
          duplicate: 0,
          errorCode: null,
        };
      } catch (e) {
        const duplicate = Number((e as { errorNum?: number })?.errorNum) === 1;
        const code =
          e instanceof DailyUploadConflict
            ? e.code
            : duplicate
              ? "REJECTED_DUPLICATE"
              : "DATABASE_ERROR";
        result = {
          ...base,
          status: "error",
          state: code,
          message:
            code === "REJECTED_DUPLICATE"
              ? "Dataset sudah diupload hari ini."
              : code === "LEGACY_RECONCILIATION_REQUIRED"
                ? "Data hari ini sudah ada tanpa batch. Administrator perlu rekonsiliasi."
                : "Penyimpanan belum terkonfirmasi. Refresh status sebelum mencoba kembali.",
          recordCount: 0,
          inserted: 0,
          duplicate: duplicate ? 182 : 0,
          errorCode: code,
        };
      }
      results.push(result);
      if (result.status === "error")
        await recordFailedAttempt(
          date,
          auth.session!.S_USER_ID,
          d.config.type,
          item.file,
          result.errorCode!,
        ).catch(() => {});
      // Audit errors must never turn an already committed dataset into an apparent failure.
      await Log.info({
        scope: "API",
        msg: "pdak/upload/outcome",
        user: auth.session!.S_USER_ID,
        tookMs: Date.now() - started,
        extra: {
          date,
          dataset: d.config.type,
          status: result.state,
          rows: result.inserted,
          sourceFile: item.file,
        },
      }).catch(() => {});
    }
    return noStore(
      ok(
        { date, timeZone: "Asia/Jakarta", results },
        validateOnly ? "Preview selesai." : "Periksa hasil setiap kategori.",
      ),
    );
  } catch (e) {
    if (e instanceof UploadValidationError)
      return noStore(badRequest(e.message));
    await Log.error({
      scope: "API",
      msg: "pdak/upload/error",
      tookMs: Date.now() - started,
      err: { name: "PdakUploadError", message: "Upload tidak dapat diproses." },
    }).catch(() => {});
    return noStore(
      err(
        "Upload tidak dapat diproses. Periksa koneksi, metadata PDAK dan izin MONALISA.",
        503,
      ),
    );
  }
}
export async function POST(request: NextRequest) {
  return handleUpload(request);
}
