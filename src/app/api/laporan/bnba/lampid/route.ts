// FILE: src/app/api/laporan/bnba/lampid/route.ts

import type { NextRequest } from "next/server";
import { ok, badRequest, err, unauthorized } from "@/lib/http";
import { readServerSession } from "@/lib/session";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/laporan/bnba/lampid";
const ORACLE_ALIAS = process.env.DB_ALIAS_LAPORAN_BNBA ?? "DB";

type Payload = { startDate?: string; endDate?: string; noKec?: string | number | null; noKel?: string | number | null };

type Row = {
  noWil: number;
  namaWil: string;
  jmlLahir: number;
  jmlMati: number;
  jmlPindah: number;
  jmlDatang: number;
};

type ResponseBody = {
  meta: {
    title: string;
    subTitle: string;
    typeTgl: "Tanggal";
    startDate: string;
    endDate: string;
    labelTanggal: string;
    filter: { noKec: number; noKel: number };
    total: number;
  };
  rows: Row[];
};

const normalizeDigits = (v?: string | number | null) => {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\D/g, "");
};

const toIntOrZero = (v?: string | number | null) => {
  const clean = normalizeDigits(v);
  if (!clean) return 0;
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
};

const isValidDDMMYYYY = (d?: string | null): d is string => {
  if (!d) return false;
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(d);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
};

