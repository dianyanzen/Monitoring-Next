// FILE: src/lib/session.ts
import "server-only";
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
};

const COOKIE_NAME = "session_user";
const COOKIE_SIG  = "session_sig";

/* ===== Helpers: HMAC & cookie flags ===== */
function hmac(data: string) {
  const key = process.env.SESSION_SECRET || "dev-secret-only-local";
  return crypto.createHmac("sha256", key).update(data).digest("base64url");
}
export const signPayload = (jsonStr: string) => hmac(jsonStr);

export function verifyPayload(jsonStr: string, signature?: string) {
  if (!signature) return false;
  const expected = hmac(jsonStr);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const encodeCookie = (obj: object) =>
  encodeURIComponent(JSON.stringify(obj));

export function decodeCookie(raw?: string) {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

async function isForwardedHttps() {
  try {
    const h = await headers();
    const p = (h.get("x-forwarded-proto") || h.get("cf-visitor") || "").toLowerCase();
    return p.includes("https");
  } catch { return false; }
}

/** Secure flag final:
 * - ENV override: SESSION_COOKIE_SECURE=0/1
 * - Default: true hanya jika request benar2 HTTPS atau NODE_ENV=production
 */
async function resolveCookieSecureFlag() {
  const env = (process.env.SESSION_COOKIE_SECURE ?? "").trim();
  if (env === "0") return false;
  if (env === "1") return true;
  return (await isForwardedHttps()) || process.env.NODE_ENV === "production";
}

/* ===== Session ops ===== */
export async function setSessionCookie(user: SessionUser, maxAgeSec?: number) {
  const c = await cookies();
  const payload = encodeCookie(user);
  const sig = signPayload(payload);
  const maxAge = Number(process.env.SESSION_MAX_AGE || maxAgeSec || 60 * 60 * 8);
  const secure = await resolveCookieSecureFlag();

  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure,
    maxAge,
  };

  c.set(COOKIE_NAME, payload, base);
  c.set(COOKIE_SIG, sig, { ...base, httpOnly: true });

  if (secure && !(await isForwardedHttps())) {
    await Log.warn({ scope: "SESSION", msg: "cookie Secure on HTTP; browser may drop cookie" });
  }

  const { ip, ua } = await getClientInfo();
  await Log.info({ scope: "SESSION", msg: "login/setSession", user: user.S_USER_ID, session: user.S_SESSION_ID, ip, ua });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  c.set(COOKIE_SIG, "",  { path: "/", maxAge: 0 });

  const { ip, ua } = await getClientInfo();
  await Log.info({ scope: "SESSION", msg: "logout/clearSession", ip, ua });
}

export async function readServerSession(): Promise<SessionUser | null> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  const sig = c.get(COOKIE_SIG)?.value;
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

export async function maybeRefreshSession() {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  const sig = c.get(COOKIE_SIG)?.value;
  if (!raw || !sig || !verifyPayload(raw, sig)) return;
  const obj = decodeCookie(raw) as SessionUser | null;
  if (!obj) return;
  const maxAge = Number(process.env.SESSION_MAX_AGE || 60 * 60 * 8);
  await setSessionCookie(obj, maxAge);
}

export async function getClientInfo() {
  const h = await headers();
  const xff  = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = h.get("x-real-ip")?.trim();
  const cf   = h.get("cf-connecting-ip")?.trim();
  const ip = xff || real || cf || "127.0.0.1";
  const ua = h.get("user-agent") || "";
  return { ip, ua };
}

export async function readUserFromCookies(): Promise<SessionUser | null> {
  const c = await cookies();
  const raw = c.get(COOKIE_NAME)?.value;
  const sig = c.get(COOKIE_SIG)?.value;
  if (!raw || !sig || !verifyPayload(raw, sig)) return null;
  return (decodeCookie(raw) as SessionUser) ?? null;
}

export async function readUserLevelFromCookies(_: number): Promise<number> {
  const user = await readUserFromCookies();
  return user?.S_USER_LEVEL ?? 0;
}
