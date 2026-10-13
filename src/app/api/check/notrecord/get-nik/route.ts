// FILE: src/app/api/check/notrecord/get-nik/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { ok, err, badRequest } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";

const ORACLE_ALIAS = process.env.DB_ALIAS_NOTRECORD ?? "DB";

export async function POST(req: NextRequest) {
  try {
    const s = await readServerSession();
    if (!s?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const { nik } = await req.json().catch(() => ({}));
    if (!nik || String(nik).length !== 16) return badRequest("NIK 16 digit wajib.");
    const binds = { b_nik: String(nik) };

    // Ada di target (FULL/DAPODIK)?
    const qTarget = `
      SELECT NIK, NAMA_LGKP AS NAMA
      FROM (
        SELECT NIK, NAMA_LGKP FROM WKTP_BLM_REKAM_FULL WHERE NIK = :b_nik
        UNION ALL
        SELECT NIK, NAMA_LGKP FROM WKTP_BLM_REKAM_DAPODIK WHERE NIK = :b_nik
      ) WHERE ROWNUM = 1`;
    const targ = await execRows(qTarget, binds, {}, ORACLE_ALIAS);

    // Pernah tercatat di laporan balikan?
    const qLog = `SELECT 1 FROM YZ_NOTRECORD_EXCUSE WHERE NIK = :b_nik FETCH FIRST 1 ROWS ONLY`;
    const log = await execRows(qLog, binds, {}, ORACLE_ALIAS);

    let is_exists = 0;
    let nama = "-";
    if (targ?.length) {
      nama = targ[0].NAMA ?? "-";
      is_exists = log?.length ? 2 : 1;
    }
    return ok({ is_exists, nama });
  } catch (e: any) {
    return err("Gagal mengecek NIK", 500);
  }
}
