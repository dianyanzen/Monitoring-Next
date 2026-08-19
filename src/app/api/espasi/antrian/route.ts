import type { NextRequest } from "next/server";
import { ok, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import { ESPASI_DB_ALIAS, ensureSession, getLimit, getQ, requireMode } from "@/lib/espasi/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = ["aktif", "log", "masuk", "keluar", "telepon"];

export async function GET(req: NextRequest) {
  const started = Date.now();
  const auth = await ensureSession();
  if (auth.error) return auth.error;

  const mode = (req.nextUrl.searchParams.get("mode") ?? "aktif").trim().toLowerCase();
  const invalid = requireMode(mode, ALLOWED);
  if (invalid) return invalid;

  const q = getQ(req);
  const limit = getLimit(req, 100, 500);

  try {
    let sql = "";
    const binds: Record<string, unknown> = { b_limit: limit };

    if (mode === "aktif") {
      sql = `
        SELECT * FROM (
          SELECT
            NIK,
            NAMA,
            TELEPON,
            KODE_PELAYANAN,
            URUTAN,
            STATUS_PELAYANAN,
            UPPER(LOKASI) AS LOKASI,
            TO_CHAR(TGL_PELAYANAN, 'DD-MM-YYYY HH24:MI:SS') AS TGL_PELAYANAN,
            TO_CHAR(JAM) AS JAM,
            HARI
          FROM SMSDISDUK.ANTRIAN@SMSDISDUK
          WHERE UPPER(STATUS_PELAYANAN) = 'BELUM'
          ORDER BY TGL_PELAYANAN DESC, URUTAN ASC
        ) WHERE ROWNUM <= :b_limit
      `;
    } else if (mode === "log") {
      sql = `
        SELECT * FROM (
          SELECT
            TELEPON,
            ISI_PESAN,
            TO_CHAR(TANGGAL_SMS, 'DD-MM-YYYY HH24:MI:SS') AS TANGGAL_SMS,
            SERVER,
            'INBOX_LOG' AS SOURCE_TABLE
          FROM SMSDISDUK.INBOX_LOG@SMSDISDUK
          UNION ALL
          SELECT
            TELEPON,
            ISI_PESAN,
            TO_CHAR(TANGGAL_SMS, 'DD-MM-YYYY HH24:MI:SS') AS TANGGAL_SMS,
            SERVER,
            'OUTBOX' AS SOURCE_TABLE
          FROM SMSDISDUK.OUTBOX@SMSDISDUK
          ORDER BY TANGGAL_SMS DESC
        ) WHERE ROWNUM <= :b_limit
      `;
    } else if (mode === "masuk") {
      sql = `
        SELECT * FROM (
          SELECT
            TELEPON,
            ISI_PESAN,
            TO_CHAR(TANGGAL_SMS, 'DD-MM-YYYY HH24:MI:SS') AS TANGGAL_SMS,
            SERVER
          FROM SMSDISDUK.INBOX_LOG@SMSDISDUK
          ORDER BY TANGGAL_SMS DESC
        ) WHERE ROWNUM <= :b_limit
      `;
    } else if (mode === "keluar") {
      sql = `
        SELECT * FROM (
          SELECT
            TELEPON,
            ISI_PESAN,
            TO_CHAR(TANGGAL_SMS, 'DD-MM-YYYY HH24:MI:SS') AS TANGGAL_SMS,
            SERVER
          FROM SMSDISDUK.OUTBOX@SMSDISDUK
          ORDER BY TANGGAL_SMS DESC
        ) WHERE ROWNUM <= :b_limit
      `;
    } else {
      sql = `
        SELECT * FROM (
          SELECT
            TELEPON,
            JUMLAH_SMS,
            TO_CHAR(TANGGAL_BLOKIR, 'DD-MM-YYYY HH24:MI:SS') AS TANGGAL_BLOKIR
          FROM SMSDISDUK.KONTAK@SMSDISDUK
          ORDER BY JUMLAH_SMS DESC, TELEPON
        ) WHERE ROWNUM <= :b_limit
      `;
    }

    if (q) {
      binds.b_q = `%${q}%`;
      if (mode === "telepon") {
        sql = `SELECT * FROM (${sql.replace("WHERE ROWNUM <= :b_limit", "")}) WHERE UPPER(TELEPON) LIKE :b_q AND ROWNUM <= :b_limit`;
      } else {
        sql = `SELECT * FROM (${sql.replace("WHERE ROWNUM <= :b_limit", "")}) WHERE (UPPER(TELEPON) LIKE :b_q OR UPPER(ISI_PESAN) LIKE :b_q) AND ROWNUM <= :b_limit`;
      }
    }

    const rows = await execRows(sql, binds, {}, ESPASI_DB_ALIAS);

    await Log.info({
      scope: "API",
      msg: "espasi/antrian",
      at: "/api/espasi/antrian",
      user: auth.session?.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { mode, q, limit, rows: rows.length },
    });

    return ok({ mode, rows });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "espasi/antrian/error",
      at: "/api/espasi/antrian",
      user: auth.session?.S_USER_ID,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat data antrian", 500);
  }
}
