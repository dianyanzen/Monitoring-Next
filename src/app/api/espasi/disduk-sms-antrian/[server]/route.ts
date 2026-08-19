import type { NextRequest } from "next/server";
import { ok, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { ensureSession, ESPASI_DB_ALIAS } from "@/lib/espasi/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ server: string }> }) {
  const auth = await ensureSession();
  if (auth.error) return auth.error;

  const params = await ctx.params;
  const server = String(params?.server || "").trim();
  if (!/^[1-4]$/.test(server)) {
    return err("Server modem tidak valid. Gunakan 1, 2, 3, atau 4.", 400);
  }

  try {
    const rows = await execRows(
      `
      SELECT * FROM (
        SELECT 'by-me' AS JENIS,
               TO_CHAR(TANGGAL_SMS,'YYYYMMDDHH24MISS') AS WAKTU,
               TO_CHAR(TANGGAL_SMS,'DD-MM-YYYY HH24:MI:SS') AS TANGGAL,
               A.TELEPON,
               A.ISI_PESAN,
               A.SERVER
        FROM SMSDISDUK.OUTBOX@SMSDISDUK A
        WHERE TO_CHAR(TANGGAL_SMS,'YYYYMMDD') >= TO_CHAR(SYSDATE,'YYYYMMDD') - 2
          AND A.SERVER = :b_server
        UNION ALL
        SELECT 'by-other' AS JENIS,
               TO_CHAR(TANGGAL_SMS,'YYYYMMDDHH24MISS') AS WAKTU,
               TO_CHAR(TANGGAL_SMS,'DD-MM-YYYY HH24:MI:SS') AS TANGGAL,
               B.TELEPON,
               B.ISI_PESAN,
               B.SERVER
        FROM SMSDISDUK.INBOX_LOG@SMSDISDUK B
        WHERE TO_CHAR(TANGGAL_SMS,'YYYYMMDD') >= TO_CHAR(SYSDATE,'YYYYMMDD') - 2
          AND B.SERVER = :b_server
      )
      ORDER BY WAKTU DESC
      `,
      { b_server: Number(server) },
      {},
      ESPASI_DB_ALIAS
    );

    return ok({
      server,
      sourceUrl: "local-db://SMSDISDUK.OUTBOX+INBOX_LOG",
      rows,
    });
  } catch (e: any) {
    return err(e?.message || "Gagal mengambil data dashboard-sms dari database lokal.", 500);
  }
}
