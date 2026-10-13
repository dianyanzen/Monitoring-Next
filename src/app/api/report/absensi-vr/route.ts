import { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";
const AT = "/api/report/absensi-vr";

type Row = {
  DAILY_ID: number;
  USER_ID: string;
  NAMA_LGKP: string;
  ACTIVITY: string;
  DESCRIPTION: string;
  CREATED_DT_ISO: string;
  CREATED_DT_DMY: string;
  IS_VALID: number;
};

const toStr = (v: unknown) => (v == null ? "" : String(v).trim());

const isoToDMY = (iso?: string) => {
  if (!iso || iso.split("-").length !== 3) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

function normalizeDate(raw: unknown, fallback?: string) {
  const value = toStr(raw);
  if (!value) return fallback ?? null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split("-");
    return `${yyyy}-${mm}-${dd}`;
  }
  return fallback ?? null;
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
function isoMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();

  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const startIso = normalizeDate(body.start, isoMonthStart());
    const endIso = normalizeDate(body.end, isoToday());
    const userId = toStr(body.userId ?? "0");
    const status = toStr(body.status ?? body.stat_ver ?? "3"); // 3 = all

    if (startIso && endIso) {
      const s = new Date(startIso);
      const e = new Date(endIso);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || s > e) {
        return badRequest("Rentang tanggal tidak valid");
      }
    }

    const filters: string[] = [
      "A.CREATED_DT >= TO_DATE(:b_start, 'YYYY-MM-DD')",
      "A.CREATED_DT < TO_DATE(:b_end, 'YYYY-MM-DD') + 1",
    ];
    const binds: Record<string, string> = { b_start: startIso!, b_end: endIso! };

    if (status !== "" && status !== "3") {
      binds.b_status = status;
      filters.push("A.IS_VALID = :b_status");
    }
    if (userId && userId !== "0") {
      binds.b_user_id = userId;
      filters.push("A.USER_ID = :b_user_id");
    }

    const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const rows = await execRows<Row>(
      `
      SELECT
        A.DAILY_ID,
        A.USER_ID,
        NVL(B.NAMA_LGKP, '-') AS NAMA_LGKP,
        NVL(C.ACTIVITY, 'LAINNYA') AS ACTIVITY,
        NVL(A.DESCRIPTION, '-') AS DESCRIPTION,
        TO_CHAR(A.CREATED_DT, 'YYYY-MM-DD') AS CREATED_DT_ISO,
        TO_CHAR(A.CREATED_DT, 'DD-MM-YYYY') AS CREATED_DT_DMY,
        NVL(A.IS_VALID, 0) AS IS_VALID
      FROM SIAK_DAILY A
      INNER JOIN SIAK_ACTIVITY C ON A.ACTIVITY_ID = C.ACTIVITY_ID
      INNER JOIN SIAK_USER_PLUS B ON A.USER_ID = B.USER_ID
      ${whereSql}
      ORDER BY A.CREATED_DT DESC, A.DAILY_ID DESC
      `,
      binds,
      {},
      ORACLE_ALIAS
    );

    const items = rows.map((row, idx) => {
      const tanggalIso = toStr(row.CREATED_DT_ISO);
      return {
        id: Number(row.DAILY_ID ?? idx + 1),
        userId: toStr(row.USER_ID),
        nama: toStr(row.NAMA_LGKP),
        activity: toStr(row.ACTIVITY),
        description: toStr(row.DESCRIPTION),
        tanggal: tanggalIso,
        tanggalLabel: toStr(row.CREATED_DT_DMY) || isoToDMY(tanggalIso),
        status: Number(row.IS_VALID ?? 0), // 0 menunggu, 1 setuju, 2 tolak
      };
    });

    await Log.info({
      scope: "API",
      msg: "absensi-vr/list",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { startIso, endIso, status, userId, count: items.length },
    });

    return ok({
      items,
      recordsTotal: items.length,
      recordsFiltered: items.length,
    });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "absensi-vr/list_err",
      at: AT,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal memuat data verifikasi daily report");
  }
}

