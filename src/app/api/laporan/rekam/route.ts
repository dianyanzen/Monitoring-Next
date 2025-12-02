// FILE: src/app/api/laporan/rekam/route.ts

import type { NextRequest } from "next/server";
import { ok, badRequest, err, unauthorized } from "@/lib/http";
import { readServerSession } from "@/lib/session";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/laporan/rekam";
const ORACLE_ALIAS = process.env.DB_ALIAS_LAPORAN_REKAM ?? "DB5";

type LaporanRekamPayload = {
  // format: "DD-MM-YYYY"
  startDate?: string;
  endDate?: string;
  // 0 = semua kecamatan, >0 = spesifik kecamatan
  noKec?: string | number | null;
  // 0 = semua kelurahan di kec tsb, >0 = spesifik kelurahan
  noKel?: string | number | null;
};

type LaporanRekamRow = {
  noWil: number;
  namaWil: string;
  tanggal: string; // label range, mis: "01-12-2025 s.d 01-12-2025"
  jumlah: number;
};

type LaporanRekamResponse = {
  meta: {
    title: string;
    subTitle: string;
    typeTgl: "Perekaman";
    noWilLabel: string;   // "No Kec" | "No Kel"
    kodeWilLabel: string; // "Nama Kecamatan" | "Nama Kelurahan"
    startDate: string;
    endDate: string;
    labelTanggal: string;
    filter: {
      noKec: number;
      noKel: number;
    };
    total: number;
  };
  rows: LaporanRekamRow[];
};

function normalizeDigits(v?: string | number | null): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\D/g, "");
}

function toIntOrZero(v?: string | number | null): number {
  const clean = normalizeDigits(v);
  if (!clean) return 0;
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}

// sangat simple: hanya cek pola dd-mm-yyyy sekilas
function isValidDDMMYYYY(d: string | undefined | null): d is string {
  if (!d) return false;
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(d);
  if (!m) return false;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (year < 2000 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

function todayDDMMYYYY(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const session = await readServerSession();
  if (!session?.S_USER_ID) {
    return unauthorized("Sesi tidak ditemukan");
  }

  let payload: LaporanRekamPayload;
  try {
    payload = (await req.json()) as LaporanRekamPayload;
  } catch {
    return badRequest("Payload harus berupa JSON");
  }

  // default tanggal = hari ini kalau tidak dikirim
  let startDate = payload.startDate && isValidDDMMYYYY(payload.startDate) ? payload.startDate : todayDDMMYYYY();
  let endDate = payload.endDate && isValidDDMMYYYY(payload.endDate) ? payload.endDate : todayDDMMYYYY();

  const noKec = toIntOrZero(payload.noKec);
  const noKel = toIntOrZero(payload.noKel);

  const labelTanggal = `${startDate} s.d ${endDate}`;

  const isAllKec = noKec === 0;
  const isAllKel = noKel === 0;

  // label kolom, sama dengan Laravel
  const noWilLabel = isAllKec ? "No Kec" : "No Kel";
  const kodeWilLabel = isAllKec ? "Nama Kecamatan" : "Nama Kelurahan";

  // build SQL sesuai rkm_get_data_rekam
  let sql: string;
  const binds: Record<string, unknown> = {
    b_tgl_label: labelTanggal,
    b_start_date: startDate,
    b_end_date: endDate,
  };

  if (isAllKec) {
    // === CASE 1: no_kec = 0 → agregat per kecamatan ===
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
        FROM DEMOGRAPHICS B
        INNER JOIN SETUP_KEC@DB222 C
          ON B.NO_PROP = C.NO_PROP
         AND B.NO_KAB = C.NO_KAB
         AND B.NO_KEC = C.NO_KEC
        WHERE
          B.CREATED >= TO_DATE(:b_start_date,'DD-MM-YYYY')
          AND B.CREATED < TO_DATE(:b_end_date,'DD-MM-YYYY') + 1
          AND EXISTS (SELECT 1 FROM FINGERS D WHERE B.NIK = D.NIK)
          AND C.NO_PROP = 32
          AND C.NO_KAB = 73
        GROUP BY C.NO_KEC, C.NAMA_KEC
      ) B
        ON A.NO_KEC = B.NO_KEC
      WHERE
        A.NO_PROP = 32
        AND A.NO_KAB = 73
      ORDER BY A.NO_KEC
    `;
  } else {
    // === CASE 2: no_kec > 0 → agregat per kelurahan (dengan/ tanpa filter kel) ===
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
        FROM DEMOGRAPHICS B
        INNER JOIN SETUP_KEL@DB222 C
          ON B.NO_PROP = C.NO_PROP
         AND B.NO_KAB = C.NO_KAB
         AND B.NO_KEC = C.NO_KEC
         AND B.NO_KEL = C.NO_KEL
        WHERE
          B.CREATED >= TO_DATE(:b_start_date,'DD-MM-YYYY')
          AND B.CREATED < TO_DATE(:b_end_date,'DD-MM-YYYY') + 1
          AND EXISTS (SELECT 1 FROM FINGERS D WHERE B.NIK = D.NIK)
          AND C.NO_PROP = 32
          AND C.NO_KAB = 73
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
    if (!isAllKel) {
      binds.b_no_kel = noKel;
    }
  }

  try {
    const rawRows = await execRows(sql, binds, {}, ORACLE_ALIAS);

    const rows: LaporanRekamRow[] = rawRows.map((r: any) => ({
      noWil: Number(r.NO_WIL),
      namaWil: r.NAMA_WIL,
      tanggal: r.TANGGAL,
      jumlah: Number(r.JUMLAH ?? 0),
    }));

    const total = rows.reduce((acc, r) => acc + (r.jumlah || 0), 0);

    const response: LaporanRekamResponse = {
      meta: {
        title: `Laporan Perekaman`,
        subTitle: `Laporan Perekaman${isAllKec ? "" : ""} Tanggal ${labelTanggal}`,
        typeTgl: "Perekaman",
        noWilLabel,
        kodeWilLabel,
        startDate,
        endDate,
        labelTanggal,
        filter: {
          noKec,
          noKel,
        },
        total,
      },
      rows,
    };

    await Log.info({
      scope: "API",
      msg: "LAPORAN.REKAM",
      at: AT,
      user: session.S_USER_ID,
      tookMs: Date.now() - startedAt,
      extra: {
        startDate,
        endDate,
        noKec,
        noKel,
        rowCount: rows.length,
        total,
      },
    });

    return ok(response);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "LAPORAN.REKAM FAILED",
      at: AT,
      user: session.S_USER_ID,
      tookMs: Date.now() - startedAt,
      err: {
        name: e?.name || "Error",
        message: e?.message || String(e),
        stack: e?.stack,
      },
      extra: {
        startDate,
        endDate,
        noKec,
        noKel,
      },
    });
    return err("Gagal mengambil data laporan perekaman");
  }
}
