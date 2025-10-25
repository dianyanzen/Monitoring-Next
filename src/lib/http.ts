// FILE: /lib/http.ts
import { NextResponse } from "next/server";

// ✅ respon sukses standar
export function ok<T = any>(data: T, cacheSeconds = 0) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (cacheSeconds > 0) {
    headers["Cache-Control"] = `public, max-age=${cacheSeconds}`;
  }

  return NextResponse.json(
    { success: true, data },
    { status: 200, headers }
  );
}

// ❌ respon gagal (500 / error umum)
export function err(message = "Terjadi kesalahan server", status = 500) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

// ⚠️ respon invalid / bad request
export function badRequest(message = "Permintaan tidak valid") {
  return err(message, 400);
}

// 🔒 respon unauthorized
export function unauthorized(message = "Akses ditolak") {
  return err(message, 401);
}

// 🧩 util kecil: pengecekan input cepat
export function requireParams<T extends Record<string, any>>(
  obj: T,
  required: (keyof T)[]
): string | null {
  for (const key of required) {
    if (!obj[key]) return `Parameter '${String(key)}' wajib diisi`;
  }
  return null;
}

