// File: src/lib/session.ts
import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { Log } from "./log";

export type SessionUser = {
  S_USER_ID: string;
  S_SESSION_ID: string;
  S_IP_ADDRESS?: string;
  S_USER_AGENT?: string;
  S_NAMA_LGKP?: string;
  S_NIK?: string | number;
  S_TGL_LHR?: string;
  S_JENIS_KLMIN?: string;
  S_NAMA_KANTOR?: string;
  S_ALAMAT_KANTOR?: string;
  S_TELP?: string;
  S_ALAMAT_RUMAH?: string;
  S_USER_LEVEL?: number;
  S_NO_PROP?: string; S_NO_KAB?: string; S_NO_KEC?: string; S_NO_KEL?: string; S_NO_RW?: string; S_NO_RT?: string;
  S_NAMA_DPN?: string; S_IS_ASN?: string; S_NM_KAB?: string;
  // tambahkan field lain jika perlu
};

const COOKIE_NAME = "session_user";
const COOKIE_SIG  = "session_sig";

function hmac(data: string) {
  const key = process.env.SESSION_SECRET || "dev-secret-only-local";
  return crypto.createHmac("sha256", key).update(data).digest("base64url");
}

export function signPayload(jsonStr: string) {
  return hmac(jsonStr);
}

export function verifyPayload(jsonStr: string, signature?: string) {
  if (!signature) return false;
  const expected = hmac(jsonStr);

  // timing-safe compare: samakan panjang buffer dulu biar tidak throw
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Encode → percent-encode agar aman di cookie */
export function encodeCookie(obj: object) {
  return encodeURIComponent(JSON.stringify(obj));
}
export function decodeCookie(raw?: string) {
  if (!raw) return null;
  try {
    const dec = decodeURIComponent(raw);
    return JSON.parse(dec);
  } catch {
    return null;
  }
}

/** Set session cookie + signature (logged) */
export async function setSessionCookie(user: SessionUser, maxAgeSec?: number) {
  const c = cookies(); // sync
  const payload = encodeCookie(user);
  const sig = signPayload(payload);

  const maxAge = Number(process.env.SESSION_MAX_AGE || maxAgeSec || 60 * 60 * 8);

  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };

  (await c).set(COOKIE_NAME, payload, base);
  (await c).set(COOKIE_SIG, sig, { ...base, httpOnly: true });

  // audit
  const { ip, ua } = await getClientInfo();
  await Log.info({
    scope: "SESSION",
    msg: "login/setSession",
    user: user.S_USER_ID,
    session: user.S_SESSION_ID,
    ip, ua
  });
}

/** Hapus cookie sesi (logged) */
export async function clearSessionCookie() {
  const c = cookies();
  (await c).set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  (await c).set(COOKIE_SIG, "",  { path: "/", maxAge: 0 });

  const { ip, ua } = await getClientInfo();
  await Log.info({
    scope: "SESSION",
    msg: "logout/clearSession",
    ip, ua
  });
}

/** Baca & validasi dari cookie (di Server Component/API/Route) */
export async function readServerSession(): Promise<SessionUser | null> {
  const c = cookies();
  const raw = (await c).get(COOKIE_NAME)?.value;
  const sig = (await c).get(COOKIE_SIG)?.value;
  if (!raw || !sig) return null;

  if (!verifyPayload(raw, sig)) {
    await Log.warn({ scope: "SESSION", msg: "invalid signature on read" });
    return null;
  }

  const data = decodeCookie(raw) as SessionUser | null;
  if (!data?.S_USER_ID || !data?.S_SESSION_ID || !String(data?.S_NIK || "").trim()) {
    await Log.warn({ scope: "SESSION", msg: "missing required fields on read" });
    return null;
  }
  return data;
}

/** Opsi: perpanjang sesi (sliding session) */
export async function maybeRefreshSession(maxAgePercent = 0.5) {
  // Catatan: Next tidak expose sisa expiry; strategi: refresh via middleware/interval
  const c = cookies();
  const raw = (await c).get(COOKIE_NAME)?.value;
  const sig = (await c).get(COOKIE_SIG)?.value;
  if (!raw || !sig || !verifyPayload(raw, sig)) return;

  const obj = decodeCookie(raw) as SessionUser | null;
  if (!obj) return;

  // Perpanjang dengan maxAge default/ENV
  const maxAge = Number(process.env.SESSION_MAX_AGE || 60 * 60 * 8);
  await setSessionCookie(obj, maxAge);
}

/** Utility: ambil IP & UA untuk log/audit */
export async function getClientInfo() {
  const h = headers(); // sync
  const xff = (await h).get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = (await h).get("x-real-ip")?.trim();
  const cf = (await h).get("cf-connecting-ip")?.trim();
  const ip = xff || real || cf || "127.0.0.1";
  const ua = (await h).get("user-agent") || "";
  return { ip, ua };
}

export async function readUserFromCookies(): Promise<SessionUser | null> {
  // Jika sudah ada implementasi serupa, gunakan itu.
  // Di bawah ini contoh implementasi berdasar pola file kamu:
  const c = cookies();
  const raw = (await c).get(COOKIE_NAME)?.value;
  const sig = (await c).get(COOKIE_SIG)?.value;
  if (!raw || !sig || !verifyPayload(raw, sig)) return null;
  const obj = decodeCookie(raw) as SessionUser | null;
  return obj ?? null;
}

export async function readUserLevelFromCookies(p0: number): Promise<number> {
  const user = await readUserFromCookies();
  return user?.S_USER_LEVEL ?? 0;
}