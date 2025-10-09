// File: app/api/session/route.ts
import { cookies } from "next/headers";
import { ok, badRequest, unauthorized } from "@/lib/http";

type SessionUser = {
  S_USER_ID?: string;
  S_SESSION_ID?: string;
  S_NIK?: string | number;
  NAMA_LGKP?: string;
  [k: string]: unknown;
};

export async function GET() {
  const raw = (await cookies()).get("session_user")?.value;
  if (!raw) return unauthorized("Tidak ada sesi. Silakan login kembali.");

  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch {}

  let data: SessionUser | null = null;
  try { data = JSON.parse(decoded) as SessionUser; } catch { return badRequest("Cookie sesi rusak."); }

  if (!data?.S_USER_ID || !data?.S_SESSION_ID || !data?.S_NIK?.toString().trim()) {
    return badRequest("Session user tidak lengkap.");
  }

  // Cek cepat cukup dari cookie (hemat query DB)
  return ok({ user: data });
}
