// FILE: src/app/api/laporan/bnba/kematian/route.ts

import type { NextRequest } from "next/server";
import { ok, badRequest, err, unauthorized } from "@/lib/http";
import { readServerSession } from "@/lib/session";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/laporan/bnba/kematian";
const ORACLE_ALIAS = process.env.DB_ALIAS_LAPORAN_BNBA ?? "DB";

type Payload = {
  startDate?: string;
  endDate?: string;
  noKec?: string | number | null;
  noKel?: string | number | null;
  nik?: string;
  noAkta?: string;
};

type Row = {
  nik: string | null;
  nama: string | null;
  noAkta: string | null;
  tglAkta: string | null;
  tglMati: string | null;
  namaKel: string | null;
  namaKec: string | null;
  namaIbu: string | null;
  namaAyah: string | null;
  alamat: string | null;
  rt: string | null;
  rw: string | null;
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
  const nikFilter = (payload.nik ?? "").replace(/\D/g, "");
  const noAktaFilter = (payload.noAkta ?? "").trim();
  const labelTanggal = `${startDate} s.d ${endDate}`;

  const binds: Record<string, unknown> = {
    b_start_date: startDate,
    b_end_date: endDate,
  };

  const whereParts: string[] = [
    `A.ADM_AKTA_TGL >= TO_DATE(:b_start_date,'DD-MM-YYYY')`,
    `A.ADM_AKTA_TGL < TO_DATE(:b_end_date,'DD-MM-YYYY') + 1`,
  ];

  if (noKec > 0) {
    whereParts.push(`A.ADM_NO_KEC = :b_no_kec`);
    binds.b_no_kec = noKec;
  }
  if (noKel > 0) {
    whereParts.push(`A.ADM_NO_KEL = :b_no_kel`);
    binds.b_no_kel = noKel;
  }
  if (nikFilter) {
    whereParts.push(`A.MATI_NIK = :b_nik`);
    binds.b_nik = nikFilter;
  }
  if (noAktaFilter) {
    whereParts.push(`UPPER(A.ADM_AKTA_NO) = :b_no_akta`);
    binds.b_no_akta = noAktaFilter.toUpperCase();
  }

  const sql = `
    SELECT
      '''' || A.MATI_NIK AS NIK,
      A.MATI_NAMA_LGKP AS NAMA,
      A.ADM_AKTA_NO AS NO_AKTA,
      TO_CHAR(A.ADM_AKTA_TGL,'YYYY-MM-DD') AS TGL_AKTA,
      TO_CHAR(A.MATI_TGL_MATI,'YYYY-MM-DD') AS TGL_MATI,
      A.NAMA_KEL AS NAMA_KEL,
      A.NAMA_KEC AS NAMA_KEC,
      A.MATI_ALAMAT AS ALAMAT,
      A.MATI_NO_RT AS RT,
      A.MATI_NO_RW AS RW,
      A.IBU_NAMA_LGKP AS IBU,
      A.AYAH_NAMA_LGKP AS AYAH
    FROM SIAK_BNBA_AKTA_MATI A
    WHERE ${whereParts.join(" AND ")}
    ORDER BY A.ADM_AKTA_TGL DESC
  `;

  try {
    const rows = await execRows(sql, binds, {}, ORACLE_ALIAS);
    const mapped: Row[] = rows.map((r: any) => ({
      nik: r.NIK ?? null,
      nama: r.NAMA ?? null,
      noAkta: r.NO_AKTA ?? null,
      tglAkta: r.TGL_AKTA ?? null,
      tglMati: r.TGL_MATI ?? null,
      namaKel: r.NAMA_KEL ?? null,
      namaKec: r.NAMA_KEC ?? null,
      namaIbu: r.IBU ?? null,
      namaAyah: r.AYAH ?? null,
      alamat: r.ALAMAT ?? null,
      rt: r.RT ?? null,
      rw: r.RW ?? null,
    }));

    const response: ResponseBody = {
      meta: {
        title: "Laporan Akta Kematian",
        subTitle: `Rekap BNBA Kematian Tanggal ${labelTanggal}`,
        typeTgl: "Tanggal",
        startDate,
        endDate,
        labelTanggal,
        filter: { noKec, noKel },
        total: mapped.length,
      },
      rows: mapped,
    };

    await Log.info({
      scope: "API",
      msg: "LAPORAN.BNBA.KEMATIAN",
      at: AT,
      user: session.S_USER_ID,
      tookMs: Date.now() - startedAt,
      extra: { startDate, endDate, noKec, noKel, rowCount: mapped.length },
    });

    return ok(response);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "LAPORAN.BNBA.KEMATIAN FAILED",
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
    return err("Gagal mengambil data laporan kematian");
  }
}
