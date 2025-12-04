// FILE: src/app/api/report/laporandaily/route.ts
import { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { getClientInfo, readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/report/laporandaily";
const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";

type Row = {
  USER_ID: string;
  NAMA_LGKP: string;
  AKTIVITAS: number;
  JUMLAH_AKTIVITAS: number;
  TASK_PER_AKTIVITAS: number;
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
             COALESCE(B.AKTIVITAS, 0) AS AKTIVITAS,
             COALESCE(B.JUMLAH_AKTIVITAS, 0) AS JUMLAH_AKTIVITAS,
             COALESCE(B.TASK_PER_AKTIVITAS, 0) AS TASK_PER_AKTIVITAS
      FROM SIAK_USER_PLUS A
      LEFT JOIN (
        SELECT USER_ID,
               COUNT(DISTINCT ACTIVITY_ID) AS AKTIVITAS,
               COUNT(DAILY_ID) AS JUMLAH_AKTIVITAS,
               SUM(NUMBER_ACTIVITY) AS TASK_PER_AKTIVITAS
        FROM SIAK_DAILY
        WHERE TO_CHAR(CREATED_DT,'MM-YYYY') = :b_period
        GROUP BY USER_ID
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
      aktivitas: `${r.AKTIVITAS} Kriteria`,
      task: `${r.TASK_PER_AKTIVITAS} Task`,
      jumlahAktivitas: `${r.JUMLAH_AKTIVITAS} Aktivitas`,
    }));

    await Log.info({
      scope: "API",
      msg: "laporandaily/list",
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
      msg: "laporandaily/list_err",
      at: AT,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat laporan daily");
  }
}
