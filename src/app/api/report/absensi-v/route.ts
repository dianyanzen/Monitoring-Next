import { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";
const AT = "/api/report/absensi-v";

type VerifikasiRow = {
  DAILY_ID: number;
  USER_ID: string;
  NAMA_LGKP: string;
  ACTIVITY: string;
  DESCRIPTION: string;
  CREATED_DT_ISO: string;
  CREATED_DT_DMY: string;
  IS_VALID: number;
  VERIVIKATOR?: string;
};

const toStr = (v: unknown) => (v == null ? "" : String(v).trim());

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

    // Optional future filters; currently none are required.
    const body = await req.json().catch(() => ({}));
    const { start, end } = body || {};
    const userId = toStr(session.S_USER_ID);

    const filters: string[] = ["A.IS_VALID = 0", "(B.VERIVIKATOR = :b_user OR A.USER_ID = :b_user)"];
    const binds: Record<string, string> = { b_user: userId };

    if (start) {
      binds.b_start = toStr(start);
      filters.push("A.CREATED_DT >= TO_DATE(:b_start, 'YYYY-MM-DD')");
    }
    if (end) {
      binds.b_end = toStr(end);
      filters.push("A.CREATED_DT < TO_DATE(:b_end, 'YYYY-MM-DD') + 1");
    }

    const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const rows = await execRows<VerifikasiRow>(
      `
      SELECT
        A.DAILY_ID,
        A.USER_ID,
        NVL(B.NAMA_LGKP, '-') AS NAMA_LGKP,
        NVL(C.ACTIVITY, 'LAINNYA') AS ACTIVITY,
        NVL(A.DESCRIPTION, '-') AS DESCRIPTION,
        TO_CHAR(A.CREATED_DT, 'YYYY-MM-DD') AS CREATED_DT_ISO,
        TO_CHAR(A.CREATED_DT, 'DD-MM-YYYY') AS CREATED_DT_DMY,
        NVL(A.IS_VALID, 0) AS IS_VALID,
        B.VERIVIKATOR
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

    const items = rows.map((row) => {
      const tanggalIso = toStr(row.CREATED_DT_ISO);
      return {
        id: Number(row.DAILY_ID),
        userId: toStr(row.USER_ID),
        nama: toStr(row.NAMA_LGKP),
        activity: toStr(row.ACTIVITY),
        description: toStr(row.DESCRIPTION),
        tanggal: tanggalIso,
        tanggalLabel: toStr(row.CREATED_DT_DMY) || isoToDMY(tanggalIso),
        isValid: Number(row.IS_VALID ?? 0),
        isSelf: toStr(row.USER_ID) === userId,
      };
    });

    await Log.info({
      scope: "API",
      msg: "absensi-v/list",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { count: items.length },
    });

    return ok({
      items,
      recordsTotal: items.length,
      recordsFiltered: items.length,
    });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "absensi-v/list_err",
      at: AT,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat data verifikasi daily report");
  }
}
