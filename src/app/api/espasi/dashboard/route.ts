import type { NextRequest } from "next/server";
import { ok, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import { ESPASI_DB_ALIAS, ensureSession } from "@/lib/espasi/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const started = Date.now();
  const auth = await ensureSession();
  if (auth.error) return auth.error;

  const lokasi = (req.nextUrl.searchParams.get("lokasi") ?? "").trim().toUpperCase();

  const binds: Record<string, unknown> = {};
  const whereLokasi = lokasi ? "AND UPPER(LOKASI) = :b_lokasi" : "";
  if (lokasi) binds.b_lokasi = lokasi;

  try {
    const byLokasi = await execRows(
      `
      SELECT
        UPPER(LOKASI) AS LOKASI,
        COUNT(*) AS TOTAL,
        SUM(CASE WHEN UPPER(STATUS_PELAYANAN) = 'BELUM' THEN 1 ELSE 0 END) AS BELUM,
        SUM(CASE WHEN UPPER(STATUS_PELAYANAN) = 'SUDAH' THEN 1 ELSE 0 END) AS SUDAH,
        SUM(CASE WHEN UPPER(STATUS_PELAYANAN) = 'LEWAT' THEN 1 ELSE 0 END) AS LEWAT
      FROM SMSDISDUK.ANTRIAN@SMSDISDUK
      WHERE 1=1
      ${whereLokasi}
      GROUP BY UPPER(LOKASI)
      ORDER BY LOKASI
      `,
      binds,
      {},
      ESPASI_DB_ALIAS
    );

    const latestQueue = await execRows(
      `
      SELECT * FROM (
        SELECT
          UPPER(LOKASI) AS LOKASI,
          URUTAN,
          KODE_PELAYANAN,
          STATUS_PELAYANAN,
          TO_CHAR(TGL_PELAYANAN, 'DD-MM-YYYY HH24:MI:SS') AS TGL_PELAYANAN,
          ROW_NUMBER() OVER (PARTITION BY UPPER(LOKASI) ORDER BY TGL_PELAYANAN DESC) AS RN
        FROM SMSDISDUK.ANTRIAN@SMSDISDUK
        WHERE 1=1
        ${whereLokasi}
      )
      WHERE RN = 1
      ORDER BY LOKASI
      `,
      binds,
      {},
      ESPASI_DB_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "espasi/dashboard",
      at: "/api/espasi/dashboard",
      user: auth.session?.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { lokasi: lokasi || "ALL", rows: byLokasi.length },
    });

    return ok({ byLokasi, latestQueue });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "espasi/dashboard/error",
      at: "/api/espasi/dashboard",
      user: auth.session?.S_USER_ID,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat dashboard espasi", 500);
  }
}
