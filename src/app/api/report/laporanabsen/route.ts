// FILE: src/app/api/report/laporanabsen/route.ts
import { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { getClientInfo, readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/report/laporanabsen";
const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";

type Row = {
  USER_ID: string;
  NAMA_LGKP: string;
  KETERANGAN: string;
  JUMLAH_HADIR: number;
  TEPAT_WAKTU: number;
  TERLAMBAT: number;
  EXCUSE: number;
  MINUTE_WORK: number | string;
  LATE_0730_0800_MINUTES: string;
  LATE_AFTER_0800: number;
};

const toStr = (v: unknown) => (v == null ? "" : String(v).trim());

function normalizeMonthYear(raw: unknown) {
  const value = toStr(raw);
  if (!value) return null;
  if (/^\d{2}-\d{4}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [yyyy, mm] = value.split("-");
    return `${mm}-${yyyy}`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();

  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const period = normalizeMonthYear(body.tanggal || body.period || body.month);
    if (!period) return badRequest("Format tanggal harus MM-YYYY");

    const rows = await execRows<Row>(
      `
      SELECT A.USER_ID,
             A.NAMA_LGKP,
             D.LEVEL_NAME AS KETERANGAN,
             COALESCE(B.JUMLAH_HADIR, 0) AS JUMLAH_HADIR,
             COALESCE(B.TEPAT_WAKTU, 0) AS TEPAT_WAKTU,
             COALESCE(B.TERLAMBAT, 0) AS TERLAMBAT,
             COALESCE(B.EXCUSE, 0) AS EXCUSE,
             COALESCE(B.MINUTE_WORK, 0) AS MINUTE_WORK,
             COALESCE(B.LATE_0730_0800_MINUTES, '00:00') AS LATE_0730_0800_MINUTES,
             COALESCE(B.LATE_AFTER_0800, 0) AS LATE_AFTER_0800
      FROM SIAK_USER_PLUS A
      LEFT JOIN SIAK_USER_LEVEL D ON A.USER_LEVEL = D.USER_LEVEL
      LEFT JOIN (
        SELECT A.USER_ID,
               COUNT(B.TANGGAL) AS JUMLAH_HADIR,
               SUM(CASE WHEN UPPER(B.KETERANGAN) IN ('TEPAT','TEPAT WAKTU') THEN 1 ELSE 0 END) AS TEPAT_WAKTU,
               SUM(CASE WHEN UPPER(B.KETERANGAN) = 'TERLAMBAT' THEN 1 ELSE 0 END) AS TERLAMBAT,
               SUM(CASE WHEN UPPER(B.KETERANGAN) NOT IN ('TEPAT WAKTU','TERLAMBAT','TEPAT') THEN 1 ELSE 0 END) AS EXCUSE,
               SUM((TO_DATE(B.JAM_KELUAR,'HH24:MI') - TO_DATE(B.JAM_MASUK,'HH24:MI'))*24*60) AS MINUTE_WORK,
               LPAD(FLOOR(SUM(CASE 
                  WHEN TO_DATE(B.JAM_MASUK,'HH24:MI') BETWEEN TO_DATE('07:30','HH24:MI') AND TO_DATE('08:00','HH24:MI')
                  THEN (TO_DATE(B.JAM_MASUK,'HH24:MI') - TO_DATE('07:30','HH24:MI'))*24*60 ELSE 0 END)/60),2,'0')
               || ':' ||
               LPAD(MOD(SUM(CASE 
                  WHEN TO_DATE(B.JAM_MASUK,'HH24:MI') BETWEEN TO_DATE('07:30','HH24:MI') AND TO_DATE('08:00','HH24:MI')
                  THEN (TO_DATE(B.JAM_MASUK,'HH24:MI') - TO_DATE('07:30','HH24:MI'))*24*60 ELSE 0 END),60),2,'0') AS LATE_0730_0800_MINUTES,
               SUM(CASE WHEN TO_DATE(B.JAM_MASUK,'HH24:MI') > TO_DATE('08:00','HH24:MI') THEN 1 ELSE 0 END) AS LATE_AFTER_0800
        FROM SIAK_USER_PLUS A
        LEFT JOIN SIAK_ABSENSI B ON A.USER_ID = B.USER_ID
        WHERE A.IS_ABSEN = 1
          AND TO_CHAR(B.TANGGAL,'MM-YYYY') = :b_period
          AND A.IS_ABSEN = 1
        GROUP BY A.USER_ID
      ) B ON A.USER_ID = B.USER_ID
      WHERE A.IS_ABSEN = 1
      ORDER BY UPPER(A.USER_ID)
      `,
      { b_period: period },
      {},
      ORACLE_ALIAS,
    );

    const data = rows.map((r, idx) => ({
      no: idx + 1,
      userId: r.USER_ID,
      nama: toStr(r.NAMA_LGKP),
      level: toStr(r.KETERANGAN),
      hadir: `${r.JUMLAH_HADIR} Hari`,
      tepat: `${r.TEPAT_WAKTU} Hari`,
      terlambat: `${r.LATE_AFTER_0800} Hari`,
      akumulasi: `${toStr(r.LATE_0730_0800_MINUTES)} Menit`,
      jamKerja: `${r.MINUTE_WORK ?? 0} Menit`,
    }));

    await Log.info({
      scope: "API",
      msg: "laporanabsen/list",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { period, count: data.length },
    });

    return ok(data);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "laporanabsen/list_err",
      at: AT,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal memuat laporan absensi");
  }
}