const todayDDMMYYYY = () => {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const session = await readServerSession();
  if (!session?.S_USER_ID) return unauthorized("Sesi tidak ditemukan");

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return badRequest("Payload harus berupa JSON");
  }

  const startDate = payload.startDate && isValidDDMMYYYY(payload.startDate) ? payload.startDate : todayDDMMYYYY();
  const endDate = payload.endDate && isValidDDMMYYYY(payload.endDate) ? payload.endDate : todayDDMMYYYY();
  const noKec = toIntOrZero(payload.noKec);
  const noKel = toIntOrZero(payload.noKel);
  const labelTanggal = `${startDate} s.d ${endDate}`;

  const binds: Record<string, unknown> = {
    b_start_date: startDate,
    b_end_date: endDate,
  };

  const kelFilter = noKel > 0 ? `AND X.NO_KEL = :b_no_kel` : "";
  if (noKel > 0) binds.b_no_kel = noKel;

  let sql: string;
  if (noKec > 0) {
    binds.b_no_kec = noKec;
    sql = `
      WITH GEOM AS (
        SELECT X.NO_KEC, X.NO_KEL, X.NAMA_KEL
        FROM SETUP_KEL X
        WHERE X.NO_PROP = 32 AND X.NO_KAB = 73 AND X.NO_KEC = :b_no_kec
        ${kelFilter}
      ),
      LAHIR AS (
        SELECT ADM_NO_KEC NO_KEC, ADM_NO_KEL NO_KEL, COUNT(1) JML
        FROM SIAK_BNBA_AKTA_LAHIR
        WHERE ADM_NO_KEC IS NOT NULL
          AND ADM_AKTA_TGL >= TO_DATE(:b_start_date,'DD-MM-YYYY')
          AND ADM_AKTA_TGL < TO_DATE(:b_end_date,'DD-MM-YYYY') + 1
        GROUP BY ADM_NO_KEC, ADM_NO_KEL
      ),
      MATI AS (
        SELECT ADM_NO_KEC NO_KEC, ADM_NO_KEL NO_KEL, COUNT(1) JML
        FROM SIAK_BNBA_AKTA_MATI
        WHERE ADM_NO_KEC IS NOT NULL
          AND ADM_AKTA_TGL >= TO_DATE(:b_start_date,'DD-MM-YYYY')
          AND ADM_AKTA_TGL < TO_DATE(:b_end_date,'DD-MM-YYYY') + 1
        GROUP BY ADM_NO_KEC, ADM_NO_KEL
      ),
      PINDAH AS (
        SELECT NO_KEC_ASAL NO_KEC, NO_KEL_ASAL NO_KEL, COUNT(1) JML
        FROM SIAK_BNBA_PINDAH
        WHERE NO_KEC_ASAL IS NOT NULL
          AND KLASIFIKASI_PINDAH IN ('(3) ANTAR KECAMATAN','(4) ANTAR KAB/KOTA','(5) ANTAR PROVINSI')
          AND TGL_PINDAH >= TO_DATE(:b_start_date,'DD-MM-YYYY')
          AND TGL_PINDAH < TO_DATE(:b_end_date,'DD-MM-YYYY') + 1
        GROUP BY NO_KEC_ASAL, NO_KEL_ASAL
      ),
      DATANG AS (
        SELECT NO_KEC_TUJUAN NO_KEC, NO_KEL_TUJUAN NO_KEL, COUNT(1) JML
        FROM SIAK_BNBA_DATANG
        WHERE NO_KEC_TUJUAN IS NOT NULL
          AND KLASIFIKASI_PINDAH IN ('(3) ANTAR KECAMATAN','(4) ANTAR KAB/KOTA','(5) ANTAR PROVINSI')
          AND TGL_DATANG >= TO_DATE(:b_start_date,'DD-MM-YYYY')
          AND TGL_DATANG < TO_DATE(:b_end_date,'DD-MM-YYYY') + 1
        GROUP BY NO_KEC_TUJUAN, NO_KEL_TUJUAN
      )
      SELECT
        A.NO_KEL AS NO_WIL,
        A.NAMA_KEL AS NAMA_WIL,
        NVL(B.JML,0) AS JML_LAHIR,
        NVL(C.JML,0) AS JML_MATI,
        NVL(D.JML,0) AS JML_PINDAH,
        NVL(E.JML,0) AS JML_DATANG
      FROM GEOM A
      LEFT JOIN LAHIR B ON A.NO_KEC = B.NO_KEC AND A.NO_KEL = B.NO_KEL
      LEFT JOIN MATI C ON A.NO_KEC = C.NO_KEC AND A.NO_KEL = C.NO_KEL
      LEFT JOIN PINDAH D ON A.NO_KEC = D.NO_KEC AND A.NO_KEL = D.NO_KEL
      LEFT JOIN DATANG E ON A.NO_KEC = E.NO_KEC AND A.NO_KEL = E.NO_KEL
      ORDER BY A.NO_KEL
    `;
  } else {
    sql = `
      WITH GEOM AS (
        SELECT NO_KEC, NAMA_KEC FROM SETUP_KEC WHERE NO_PROP = 32 AND NO_KAB = 73
      ),
      LAHIR AS (
        SELECT ADM_NO_KEC NO_KEC, COUNT(1) JML
        FROM SIAK_BNBA_AKTA_LAHIR
        WHERE ADM_NO_KEC IS NOT NULL
          AND ADM_AKTA_TGL >= TO_DATE(:b_start_date,'DD-MM-YYYY')
          AND ADM_AKTA_TGL < TO_DATE(:b_end_date,'DD-MM-YYYY') + 1
        GROUP BY ADM_NO_KEC
      ),
      MATI AS (
        SELECT ADM_NO_KEC NO_KEC, COUNT(1) JML
        FROM SIAK_BNBA_AKTA_MATI
        WHERE ADM_NO_KEC IS NOT NULL
          AND ADM_AKTA_TGL >= TO_DATE(:b_start_date,'DD-MM-YYYY')
          AND ADM_AKTA_TGL < TO_DATE(:b_end_date,'DD-MM-YYYY') + 1
        GROUP BY ADM_NO_KEC
      ),
      PINDAH AS (
        SELECT NO_KEC_ASAL NO_KEC, COUNT(1) JML
        FROM SIAK_BNBA_PINDAH
        WHERE NO_KEC_ASAL IS NOT NULL
          AND KLASIFIKASI_PINDAH IN ('(3) ANTAR KECAMATAN','(4) ANTAR KAB/KOTA','(5) ANTAR PROVINSI')
          AND TGL_PINDAH >= TO_DATE(:b_start_date,'DD-MM-YYYY')
          AND TGL_PINDAH < TO_DATE(:b_end_date,'DD-MM-YYYY') + 1
        GROUP BY NO_KEC_ASAL
      ),
      DATANG AS (
        SELECT NO_KEC_TUJUAN NO_KEC, COUNT(1) JML
        FROM SIAK_BNBA_DATANG
        WHERE NO_KEC_TUJUAN IS NOT NULL
          AND KLASIFIKASI_PINDAH IN ('(3) ANTAR KECAMATAN','(4) ANTAR KAB/KOTA','(5) ANTAR PROVINSI')
          AND TGL_DATANG >= TO_DATE(:b_start_date,'DD-MM-YYYY')
          AND TGL_DATANG < TO_DATE(:b_end_date,'DD-MM-YYYY') + 1
        GROUP BY NO_KEC_TUJUAN
      )
      SELECT
        A.NO_KEC AS NO_WIL,
        A.NAMA_KEC AS NAMA_WIL,
        NVL(B.JML,0) AS JML_LAHIR,
        NVL(C.JML,0) AS JML_MATI,
        NVL(D.JML,0) AS JML_PINDAH,
        NVL(E.JML,0) AS JML_DATANG
      FROM GEOM A
      LEFT JOIN LAHIR B ON A.NO_KEC = B.NO_KEC
      LEFT JOIN MATI C ON A.NO_KEC = C.NO_KEC
      LEFT JOIN PINDAH D ON A.NO_KEC = D.NO_KEC
      LEFT JOIN DATANG E ON A.NO_KEC = E.NO_KEC
      ORDER BY A.NO_KEC
    `;
  }

  try {
    const rows = await execRows(sql, binds, {}, ORACLE_ALIAS);
    const mapped: Row[] = rows.map((r: any) => ({
      noWil: Number(r.NO_WIL ?? 0),
      namaWil: r.NAMA_WIL ?? "",
      jmlLahir: Number(r.JML_LAHIR ?? 0),
      jmlMati: Number(r.JML_MATI ?? 0),
      jmlPindah: Number(r.JML_PINDAH ?? 0),
      jmlDatang: Number(r.JML_DATANG ?? 0),
    }));

    const total = mapped.reduce((sum, r) => sum + (r.jmlLahir + r.jmlMati + r.jmlPindah + r.jmlDatang), 0);

    const response: ResponseBody = {
      meta: {
        title: "Laporan Lampid",
        subTitle: `Rekap BNBA Lampid Tanggal ${labelTanggal}`,
        typeTgl: "Tanggal",
        startDate,
        endDate,
        labelTanggal,
        filter: { noKec, noKel },
        total,
      },
      rows: mapped,
    };

    await Log.info({
      scope: "API",
      msg: "LAPORAN.BNBA.LAMPID",
      at: AT,
      user: session.S_USER_ID,
      tookMs: Date.now() - startedAt,
      extra: { startDate, endDate, noKec, noKel, rowCount: mapped.length },
    });

    return ok(response);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "LAPORAN.BNBA.LAMPID FAILED",
      at: AT,
      user: session.S_USER_ID,
      tookMs: Date.now() - startedAt,
      err: {
        name: e?.name || "Error",
        message: e?.message || String(e),
        stack: e?.stack,
      },
      extra: { startDate, endDate, noKec, noKel },
    });
    return err("Gagal mengambil data laporan lampid");
  }
}
