import type { NextRequest } from "next/server";
import { ok, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import { ESPASI_DB_ALIAS, ensureSession, getLimit, getLokasi } from "@/lib/espasi/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusForMode(mode: string) {
  if (mode === "terlewat") return "LEWAT";
  if (mode === "sudah") return "SUDAH";
  return "BELUM";
}

export async function GET(req: NextRequest) {
  const started = Date.now();
  const auth = await ensureSession();
  if (auth.error) return auth.error;

  const mode = (req.nextUrl.searchParams.get("mode") ?? "aktif").trim().toLowerCase();
  const lokasi = getLokasi(req);
  const limit = getLimit(req, 100, 500);

  const status = statusForMode(mode);
  const binds: Record<string, unknown> = { b_status: status, b_limit: limit };

  let filterLokasi = "";
  if (lokasi) {
    filterLokasi = "AND UPPER(A.LOKASI) = :b_lokasi";
    binds.b_lokasi = lokasi;
  }

  try {
    const rows = await execRows(
      `
      SELECT * FROM (
        SELECT
          A.NIK,
          A.NAMA,
          A.TELEPON,
          A.KODE_PELAYANAN,
          A.URUTAN,
          A.STATUS_PELAYANAN,
          UPPER(A.LOKASI) AS LOKASI,
          TO_CHAR(A.TGL_PELAYANAN, 'DD-MM-YYYY HH24:MI:SS') AS TGL_PELAYANAN,
          TO_CHAR(A.JAM) AS JAM,
          A.HARI
        FROM SMSDISDUK.ANTRIAN@SMSDISDUK A
        WHERE UPPER(A.STATUS_PELAYANAN) = :b_status
        ${filterLokasi}
        ORDER BY A.TGL_PELAYANAN DESC, A.URUTAN ASC
      )
      WHERE ROWNUM <= :b_limit
      `,
      binds,
      {},
      ESPASI_DB_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "espasi/loket",
      at: "/api/espasi/loket",
      user: auth.session?.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { mode, status, lokasi: lokasi || "ALL", limit, rows: rows.length },
    });

    return ok({ mode, status, rows });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "espasi/loket/error",
      at: "/api/espasi/loket",
      user: auth.session?.S_USER_ID,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat data loket", 500);
  }
}
