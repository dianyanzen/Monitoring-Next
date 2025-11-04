// FILE: /lib/http.ts
import { NextResponse } from "next/server";

/* ================================
   Types & util
   ================================ */
export type ApiEnvelope<T = unknown> = {
  success: boolean;
  message: string;
  data: T;
};

type SendOpts = {
  status?: number;
  cacheSeconds?: number;
  headers?: Record<string, string>;
};

function sendJson(body: any, opts: SendOpts = {}) {
  const { status = 200, cacheSeconds = 0, headers = {} } = opts;
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };
  if (cacheSeconds > 0) {
    h["Cache-Control"] = `public, max-age=${cacheSeconds}`;
  }
  return NextResponse.json(body, { status, headers: h });
}

/* ================================
   1) Success (200, success:true)
   - Kompatibel dengan ok(data, 60)
   - Baru: ok(data, "Pesan", 60)
   - Default message: "OK"
   ================================ */
export function ok<T = any>(
  data: T,
  messageOrCache?: string | number,
  maybeCache?: number
) {
  let message = "OK";
  let cacheSeconds = 0;

  if (typeof messageOrCache === "number") {
    cacheSeconds = messageOrCache;
  } else if (typeof messageOrCache === "string") {
    message = messageOrCache;
    if (typeof maybeCache === "number") cacheSeconds = maybeCache;
  }

  return sendJson(
    { success: true, message, data } as ApiEnvelope<T>,
    { status: 200, cacheSeconds }
  );
}

/* ================================
   2) Soft fail (200, success:false)
   - Untuk validasi / kegagalan yang dipahami klien
   - Ikuti styleguide: tetap status 200
   ================================ */
export function fail<T = Record<string, unknown>>(message = "Gagal diproses", data = {} as T) {
  return sendJson({ success: false, message, data }, { status: 200 });
}

/* ================================
   3) Error tak terduga (default 500)
   - Tetap envelope standar
   - Bisa kirim data tambahan (opsional)
   ================================ */
export function err<T = Record<string, unknown>>(
  message = "Terjadi kesalahan server",
  status = 500,
  data = {} as T
) {
  return sendJson({ success: false, message, data }, { status });
}

/* ================================
   4) Bad request (ikut styleguide → 200)
   - Gunakan ini untuk invalid input
   ================================ */
export function badRequest<T = Record<string, unknown>>(
  message = "Permintaan tidak valid",
  data = {} as T
) {
  return fail<T>(message, data);
}

/* ================================
   5) Auth helpers (401/403)
   - Auth/izin wajib pakai status non-200
   ================================ */
export function unauthorized(message = "Akses ditolak") {
  return sendJson({ success: false, message, data: {} }, { status: 401 });
}
export function forbidden(message = "Tidak memiliki izin") {
  return sendJson({ success: false, message, data: {} }, { status: 403 });
}

/* ================================
   6) Util: pengecekan parameter sederhana
   ================================ */
export function requireParams<T extends Record<string, any>>(
  obj: T,
  required: (keyof T)[]
): string | null {
  for (const key of required) {
    if (obj[key] === undefined || obj[key] === null || obj[key] === "") {
      return `Parameter '${String(key)}' wajib diisi`;
    }
  }
  return null;
}
