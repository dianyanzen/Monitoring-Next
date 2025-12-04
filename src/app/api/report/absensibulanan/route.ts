import { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { getClientInfo, readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/report/absensibulanan";
const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";

type RawRow = {
  USER_ID: string;
  NAMA: string;
  BULAN: string;
  T1: number;
  T2: number;
  T3: number;
  T4: number;
  T5: number;
  T6: number;
  T7: number;
  T8: number;
  T9: number;
  T10: number;
  T11: number;
  T12: number;
  T13: number;
  T14: number;
  T15: number;
  T16: number;
  T17: number;
  T18: number;
  T19: number;
  T20: number;
  T21: number;
  T22: number;
  T23: number;
  T24: number;
  T25: number;
  T26: number;
  T27: number;
  T28: number;
  T29: number;
  T30: number;
  T31: number;
  KEHADIRAN: number;
  TEPAT_WAKTU: number;
  TERLAMBAT: number;
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

const dayMeta = Array.from({ length: 31 }, (_, idx) => {
  const num = idx + 1;
  return { num, dd: String(num).padStart(2, "0") };
});

const attendanceCheck = "COALESCE(UPPER(B.KETERANGAN),'HADIR') NOT IN ('IZIN','SAKIT')";
const tepatCheck = "COALESCE(UPPER(B.KETERANGAN),'TEPAT') <> 'TERLAMBAT'";
const terlambatCheck = "COALESCE(UPPER(B.KETERANGAN),'') = 'TERLAMBAT'";
const userFilter = "NVL(A.ABSENSI_CHECKING,0) = 1";

export async function POST(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();

  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const period = normalizeMonthYear(body.tanggal || body.period || body.month);
    if (!period) return badRequest("Format tanggal harus MM-YYYY");

    const dayProjectionSql = dayMeta
      .map(({ dd, num }) => `    CASE WHEN X.TGL_${dd} > 0 THEN 'HADIR' ELSE '-' END AS T${num},`)
      .join("\n");
    const dayAggregateSql = dayMeta
      .map(
        ({ dd }) =>
          `      SUM(CASE WHEN TO_CHAR(B.TANGGAL,'MM-YYYY') = :b_period AND TO_CHAR(B.TANGGAL,'DD') = '${dd}' AND ${attendanceCheck} THEN 1 ELSE 0 END) AS TGL_${dd},`
      )
      .join("\n");

    const sql = `
    SELECT
      X.USER_ID,
      X.NAMA,
      :b_period AS BULAN,
${dayProjectionSql}
      X.KEHADIRAN,
      X.TEPAT_WAKTU,
      X.TERLAMBAT
    FROM (
      SELECT
        A.USER_ID,
        A.NAMA_LGKP AS NAMA,
${dayAggregateSql}
        SUM(CASE WHEN TO_CHAR(B.TANGGAL,'MM-YYYY') = :b_period AND ${attendanceCheck} THEN 1 ELSE 0 END) AS KEHADIRAN,
        SUM(CASE WHEN TO_CHAR(B.TANGGAL,'MM-YYYY') = :b_period AND ${tepatCheck} THEN 1 ELSE 0 END) AS TEPAT_WAKTU,
        SUM(CASE WHEN TO_CHAR(B.TANGGAL,'MM-YYYY') = :b_period AND ${terlambatCheck} THEN 1 ELSE 0 END) AS TERLAMBAT
      FROM SIAK_USER_PLUS A
      LEFT JOIN SIAK_ABSENSI B ON A.USER_ID = B.USER_ID
      WHERE ${userFilter}
      GROUP BY A.USER_ID, A.NAMA_LGKP
    ) X
    ORDER BY UPPER(X.USER_ID)
    `;

    const rows = await execRows<RawRow>(sql, { b_period: period }, {}, ORACLE_ALIAS);

    const data = rows.map((raw, idx) => {
      const base: Record<string, string | number> = {
        no: idx + 1,
        userId: toStr(raw.USER_ID),
        nama: toStr(raw.NAMA),
        bulan: period,
        kehadiran: Number(raw.KEHADIRAN ?? 0),
        tepatWaktu: Number(raw.TEPAT_WAKTU ?? 0),
        terlambat: Number(raw.TERLAMBAT ?? 0),
      };

      dayMeta.forEach(({ num }) => {
        const key = `T${num}` as keyof RawRow;
        const outputKey = `t${num}`;
        const rawVal = (raw as any)[key];
        const str = typeof rawVal === "string" ? rawVal.trim().toUpperCase() : "";
        const asNum = Number(rawVal ?? 0);
        const isPresent = str === "HADIR" || (!Number.isNaN(asNum) && asNum > 0);
        base[outputKey] = isPresent ? "HADIR" : "-";
      });

      return base;
    });

    await Log.info({
      scope: "API",
      msg: "absensibulanan/list",
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
      msg: "absensibulanan/list_err",
      at: AT,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat rekap absensi bulanan");
  }
}
