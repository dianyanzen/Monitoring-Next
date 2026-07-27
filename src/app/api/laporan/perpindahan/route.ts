// FILE: src/app/api/laporan/perpindahan/route.ts

import type { NextRequest } from "next/server";
import { ok, badRequest, err, unauthorized } from "@/lib/http";
import { readServerSession } from "@/lib/session";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/laporan/perpindahan";
const ORACLE_ALIAS = process.env.DB_ALIAS_LAPORAN_PERPINDAHAN ?? "DB";

type Payload = {
  startDate?: string;
  endDate?: string;
  noKec?: string | number | null;
  noKel?: string | number | null;
  noKlas?: string | number | null;
  nik?: string;
  noPindah?: string;
};

type Row = {
  noKk: string | null;
  nik: string | null;
  namaPemohon: string | null;
  alamat: string | null;
  kel: string | null;
  kec: string | null;
  daerahTujuan: string | null;
  kecTujuan: string | null;
  kelTujuan: string | null;
  alamatTujuan: string | null;
  tglPindah: string | null;
  jam: string | null;
  noPindah: string | null;
  klasifikasi: string | null;
};

type ResponseBody = {
  meta: {
    title: string;
    subTitle: string;
    typeTgl: "Tanggal";
    startDate: string;
    endDate: string;
    labelTanggal: string;
    filter: { noKec: number; noKel: number; noKlas: number };
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
  const noKlas = toIntOrZero(payload.noKlas);
  const nikFilter = (payload.nik ?? "").replace(/\D/g, "");
  const noPindahFilter = (payload.noPindah ?? "").trim();
  const labelTanggal = `${startDate} s.d ${endDate}`;

  const binds: Record<string, unknown> = {
    b_start_date: startDate,
    b_end_date: endDate,
  };

  const whereParts: string[] = [
    `A.TGL_PINDAH >= TO_DATE(:b_start_date,'DD-MM-YYYY')`,
    `A.TGL_PINDAH < TO_DATE(:b_end_date,'DD-MM-YYYY') + 1`,
    `A.NO_PROP_ASAL = 32`,
    `A.NO_KAB_ASAL = 73`,
  ];

  if (noKec > 0) {
    whereParts.push(`A.NO_KEC_ASAL = :b_no_kec`);
    binds.b_no_kec = noKec;
  }
  if (noKel > 0) {
    whereParts.push(`A.NO_KEL_ASAL = :b_no_kel`);
    binds.b_no_kel = noKel;
  }
  if (noKlas === 1) {
    whereParts.push(`A.KLASIFIKASI_PINDAH NOT IN ('(4) ANTAR KAB/KOTA','(5) ANTAR PROVINSI')`);
  } else if (noKlas === 2) {
    whereParts.push(`A.KLASIFIKASI_PINDAH IN ('(4) ANTAR KAB/KOTA','(5) ANTAR PROVINSI')`);
  }
  if (nikFilter) {
    whereParts.push(`A.NIK = :b_nik`);
    binds.b_nik = nikFilter;
  }
  if (noPindahFilter) {
    whereParts.push(`UPPER(A.NO_PINDAH) = :b_no_pindah`);
    binds.b_no_pindah = noPindahFilter.toUpperCase();
  }

  const sql = `
    SELECT
      A.NO_KK AS NO_KK,
      '''' || A.NIK AS NIK,
      A.NAMA_LENGKAP AS NAMA_PEMOHON,
      A.ALAMAT_ASAL AS ALAMAT,
      A.NAMA_KEL_ASAL AS KEL,
      A.NAMA_KEC_ASAL AS KEC,
      CASE
        WHEN A.KLASIFIKASI_PINDAH IN ('(4) ANTAR KAB/KOTA','(5) ANTAR PROVINSI')
          THEN A.NAMA_KAB_TUJUAN
        ELSE 'KEC. ' || A.NAMA_KEC_TUJUAN
      END AS DAERAH_TUJUAN,
      A.NAMA_KEC_TUJUAN AS KEC_TUJUAN,
      A.NAMA_KEL_TUJUAN AS KEL_TUJUAN,
      A.ALAMAT_TUJUAN AS ALAMAT_TUJUAN,
      TO_CHAR(A.TGL_PINDAH,'YYYY-MM-DD') AS TGL_PINDAH,
      TO_CHAR(A.TGL_PINDAH,'HH24:MI:SS') AS JAM,
      A.NO_PINDAH AS NO_PINDAH,
      A.KLASIFIKASI_PINDAH AS KLASIFIKASI
    FROM SIAK_BNBA_PINDAH A
    WHERE ${whereParts.join(" AND ")}
    ORDER BY A.TGL_PINDAH DESC
  `;

  try {
    const rows = await execRows(sql, binds, {}, ORACLE_ALIAS);
    const mapped: Row[] = rows.map((r: any) => ({
      noKk: r.NO_KK ?? null,
      nik: r.NIK ?? null,
      namaPemohon: r.NAMA_PEMOHON ?? null,
      alamat: r.ALAMAT ?? null,
      kel: r.KEL ?? null,
      kec: r.KEC ?? null,
      daerahTujuan: r.DAERAH_TUJUAN ?? null,
      kecTujuan: r.KEC_TUJUAN ?? null,
      kelTujuan: r.KEL_TUJUAN ?? null,
      alamatTujuan: r.ALAMAT_TUJUAN ?? null,
      tglPindah: r.TGL_PINDAH ?? null,
      jam: r.JAM ?? null,
      noPindah: r.NO_PINDAH ?? null,
      klasifikasi: r.KLASIFIKASI ?? null,
    }));

    const response: ResponseBody = {
      meta: {
        title: "Laporan Perpindahan Penduduk",
        subTitle: `Laporan Pindah Keluar Tanggal ${labelTanggal}`,
        typeTgl: "Tanggal",
        startDate,
        endDate,
        labelTanggal,
        filter: { noKec, noKel, noKlas },
        total: mapped.length,
      },
      rows: mapped,
    };

    await Log.info({
      scope: "API",
      msg: "LAPORAN.PERPINDAHAN",
      at: AT,
      user: session.S_USER_ID,
      tookMs: Date.now() - startedAt,
      extra: { startDate, endDate, noKec, noKel, noKlas, rowCount: mapped.length },
    });

    return ok(response);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "LAPORAN.PERPINDAHAN FAILED",
      at: AT,
      user: session.S_USER_ID,
      tookMs: Date.now() - startedAt,
      err: {
        name: e?.name || "Error",
        message: e?.message || String(e),
        stack: e?.stack,
      },
      extra: { startDate, endDate, noKec, noKel, noKlas },
    });
    return err("Gagal mengambil data laporan perpindahan");
  }
}
