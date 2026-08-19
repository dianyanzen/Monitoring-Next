import type { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { unauthorized, badRequest } from "@/lib/http";

export const ESPASI_DB_ALIAS = process.env.DB_ALIAS_ESPASI ?? "DBSMS";
export const ESPASI_APP_API_URL =
  process.env.ESPASI_APP_API_URL?.trim() || "//10.32.73.7/webdisdukv3/api-espasi/";
export const ESPASI_APP_API_SRC_URL =
  process.env.ESPASI_APP_API_SRC_URL?.trim() || "//10.32.73.7/webdisdukv3/api-espasi/public/";
export const ESPASI_APP_HOST_URL = process.env.ESPASI_APP_HOST_URL?.trim() || "http://10.32.73.7:1111";
export const ESPASI_APP_SOCKET_WA = process.env.ESPASI_APP_SOCKET_WA?.trim() || "http://10.32.73.7:9999";

export function getLimit(req: NextRequest, fallback = 100, max = 500) {
  const raw = Number(req.nextUrl.searchParams.get("limit") ?? fallback);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(Math.trunc(raw), max);
}

export function getLokasi(req: NextRequest) {
  return (req.nextUrl.searchParams.get("lokasi") ?? "").trim().toUpperCase();
}

export function getQ(req: NextRequest) {
  return (req.nextUrl.searchParams.get("q") ?? "").trim().toUpperCase();
}

export async function ensureSession() {
  const sess = await readServerSession().catch(() => null);
  if (!sess?.S_USER_ID) return { error: unauthorized("Unauthorized") as Response, session: null };
  return { error: null, session: sess };
}

export function requireMode(mode: string, allowed: string[]) {
  if (!allowed.includes(mode)) {
    return badRequest(`Mode tidak valid. Gunakan salah satu: ${allowed.join(", ")}`);
  }
  return null;
}
