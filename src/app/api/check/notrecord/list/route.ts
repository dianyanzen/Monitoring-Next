// FILE: src/app/api/check/notrecord/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { ok, err, badRequest } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

const ORACLE_ALIAS = process.env.DB_ALIAS_NOTRECORD ?? "DB";
const AT = "/api/check/notrecord/list";

function reqMeta(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined;
  const ua = req.headers.get("user-agent") || undefined;
  return { ip, ua };
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const { ip, ua } = reqMeta(req);

  try {
    const s = await readServerSession();
    if (!s?.S_USER_ID) {
      await Log.warn({
        scope: "API",
        msg: "CHECK.NOTRECORD.LIST UNAUTHORIZED",
        at: AT,
        ip,
        ua,
        tookMs: Date.now() - t0,
      });
      return badRequest("Sesi tidak valid.");
    }

    const body = await req.json().catch(() => ({}));
    const mode   = Number(body?.mode ?? 0);
    const status = Number(body?.status ?? 0);
    const nama_sekolah = String(body?.nama_sekolah ?? "").trim();
    const no_kec = Number(body?.no_kec ?? 0) || 0;
    const no_kel = Number(body?.no_kel ?? 0) || 0;

    if (![1,2,3].includes(mode)) {
      await Log.warn({
        scope: "API",
        msg: "CHECK.NOTRECORD.LIST BAD_REQUEST",
        at: AT,
        user: String(s.S_USER_ID),
        session: (s as any).S_SESSION_ID,
        ip, ua,
        tookMs: Date.now() - t0,
        extra: { mode, status },
      });
      return badRequest("Mode tidak dikenal.");
    }

    const binds: Record<string, any> = {};
    let SQL = "";
    if (mode === 1) {
      SQL = `
        SELECT
          TO_CHAR(A.NIK) AS NIK,
          A.NAMA_LGKP AS NAMA_LGKP,
          TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
          'WKTP DAPODIK' AS WKTP,
          A.UMUR_PILKADA_27NOV AS UMUR,
          A.ALAMAT, A.NO_RT, A.NO_RW,
          '-' AS KODE_POS,
          A.NO_PROP, A.NAMA_PROP, A.NO_KAB, A.NAMA_KAB,
          A.NO_KEC, A.NAMA_KEC, A.NO_KEL, A.NAMA_KEL,
          CASE
            WHEN B.CURRENT_STATUS_CODE IS NULL AND A.KETERANGAN = 0 THEN '-'
            WHEN B.CURRENT_STATUS_CODE IS NULL AND A.KETERANGAN = 1 THEN A.KETERANGAN_REKAM
            ELSE B.CURRENT_STATUS_CODE
          END AS CURRENT_STATUS_CODE,
          CASE
            WHEN B.NIK IS NULL AND A.KETERANGAN = 0 THEN 'BELUM REKAM'
            WHEN B.NIK IS NULL AND A.KETERANGAN = 1 THEN 'DATA INVALID'
            ELSE 'SUDAH REKAM'
          END AS KET_REKAM,
          A.NAMA_SEKOLAH,
          A.PROVINSI_SEKOLAH AS PROV_SEKOLAH,
          A.KABUPATEN_SEKOLAH AS KAB_SEKOLAH,
          COALESCE(TO_CHAR(B.CREATED,'YYYY-MM-DD'), '-') AS TGL_REKAM,
          COALESCE(TO_CHAR(B.CREATED_USERNAME), '-') AS PETUGAS_REKAM,
          A.EXCUSE
        FROM WKTP_BLM_REKAM_DAPODIK A
        LEFT JOIN DEMOGRAPHICS@DB5 B ON A.NIK = B.NIK
        WHERE 1=1
        ${status === 1 ? " AND B.NIK IS NULL" : status === 2 ? " AND B.NIK IS NOT NULL" : ""}
        ${nama_sekolah && nama_sekolah !== "0" ? " AND A.NAMA_SEKOLAH = :b_sekolah" : ""}
        ORDER BY A.NO_KEC, A.NO_KEL, A.NO_RW, A.NO_RT, A.NAMA_LGKP
      `;
      if (nama_sekolah && nama_sekolah !== "0") binds.b_sekolah = nama_sekolah;
    } else if (mode === 2) {
      SQL = `
        SELECT
          TO_CHAR(A.NIK) AS NIK,
          A.NAMA_LGKP AS NAMA_LGKP,
          TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
          'WKTP DAPODIK' AS WKTP,
          A.UMUR_PILKADA_27NOV AS UMUR,
          A.ALAMAT, A.NO_RT, A.NO_RW,
          '' AS KODE_POS,
          A.NO_PROP, A.NAMA_PROP, A.NO_KAB, A.NAMA_KAB,
          A.NO_KEC, A.NAMA_KEC, A.NO_KEL, A.NAMA_KEL,
          CASE
            WHEN B.CURRENT_STATUS_CODE IS NULL AND A.KETERANGAN = 0 THEN '-'
            WHEN B.CURRENT_STATUS_CODE IS NULL AND A.KETERANGAN = 1 THEN A.KETERANGAN_REKAM
            ELSE B.CURRENT_STATUS_CODE
          END AS CURRENT_STATUS_CODE,
          CASE
            WHEN B.NIK IS NULL AND A.KETERANGAN = 0 THEN 'BELUM REKAM'
            WHEN B.NIK IS NULL AND A.KETERANGAN = 1 THEN 'DATA INVALID'
            ELSE 'SUDAH REKAM'
          END AS KET_REKAM,
          A.NAMA_SEKOLAH,
          A.PROVINSI_SEKOLAH AS PROV_SEKOLAH,
          A.KABUPATEN_SEKOLAH AS KAB_SEKOLAH,
          COALESCE(TO_CHAR(B.CREATED,'YYYY-MM-DD'), '-') AS TGL_REKAM,
          COALESCE(TO_CHAR(B.CREATED_USERNAME), '-') AS PETUGAS_REKAM,
          A.EXCUSE
        FROM WKTP_BLM_REKAM_DAPODIK A
        LEFT JOIN DEMOGRAPHICS@DB5 B ON A.NIK = B.NIK
        WHERE 1=1
        ${status === 1 ? " AND B.NIK IS NULL" : status === 2 ? " AND B.NIK IS NOT NULL" : ""}
        ${no_kec ? " AND A.NO_KEC = :b_no_kec" : ""}
        ${no_kel ? " AND A.NO_KEL = :b_no_kel" : ""}
        ORDER BY A.NO_KEC, A.NO_KEL, A.NO_RW, A.NO_RT, A.NAMA_LGKP
      `;
      if (no_kec) binds.b_no_kec = no_kec;
      if (no_kel) binds.b_no_kel = no_kel;
    } else {
      SQL = `
        SELECT
          TO_CHAR(A.NIK) AS NIK,
          A.NAMA_LGKP AS NAMA_LGKP,
          'USIA ' || A.UMUR_PILKADA_27NOV || ' TAHUN' AS TGL_LHR,
          'WKTP NON DAPODIK' AS WKTP,
          A.UMUR_PILKADA_27NOV AS UMUR,
          A.ALAMAT, A.NO_RT, A.NO_RW,
          '-' AS KODE_POS,
          A.NO_PROP, A.NAMA_PROP, A.NO_KAB, A.NAMA_KAB,
          A.NO_KEC, A.NAMA_KEC, A.NO_KEL, A.NAMA_KEL,
          CASE
            WHEN B.CURRENT_STATUS_CODE IS NULL AND A.KETERANGAN = 0 THEN '-'
            WHEN B.CURRENT_STATUS_CODE IS NULL AND A.KETERANGAN = 1 THEN A.KETERANGAN_REKAM
            ELSE B.CURRENT_STATUS_CODE
          END AS CURRENT_STATUS_CODE,
          CASE
            WHEN B.NIK IS NULL AND A.KETERANGAN = 0 THEN 'BELUM REKAM'
            WHEN B.NIK IS NULL AND A.KETERANGAN = 1 THEN 'DATA INVALID'
            ELSE 'SUDAH REKAM'
          END AS KET_REKAM,
          '-' AS NAMA_SEKOLAH, '-' AS PROV_SEKOLAH, '-' AS KAB_SEKOLAH,
          COALESCE(TO_CHAR(B.CREATED,'YYYY-MM-DD'), '-') AS TGL_REKAM,
          COALESCE(TO_CHAR(B.CREATED_USERNAME), '-') AS PETUGAS_REKAM,
          A.EXCUSE
        FROM WKTP_BLM_REKAM_FULL A
        LEFT JOIN DEMOGRAPHICS@DB5 B ON A.NIK = B.NIK
        WHERE 1=1
          AND NOT EXISTS (SELECT 1 FROM WKTP_BLM_REKAM_DAPODIK C WHERE A.NIK = C.NIK)
        ${status === 1 ? " AND B.NIK IS NULL" : status === 2 ? " AND B.NIK IS NOT NULL" : ""}
        ${no_kec ? " AND A.NO_KEC = :b_no_kec" : ""}
        ${no_kel ? " AND A.NO_KEL = :b_no_kel" : ""}
        ORDER BY A.NO_KEC, A.NO_KEL, A.NO_RW, A.NO_RT, A.NAMA_LGKP
      `;
      if (no_kec) binds.b_no_kec = no_kec;
      if (no_kel) binds.b_no_kel = no_kel;
    }

    const rows = await execRows(SQL, binds, {}, ORACLE_ALIAS);

    await Log.info({
      scope: "API",
      msg: "CHECK.NOTRECORD.LIST OK",
      at: AT,
      user: String(s.S_USER_ID),
      session: (s as any).S_SESSION_ID,
      ip, ua,
      tookMs: Date.now() - t0,
      extra: {
        mode, status, nama_sekolah: nama_sekolah || undefined,
        no_kec: no_kec || undefined, no_kel: no_kel || undefined,
        total: rows.length
      }
      // (sengaja tidak kirim SQL di success agar log ringkas)
    });

    return ok({ rows, total: rows.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "CHECK.NOTRECORD.LIST ERROR",
      at: AT,
      ip, ua,
      tookMs: Date.now() - t0,
      err: { name: e?.name || "Error", message: e?.message || String(e), stack: e?.stack },
    });
    return err("Gagal memuat data", 500);
  }
}
