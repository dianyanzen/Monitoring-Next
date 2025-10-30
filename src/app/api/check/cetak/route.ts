// FILE: src/app/api/check/cetak/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { ok, err, badRequest } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import { readServerSession } from "@/lib/session";

const ORACLE_ALIAS = process.env.DB_ALIAS_CETAK ?? process.env.DB_ALIAS_PRR ?? "DB5CETAK";

/** keep only primitive for response safety */
function toPlain(obj: any) {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map((x) => toPlain(x));
  if (typeof obj === "object") {
    const p: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) p[k] = v;
      else if (["string", "number", "boolean"].includes(typeof v)) p[k] = v;
    }
    return p;
  }
  return obj;
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const s = await readServerSession();
    if (!s?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const body = await req.json().catch(() => ({} as any));

    const no_kec = Number(body?.no_kec ?? 0) || 0;
    const no_kel = Number(body?.no_kel ?? 0) || 0;
    const user   = String(body?.user ?? "").trim();
    const tgl_start = String(body?.tgl_start ?? "").trim(); // "DD-MM-YYYY"
    const tgl_end   = String(body?.tgl_end   ?? "").trim(); // "DD-MM-YYYY"

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const fallback = `${dd}-${mm}-${yyyy}`;

    const start = tgl_start || fallback;
    const end = tgl_end || start;

    const where: string[] = [
      "1=1",
      "D.USER_BCARD IS NULL",
      "(B.TGL_LHR <= ADD_MONTHS(SYSDATE, -12*17) OR B.STAT_KWN <> 'BELUM KAWIN')",
      "CASE WHEN A.LAST_UPDATE IS NULL THEN A.PERSONALIZED_DATE ELSE A.LAST_UPDATE END >= TO_DATE(:b_tgl_start,'DD-MM-YYYY')",
      "CASE WHEN A.LAST_UPDATE IS NULL THEN A.PERSONALIZED_DATE ELSE A.LAST_UPDATE END <  TO_DATE(:b_tgl_end,'DD-MM-YYYY') + 1",
    ];
    const binds: Record<string, any> = {
      b_tgl_start: start,
      b_tgl_end: end,
    };

    if (no_kec) { where.push("B.NO_KEC = :b_no_kec"); binds.b_no_kec = no_kec; }
    if (no_kel) { where.push("B.NO_KEL = :b_no_kel"); binds.b_no_kel = no_kel; }
    if (user) {
      // CASE user cetak (LAST_UPDATED_USERNAME / CREATED_USERNAME)
      where.push(`
        CASE 
          WHEN A.LAST_UPDATED_USERNAME IS NULL AND A.CREATED_USERNAME IS NULL THEN '-' 
          WHEN A.LAST_UPDATED_USERNAME IS NULL AND A.CREATED_USERNAME IS NOT NULL THEN A.CREATED_USERNAME 
          ELSE A.LAST_UPDATED_USERNAME 
        END = :b_user
      `);
      binds.b_user = user;
    }

    const SQL = `
      SELECT
        TO_CHAR(B.NIK) AS NIK
        , B.NAMA_LGKP
        , B.TMPT_LHR
        , TO_CHAR(B.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR
        , CASE WHEN B.ALAMAT IS NULL THEN '-' ELSE B.ALAMAT END AS ALAMAT
        , B.NO_KEC, B.NAMA_KEC
        , B.NO_KEL, B.NAMA_KEL
        , CASE WHEN B.NO_RW IS NULL THEN 0 ELSE B.NO_RW END AS NO_RW
        , CASE WHEN B.NO_RT IS NULL THEN 0 ELSE B.NO_RT END AS NO_RT
        , CASE WHEN TO_CHAR(B.KODE_POS) IS NULL THEN '-' ELSE TO_CHAR(B.KODE_POS) END AS KODE_POS
        , B.AGAMA
        , B.STAT_KWN AS STATUS_KAWIN
        , B.JENIS_PKRJN AS PEKERJAAN
        , TO_CHAR(A.PERSONALIZED_DATE,'DD-MM-YYYY') AS TGL_CETAK
        , CASE 
            WHEN TO_CHAR(H.REQ_DATE,'DD-MM-YYYY') IS NULL AND TO_CHAR(I.REQ_DATE,'DD-MM-YYYY') IS NOT NULL THEN TO_CHAR(I.REQ_DATE,'DD-MM-YYYY')
            WHEN TO_CHAR(H.REQ_DATE,'DD-MM-YYYY') IS NULL AND TO_CHAR(I.REQ_DATE,'DD-MM-YYYY') IS NULL THEN '-' 
            ELSE TO_CHAR(H.REQ_DATE,'DD-MM-YYYY') 
          END AS REQ_DATE
        , CASE 
            WHEN H.REQ_BY IS NULL AND I.REQ_BY IS NOT NULL THEN I.REQ_BY
            WHEN I.REQ_BY IS NULL AND H.REQ_BY IS NULL THEN '-' 
            ELSE H.REQ_BY 
          END AS REQ_BY
        , CASE 
            WHEN H.ALASAN_PENGAJUAN IS NULL AND I.NIK IS NOT NULL THEN 'PINDAHAN'
            WHEN H.ALASAN_PENGAJUAN IS NULL AND I.NIK IS NULL THEN '-' 
            ELSE H.ALASAN_PENGAJUAN 
          END AS PROC_BY
        , CASE 
            WHEN H.STEP_PROC IS NULL AND I.STEP_PROC IS NOT NULL AND I.STEP_PROC = 'A' THEN 'Masih Dalam Proses'
            WHEN H.STEP_PROC IS NULL AND I.STEP_PROC IS NOT NULL AND I.STEP_PROC = 'C' THEN 'Sudah Tercetak'
            WHEN H.STEP_PROC IS NULL AND I.STEP_PROC IS NOT NULL AND I.STEP_PROC = 'T' THEN 'Pengajuan Ditolak'
            WHEN H.STEP_PROC IS NULL AND I.STEP_PROC IS NOT NULL THEN 'Lainnya'
            WHEN H.STEP_PROC IS NULL AND I.STEP_PROC IS NULL THEN '-'
            WHEN H.STEP_PROC = 'T' THEN 'Pengajuan Ditolak'
            WHEN H.STEP_PROC = 'A' THEN 'Masih Dalam Proses'
            WHEN H.STEP_PROC = 'C' THEN 'Sudah Tercetak'
            ELSE H.STEP_PROC
          END AS STEP_PROC
        , CASE 
            WHEN F.DIS_DT IS NULL THEN TO_CHAR(H.DIS_DT,'DD-MM-YYYY')
            WHEN H.DIS_DT > F.DIS_DT THEN TO_CHAR(H.DIS_DT,'DD-MM-YYYY')
            ELSE TO_CHAR(F.DIS_DT,'DD-MM-YYYY')
          END AS DIS_DT
        , CASE 
            WHEN F.DIS_BY IS NULL THEN H.DIS_BY
            WHEN H.DIS_DT > F.DIS_DT THEN H.DIS_BY
            ELSE F.DIS_BY
          END AS DIS_BY
        , CASE 
            WHEN TO_CHAR(A.LAST_UPDATED_USERNAME) IS NULL AND TO_CHAR(A.CREATED_USERNAME) IS NULL THEN '-'
            WHEN TO_CHAR(A.LAST_UPDATED_USERNAME) IS NULL AND TO_CHAR(A.CREATED_USERNAME) IS NOT NULL THEN TO_CHAR(A.CREATED_USERNAME)
            ELSE TO_CHAR(A.LAST_UPDATED_USERNAME)
          END AS PETUGAS_CETAK
      FROM CARD_MANAGEMENT A
      INNER JOIN DEMOGRAPHICS B ON A.NIK = B.NIK
      LEFT JOIN SIAK_CETAK_GOIB@YZDB D ON 
        CASE WHEN UPPER(A.LAST_UPDATED_USERNAME) IS NULL THEN UPPER(A.CREATED_USERNAME) ELSE UPPER(A.LAST_UPDATED_USERNAME) END = UPPER(D.USER_BCARD)
        AND D.IS_ACTIVE = 1
      LEFT JOIN (
        SELECT NIK, DIS_BY, DIS_DT FROM (
          SELECT NIK, REQ_BY DIS_BY, TGL_CETAK DIS_DT, RANK() OVER (PARTITION BY NIK ORDER BY TGL_CETAK DESC, NO DESC) RNK 
          FROM SIAK_CETAK_DINAS@YZDB
        ) WHERE RNK = 1
      ) F ON A.NIK = F.NIK
      LEFT JOIN (
        SELECT NIK,PERSONALIZED_DATE,CREATED_USERNAME,LAST_UPDATED_USERNAME,LAST_UPDATE,CREATED FROM (
          SELECT NIK,PERSONALIZED_DATE,CREATED_USERNAME,LAST_UPDATED_USERNAME,LAST_UPDATE,CREATED,
                 RANK() OVER (PARTITION BY NIK ORDER BY PERSONALIZED_DATE DESC, LAST_UPDATE DESC, CHIP_ID DESC) RNK
          FROM CARD_MANAGEMENT
        ) WHERE RNK = 1
      ) G ON G.NIK = A.NIK
      LEFT JOIN (
        SELECT NIK,REQ_DATE,REQ_BY,PROC_DATE,PROC_BY,STEP_PROC,ALASAN_PENGAJUAN,DIS_BY,DIS_DT FROM (
          SELECT NIK,REQ_DATE,REQ_BY,PROC_DATE,PROC_BY,STEP_PROC,ALASAN_PENGAJUAN,DIS_BY,DIS_DT,
                 RANK() OVER (PARTITION BY NIK ORDER BY REQ_DATE DESC, ID_CETAK DESC) RNK
          FROM SIAK_REQ_CETAK_KTP@YZDB
        ) WHERE RNK = 1
      ) H ON H.NIK = A.NIK
      LEFT JOIN (
        SELECT NIK,REQ_DATE,REQ_BY,PROC_DATE,PROC_BY,STEP_PROC,DIS_BY,DIS_DT FROM (
          SELECT NIK,REQ_DATE,REQ_BY,PROC_DATE,PROC_BY,STEP_PROC,DIS_BY,DIS_DT,
                 RANK() OVER (PARTITION BY NIK ORDER BY REQ_DATE DESC, ID_CETAK DESC) RNK
          FROM SIAK_REQ_CETAK_KTPLD@YZDB
        ) WHERE RNK = 1
      ) I ON I.NIK = A.NIK
      WHERE ${where.join(" AND ")}
      ORDER BY A.PERSONALIZED_DATE DESC, B.NO_KEL, B.NO_RW, B.NO_RT
    `;

    const raw = await execRows(SQL, binds, {}, ORACLE_ALIAS);
    const rows = Array.isArray(raw) ? toPlain(raw) : [];

    await Log.info({
      scope: "API",
      msg: "cetak served",
      at: "/api/check/cetak",
      tookMs: Date.now() - t0,
      extra: {
        total: rows.length,
        no_kec, no_kel,
        used_user: !!user,
        start, end,
      },
    });

    return ok({ rows, total: rows.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "cetak error",
      at: "/api/check/cetak",
      tookMs: Date.now() - t0,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat data", 500);
  }
}
