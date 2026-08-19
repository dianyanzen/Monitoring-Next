import type { NextRequest } from "next/server";
import { ok, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import { ESPASI_DB_ALIAS, ensureSession } from "@/lib/espasi/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const started = Date.now();
  const auth = await ensureSession();
  if (auth.error) return auth.error;

  try {
    const rows = await execRows(
      `
      SELECT
        LAYANAN,
        KODE_PELAYANAN,
        LOKASI,
        ACTIVE,
        KUOTA,
        KODE_LOKET,
        JAM_AWAL,
        JAM_AKHIR,
        WAKTU_LAYANAN
      FROM SMSDISDUK.DATA_LOKET@SMSDISDUK
      ORDER BY ACTIVE DESC, LOKASI, LAYANAN
      `,
      {},
      {},
      ESPASI_DB_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "espasi/pengaturan/loket",
      at: "/api/espasi/pengaturan/loket",
      user: auth.session?.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { rows: rows.length },
    });

    return ok(rows);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "espasi/pengaturan/loket/error",
      at: "/api/espasi/pengaturan/loket",
      user: auth.session?.S_USER_ID,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat konfigurasi loket", 500);
  }
}
