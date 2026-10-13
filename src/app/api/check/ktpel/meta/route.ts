import { NextRequest } from "next/server";
import { ok, err, unauthorized } from "@/lib/http";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import {
  fetchAksesFlags,
  fetchKabupaten,
  fetchKecamatan,
  fetchKelurahan,
  resolveWilayahDefaults,
  PUSHABLE_STATUS,
  PUSH_PRIMARY_STATUS,
  PUSH_RETRY_STATUS,
} from "../utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeBase(url: string | undefined) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const session = await readServerSession().catch(() => null);
  if (!session) return unauthorized("Sesi tidak ditemukan");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  const ua = req.headers.get("user-agent") || undefined;

  try {
    const defaults = resolveWilayahDefaults(session);
    const akses = await fetchAksesFlags();

    const kabupaten = await fetchKabupaten(defaults.noProp);
    const kecamatan = await fetchKecamatan(defaults.noProp, defaults.noKab);
    const shouldLoadKel = defaults.noKec !== "000";
    const kelurahan = shouldLoadKel
      ? await fetchKelurahan(defaults.noProp, defaults.noKab, defaults.noKec)
      : [];

    const photoBase =
      normalizeBase(process.env.NEXT_PUBLIC_EKTP_PHOTO_BASE) ||
      normalizeBase(process.env.EKTP_PHOTO_BASE) ||
      null;

    const legacyPushBase =
      normalizeBase(process.env.NEXT_PUBLIC_KTPEL_PUSH_BASE) ||
      normalizeBase(process.env.KTPEL_PUSH_BASE) ||
      null;
    const legacyHistoryBase =
      normalizeBase(process.env.NEXT_PUBLIC_KTPEL_HISTORY_BASE) ||
      normalizeBase(process.env.KTPEL_HISTORY_BASE) ||
      null;

    const payload = {
      akses,
      defaults,
      wilayah: { kabupaten, kecamatan, kelurahan },
      statuses: {
        pushable: PUSHABLE_STATUS,
        pushPrimary: PUSH_PRIMARY_STATUS,
        pushRetry: PUSH_RETRY_STATUS,
      },
      photoBase,
      legacyPushBase,
      legacyHistoryBase,
    };

    await Log.info({
      scope: "API",
      msg: "KTP-el meta",
      at: "/api/check/ktpel/meta",
      tookMs: Date.now() - startedAt,
      user: session.S_USER_ID,
      ip,
      ua,
      extra: {
        kabupatenCount: kabupaten.length,
        kecamatanCount: kecamatan.length,
        kelurahanCount: kelurahan.length,
      },
    });

    return ok(payload, 60);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "KTP-el meta failed",
      at: "/api/check/ktpel/meta",
      tookMs: Date.now() - startedAt,
      user: session.S_USER_ID,
      ip,
      ua,
      err: {
        name: e?.name || "Error",
        message: e?.message || String(e),
        stack: e?.stack,
      },
    });
    return err("Gagal memuat metadata KTP-el", 500);
  }
}
