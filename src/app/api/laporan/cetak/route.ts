// FILE: src/app/api/laporan/cetak/route.ts

import type { NextRequest } from "next/server";
import { ok, badRequest, err, unauthorized } from "@/lib/http";
import { readServerSession } from "@/lib/session";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/laporan/cetak";
const ORACLE_ALIAS = process.env.DB_ALIAS_LAPORAN_CETAK ?? "DB5CETAK";

type LaporanCetakPayload = {
  startDate?: string;
  endDate?: string;
  noKec?: string | number | null;
  noKel?: string | number | null;
};

type LaporanCetakRow = {
  noWil: number;
  namaWil: string;
  tanggal: string;
  jumlah: number;
};

type LaporanCetakResponse = {
  meta: {
    title: string;
    subTitle: string;
    typeTgl: "Pencetakan";
    noWilLabel: string;
    kodeWilLabel: string;
    startDate: string;
    endDate: string;
    labelTanggal: string;
    filter: { noKec: number; noKel: number };
    total: number;
  };
  rows: LaporanCetakRow[];
};

function normalizeDigits(v?: string | number | null) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\D/g, "");
}

function toIntOrZero(v?: string | number | null) {
  const clean = normalizeDigits(v);
  if (!clean) return 0;
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}

function isValidDDMMYYYY(d?: string | null): d is string {
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
}

function todayDDMMYYYY() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const session = await readServerSession();
  if (!session?.S_USER_ID) return unauthorized("Sesi tidak ditemukan");

  let payload: LaporanCetakPayload;
  try {
    payload = (await req.json()) as LaporanCetakPayload;
  } catch {
    return badRequest("Payload harus berupa JSON");
  }

  const startDate = payload.startDate && isValidDDMMYYYY(payload.startDate) ? payload.startDate : todayDDMMYYYY();
  const endDate = payload.endDate && isValidDDMMYYYY(payload.endDate) ? payload.endDate : todayDDMMYYYY();
  const noKec = toIntOrZero(payload.noKec);
  const noKel = toIntOrZero(payload.noKel);
  const labelTanggal = `${startDate} s.d ${endDate}`;

  const isAllKec = noKec === 0;
  const isAllKel = noKel === 0;
  const noWilLabel = isAllKec ? "No Kec" : "No Kel";
  const kodeWilLabel = isAllKec ? "Nama Kecamatan" : "Nama Kelurahan";

  const binds: Record<string, unknown> = {
    b_tgl_label: labelTanggal,
    b_start_date: startDate,
    b_end_date: endDate,
  };

  const baseFilters = `
    NVL(B.LAST_UPDATE, B.PERSONALIZED_DATE) >= TO_DATE(:b_start_date,'DD-MM-YYYY')
    AND NVL(B.LAST_UPDATE, B.PERSONALIZED_DATE) < TO_DATE(:b_end_date,'DD-MM-YYYY') + 1
    AND NVL(UPPER(B.LAST_UPDATED_USERNAME), UPPER(B.CREATED_USERNAME)) NOT IN (
      SELECT UPPER(USER_BCARD) FROM SIAK_CETAK_GOIB@YZDB WHERE IS_ACTIVE = 1
    )
    AND C.NO_PROP = 32
    AND C.NO_KAB = 73
  `;

  let sql: string;
  if (isAllKec) {
    sql = `
      SELECT
        A.NO_KEC AS NO_WIL,
        A.NAMA_KEC AS NAMA_WIL,
        :b_tgl_label AS TANGGAL,
        NVL(B.JUMLAH, 0) AS JUMLAH
      FROM SETUP_KEC@DB222 A
      LEFT JOIN (
        SELECT
          C.NO_KEC,
          C.NAMA_KEC,
          COUNT(B.NIK) AS JUMLAH
        FROM CARD_MANAGEMENT B
        INNER JOIN DEMOGRAPHICS A
          ON A.NIK = B.NIK
        INNER JOIN SETUP_KEC@DB222 C
          ON A.NO_PROP = C.NO_PROP
         AND A.NO_KAB = C.NO_KAB
         AND A.NO_KEC = C.NO_KEC
        WHERE
          ${baseFilters}
        GROUP BY C.NO_KEC, C.NAMA_KEC
      ) B
        ON A.NO_KEC = B.NO_KEC
      WHERE
        A.NO_PROP = 32
        AND A.NO_KAB = 73
      ORDER BY A.NO_KEC
    `;
  } else {
    sql = `
      SELECT
        A.NO_KEL AS NO_WIL,
        A.NAMA_KEL AS NAMA_WIL,
        :b_tgl_label AS TANGGAL,
        NVL(B.JUMLAH, 0) AS JUMLAH
      FROM SETUP_KEL@DB222 A
      LEFT JOIN (
        SELECT
          C.NO_KEL,
          C.NAMA_KEL,
          COUNT(B.NIK) AS JUMLAH
        FROM CARD_MANAGEMENT B
        INNER JOIN DEMOGRAPHICS A
          ON A.NIK = B.NIK
        INNER JOIN SETUP_KEL@DB222 C
          ON A.NO_PROP = C.NO_PROP
         AND A.NO_KAB = C.NO_KAB
         AND A.NO_KEC = C.NO_KEC
         AND A.NO_KEL = C.NO_KEL
        WHERE
          ${baseFilters}
          AND C.NO_KEC = :b_no_kec
          ${isAllKel ? "" : "AND C.NO_KEL = :b_no_kel"}
        GROUP BY C.NO_KEL, C.NAMA_KEL
      ) B
        ON A.NO_KEL = B.NO_KEL
      WHERE
        A.NO_PROP = 32
        AND A.NO_KAB = 73
        AND A.NO_KEC = :b_no_kec
        ${isAllKel ? "" : "AND A.NO_KEL = :b_no_kel"}
      ORDER BY A.NO_KEL
    `;
    binds.b_no_kec = noKec;
    if (!isAllKel) binds.b_no_kel = noKel;
  }

  try {
    const rawRows = await execRows(sql, binds, {}, ORACLE_ALIAS);
    const rows: LaporanCetakRow[] = rawRows.map((r: any) => ({
      noWil: Number(r.NO_WIL),
      namaWil: r.NAMA_WIL,
      tanggal: r.TANGGAL,
      jumlah: Number(r.JUMLAH ?? 0),
    }));
    const total = rows.reduce((sum, row) => sum + (row.jumlah || 0), 0);

    const response: LaporanCetakResponse = {
      meta: {
        title: "Laporan Cetak KTP-el",
        subTitle: `Laporan Pencetakan KTP-el Tanggal ${labelTanggal}`,
        typeTgl: "Pencetakan",
        noWilLabel,
        kodeWilLabel,
        startDate,
        endDate,
        labelTanggal,
        filter: { noKec, noKel },
        total,
      },
      rows,
    };

    await Log.info({
      scope: "API",
      msg: "LAPORAN.CETAK",
      at: AT,
      user: session.S_USER_ID,
      tookMs: Date.now() - startedAt,
      extra: { startDate, endDate, noKec, noKel, total, rowCount: rows.length },
    });

    return ok(response);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "LAPORAN.CETAK FAILED",
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
    return err("Gagal mengambil data laporan cetak");
  }
}
