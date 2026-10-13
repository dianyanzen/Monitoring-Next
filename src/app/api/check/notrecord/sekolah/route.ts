// FILE: src/app/api/check/notrecord/sekolah/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ok, err, badRequest } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";

const ORACLE_ALIAS = process.env.DB_ALIAS_NOTRECORD ?? "DB";

export async function GET() {
  try {
    const s = await readServerSession();
    if (!s?.S_USER_ID) return badRequest("Sesi tidak valid.");

    // Ambil nama_sekolah saja (distinct + terurut)
    const sql = `
      SELECT DISTINCT TRIM(A.NAMA_SEKOLAH) AS NAMA_SEKOLAH
      FROM WKTP_BLM_REKAM_DAPODIK A
      WHERE A.NAMA_SEKOLAH IS NOT NULL AND A.KABUPATEN_SEKOLAH = 'KOTA BANDUNG'
      ORDER BY NAMA_SEKOLAH
    `;
    const rows = await execRows(sql, {}, {}, ORACLE_ALIAS);

    // Kembalikan sebagai array string agar simpel di sisi client
    const sekolah: string[] = rows
      .map((r: any) => r.NAMA_SEKOLAH)
      .filter((v: any) => !!v);

    return ok({ sekolah });
  } catch (e: any) {
    return err("Gagal memuat daftar sekolah", 500);
  }
}
