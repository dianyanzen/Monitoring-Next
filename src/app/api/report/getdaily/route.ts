import { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";
const AT = "/api/report/getdaily";

type Row = {
  TGL: string;
  TANGGAL: string;
  USER_ID: string;
  DESCRIPTION: string;
  JUMLAH: string;
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
    const userId = toStr(body.userId || body.user_id || session.S_USER_ID);
    const bulanTahun = normalizeMonthYear(body.tanggal || body.month || body.period || "");
    if (!bulanTahun) return badRequest("Format tanggal harus MM-YYYY");

    const rows = await execRows<Row>(
      `
      SELECT 
        TRUNC(A.CREATED_DT) AS TGL,
        TO_CHAR(A.CREATED_DT,'DD-MM-YYYY') AS TANGGAL,
        A.USER_ID,
        LISTAGG(CASE WHEN B.ACTIVITY = 'LAINNYA' THEN CONCAT('- ',UPPER(A.DESCRIPTION)) ELSE CONCAT('- ',B.ACTIVITY) END, ' </BR>') 
          WITHIN GROUP (ORDER BY TRUNC(A.CREATED_DT),A.DAILY_ID) AS DESCRIPTION,
        LISTAGG(A.NUMBER_ACTIVITY, ' Aktivitas </BR>') 
          WITHIN GROUP (ORDER BY TRUNC(A.CREATED_DT),A.DAILY_ID) ||' Aktivitas' AS JUMLAH
      FROM SIAK_DAILY A 
      INNER JOIN SIAK_ACTIVITY B ON A.ACTIVITY_ID = B.ACTIVITY_ID 
      WHERE A.USER_ID = :b_user_id
        AND TO_CHAR(A.CREATED_DT,'MM-YYYY') = :b_period
      GROUP BY TO_CHAR(A.CREATED_DT,'DD-MM-YYYY'),TRUNC(A.CREATED_DT),A.USER_ID
      ORDER BY TRUNC(A.CREATED_DT) DESC, A.USER_ID
      `,
      { b_user_id: userId, b_period: bulanTahun },
      {},
      ORACLE_ALIAS
    );

    const items = rows.map((r, idx) => ({
      no: idx + 1,
      userId,
      tanggal: toStr(r.TANGGAL),
      description: toStr(r.DESCRIPTION).replace(/<\/?BR>/gi, "<br />"),
      jumlah: toStr(r.JUMLAH),
    }));

    await Log.info({
      scope: "API",
      msg: "getdaily/list",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { period: bulanTahun, userId, count: items.length },
    });

    return ok(items);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "getdaily/list_err",
      at: AT,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal memuat rekap daily activity bulanan");
  }
}

