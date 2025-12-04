// FILE: src/app/api/report/laporandaily/[userId]/route.ts
import { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { getClientInfo, readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/report/laporandaily/[userId]";
const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";

type Row = {
  TANGGAL: string;
  JAM: string;
  AKTIVITAS: string;
  DESCRIPTION: string;
  JUMLAH: number;
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

export async function GET(req: NextRequest, { params }: { params: any }) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();

  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const url = new URL(req.url);
    const period = normalizeMonthYear(url.searchParams.get("period") || url.searchParams.get("tanggal"));
    const userId = toStr((params as any)?.userId);
    if (!period) return badRequest("Format tanggal harus MM-YYYY");
    if (!userId) return badRequest("userId wajib diisi");

    const rows = await execRows<Row>(
      `
      SELECT 
        TO_CHAR(D.CREATED_DT,'DD-MM-YYYY') AS TANGGAL,
        TO_CHAR(D.CREATED_DT,'HH24:MI') AS JAM,
        CASE WHEN ACT.ACTIVITY = 'LAINNYA' THEN UPPER(D.DESCRIPTION) ELSE ACT.ACTIVITY END AS AKTIVITAS,
        UPPER(D.DESCRIPTION) AS DESCRIPTION,
        D.NUMBER_ACTIVITY AS JUMLAH
      FROM SIAK_DAILY D
      INNER JOIN SIAK_ACTIVITY ACT ON D.ACTIVITY_ID = ACT.ACTIVITY_ID
      WHERE D.USER_ID = :b_user_id
        AND TO_CHAR(D.CREATED_DT,'MM-YYYY') = :b_period
      ORDER BY TRUNC(D.CREATED_DT) DESC, D.DAILY_ID
      `,
      { b_user_id: userId, b_period: period },
      {},
      ORACLE_ALIAS,
    );

    const data = rows.map((r, idx) => ({
      no: idx + 1,
      tanggal: toStr(r.TANGGAL),
      aktivitas: toStr(r.AKTIVITAS),
      description: toStr(r.DESCRIPTION),
      jam: toStr(r.JAM),
      jumlah: `${r.JUMLAH ?? 0} Aktivitas`,
    }));

    await Log.info({
      scope: "API",
      msg: "laporandaily/detail",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { period, userId, count: data.length },
    });

    return ok(data);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "laporandaily/detail_err",
      at: AT,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat detail daily");
  }
}
