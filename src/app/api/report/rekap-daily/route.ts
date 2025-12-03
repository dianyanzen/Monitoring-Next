// FILE: src/app/api/report/rekap-daily/route.ts
import { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";
const AT = "/api/report/rekap-daily";
const MAX_ROWS = 250;

type DailyRow = {
  DAILY_ID: number;
  USER_ID: string;
  NAMA_DPN?: string;
  DESCRIPTION?: string;
  TANGGAL_ISO?: string;
  TANGGAL_DMY?: string;
  START_ACTIVITY?: string;
  END_ACTIVITY?: string;
  ACTIVITY?: string;
  NUMBER_ACTIVITY?: number;
  MINUTE_TOTAL?: number;
  MINUTE_LABEL?: string;
};

const toStr = (v: unknown) => (v == null ? "" : String(v).trim());

function normalizeDate(raw: unknown) {
  const value = toStr(raw);
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value; // ISO
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split("-");
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

const isoToDMY = (iso?: string) => {
  if (!iso || iso.split("-").length !== 3) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

export async function POST(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const startIso = normalizeDate(body.start || body.start_date || body.startDate);
    const endIso = normalizeDate(body.end || body.end_date || body.endDate);
    const userId = toStr(body.userId) || toStr(session.S_USER_ID);

    if (startIso && endIso) {
      const start = new Date(startIso);
      const end = new Date(endIso);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        return badRequest("Rentang tanggal tidak valid");
      }
    }

    const binds: Record<string, string | number> = { b_user_id: userId };
    const filters: string[] = ["A.USER_ID = :b_user_id"];
    if (startIso) {
      binds.b_start = startIso;
      filters.push("A.CREATED_DT >= TO_DATE(:b_start, 'YYYY-MM-DD')");
    }
    if (endIso) {
      binds.b_end = endIso;
      filters.push("A.CREATED_DT < TO_DATE(:b_end, 'YYYY-MM-DD') + 1");
    }

    const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const rows = await execRows<DailyRow>(
      `
      SELECT
        A.DAILY_ID,
        A.USER_ID,
        C.NAMA_DPN,
        UPPER(NVL(A.DESCRIPTION, '-')) AS DESCRIPTION,
        TO_CHAR(A.CREATED_DT, 'YYYY-MM-DD') AS TANGGAL_ISO,
        TO_CHAR(A.CREATED_DT, 'DD-MM-YYYY') AS TANGGAL_DMY,
        A.START_ACTIVITY,
        A.END_ACTIVITY,
        NVL(B.ACTIVITY, 'LAINNYA') AS ACTIVITY,
        A.NUMBER_ACTIVITY,
        (A.NUMBER_ACTIVITY * NVL(B.MINUTE, 10)) AS MINUTE_TOTAL,
        TO_CHAR((A.NUMBER_ACTIVITY * NVL(B.MINUTE, 10))) || ' Menit' AS MINUTE_LABEL
      FROM SIAK_DAILY A
      INNER JOIN SIAK_USER_PLUS C ON A.USER_ID = C.USER_ID
      LEFT JOIN SIAK_ACTIVITY B ON A.ACTIVITY_ID = B.ACTIVITY_ID
      ${whereSql}
      ORDER BY A.CREATED_DT DESC, A.DAILY_ID DESC
      FETCH FIRST ${MAX_ROWS} ROWS ONLY
      `,
      binds,
      {},
      ORACLE_ALIAS
    );

    const items = rows.map((row) => {
      const tanggalIso = toStr(row.TANGGAL_ISO);
      return {
        id: Number(row.DAILY_ID),
        dailyId: Number(row.DAILY_ID),
        userId: toStr(row.USER_ID),
        userName: toStr(row.NAMA_DPN),
        tanggal: tanggalIso,
        tanggalLabel: toStr(row.TANGGAL_DMY) || isoToDMY(tanggalIso),
        activity: toStr(row.ACTIVITY || "LAINNYA"),
        description: toStr(row.DESCRIPTION),
        start: toStr(row.START_ACTIVITY),
        end: toStr(row.END_ACTIVITY),
        jumlah: Number(row.NUMBER_ACTIVITY ?? 0),
        menit: Number(row.MINUTE_TOTAL ?? 0),
        menitLabel: toStr(row.MINUTE_LABEL),
        jam: `${toStr(row.START_ACTIVITY)} - ${toStr(row.END_ACTIVITY)}`.trim(),
      };
    });

    await Log.info({
      scope: "API",
      msg: "rekap-daily/list",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { startIso, endIso, count: items.length },
    });

    return ok({
      items,
      recordsTotal: items.length,
      recordsFiltered: items.length,
      max: MAX_ROWS,
    });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "rekap-daily/list_err",
      at: AT,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal mengambil rekap daily report");
  }
}
