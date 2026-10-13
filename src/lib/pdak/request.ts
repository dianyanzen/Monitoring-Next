import type { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { forbidden, unauthorized } from "@/lib/http";
import { hasPdakUploadAccess } from "./access";
import { MAX_FILE_BYTES, UploadValidationError } from "./parser";

export async function authorize() {
  const session = await readServerSession();
  if (!session)
    return { response: unauthorized("Sesi tidak valid."), session: null };
  if (
    !/^[\w.@-]{1,128}$/.test(session.S_USER_ID) ||
    !(await hasPdakUploadAccess(session.S_USER_LEVEL))
  )
    return {
      response: forbidden("Tidak memiliki izin Upload PDAK."),
      session: null,
    };
  return { response: null, session };
}
export function safeFileName(name: string) {
  return [
    ...(name.split(/[\\/]/).pop() || "upload.xls").replace(
      /[\u0000-\u001f\u007f]/g,
      "",
    ),
  ]
    .slice(0, 200)
    .join("");
}
export async function readFiles(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  let originHost = "";
  try {
    originHost = origin ? new URL(origin).host : "";
  } catch {}
  if (
    !originHost ||
    originHost !== host ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new UploadValidationError("Origin permintaan tidak valid.");
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
    throw new UploadValidationError("Gunakan multipart/form-data.");
  const max = MAX_FILE_BYTES * 4 + 1024 * 1024;
  if (Number(request.headers.get("content-length")) > max)
    throw new UploadValidationError("Ukuran permintaan melebihi 40 MiB.");
  // Count actual streamed bytes even for chunked requests before allocating form buffers.
  const reader = request.body?.getReader();
  if (!reader) throw new UploadValidationError("Body permintaan kosong.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const deadline = Date.now() + 30000;
  try {
    while (true) {
      let timer: ReturnType<typeof setTimeout>;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => {
            void reader.cancel();
            reject(new UploadValidationError("Waktu membaca unggahan habis."));
          },
          Math.max(1, deadline - Date.now()),
        );
      });
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await Promise.race([reader.read(), timeout]);
      } finally {
        clearTimeout(timer!);
      }
      const { done, value } = chunk;
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new UploadValidationError("Ukuran permintaan melebihi batas.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type")! },
    }).formData();
  } catch {
    throw new UploadValidationError("Multipart tidak valid.");
  }
  const files = [...form.getAll("files"), ...form.getAll("file")];
  if (!files.length || files.length > 4)
    throw new UploadValidationError("Pilih 1 sampai 4 file.");
  let total = 0;
  for (const file of files) {
    if (!(file instanceof File) || !file.size || file.size > MAX_FILE_BYTES)
      throw new UploadValidationError("File kosong atau melebihi 10 MiB.");
    total += file.size;
  }
  if (total > MAX_FILE_BYTES * 4)
    throw new UploadValidationError("Total file melebihi 40 MiB.");
  return {
    files: files as File[],
    mode: String(form.get("mode") || "save"),
    types: form.getAll("expectedTypes").map(String),
  };
}
export function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "no-store");
  return response;
}
