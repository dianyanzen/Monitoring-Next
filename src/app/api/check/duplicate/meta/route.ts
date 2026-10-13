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
} from "../utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeBase(url?: string | null) {
  const trimmed = (url ?? "").trim();
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

    const kecamatan = await fetchKecamatan(defaults.noProp, defaults.noKab);
    const shouldLoadKelurahan = defaults.noKec !== "000";
    const kelurahan = shouldLoadKelurahan
      ? await fetchKelurahan(defaults.noProp, defaults.noKab, defaults.noKec)
      : [];

    const kabupaten = await fetchKabupaten(defaults.noProp);

    const payload = {
      defaults,
      akses,
      wilayah: {
        kabupaten,
        kecamatan,
        kelurahan,
      },
      instructions: [
        "Isi NIK untuk mencari pasangan duplicate secara spesifik (boleh lebih dari satu dengan koma).",
        "Kosongkan NIK lalu pilih kecamatan / kelurahan dan rentang tanggal untuk menampilkan daftar duplicate per wilayah.",
        "Rentang tanggal mengikuti tanggal rekam (format DD-MM-YYYY).",
      ],
      exportBaseUrl: normalizeBase(process.env.KTPDUP_EXPORT_BASE || null),
    };

    await Log.info({
      scope: "API",
      msg: "Duplicate meta",
      at: "/api/check/duplicate/meta",
      tookMs: Date.now() - startedAt,
      user: session.S_USER_ID,
      ip,
      ua,
      extra: {
        kecamatan: kecamatan.length,
        kelurahan: kelurahan.length,
      },
    });

    return ok({ success: true, data: payload }, 60);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "Duplicate meta failed",
      at: "/api/check/duplicate/meta",
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
    return err("Gagal memuat metadata duplicate", 500);
  }
}
