// FILE: src/app/api/report/absensi/init/route.ts
import { readServerSession } from "@/lib/session";
import { ok, unauthorized, err } from "@/lib/http";
import { execOne } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";

type OnlineRow = {
  USER_ID: string;
  USER_SIAK: string;
  MONEV_LAST: string;
  MONEV_IP: string;
  SIAK_LAST: string;
  SIAK_IP: string;
};

type ClockRow = {
  JML: string;
};

export async function GET() {
  const started = Date.now();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();

    const userId = String(sess.S_USER_ID);

    // === 1) data online SIAK + Monitoring (porting is_online) ===
    const sqlOnline = `
      SELECT *
      FROM (
        SELECT
          A.USER_ID,
          CASE WHEN A.USER_SIAK IS NULL THEN '-' ELSE A.USER_SIAK END AS USER_SIAK,
          CASE
            WHEN TO_CHAR(B.LAST_ACTIVITY, 'DD-MM-YYYY HH24:MI:SS') IS NULL
            THEN '-'
            ELSE TO_CHAR(B.LAST_ACTIVITY, 'DD-MM-YYYY HH24:MI:SS')
          END AS MONEV_LAST,
          CASE WHEN B.IP_ADDRESS IS NULL THEN '-' ELSE B.IP_ADDRESS END AS MONEV_IP,
          CASE
            WHEN C.LAST_ACTIVITY IS NULL THEN '-'
            ELSE TO_CHAR(
              TO_DATE('1970-01-01','YYYY-MM-DD')
              + NUMTODSINTERVAL(TO_CHAR(C.LAST_ACTIVITY), 'SECOND')
              + 7/24,
              'DD-MM-YYYY HH24:MI:SS'
            )
          END AS SIAK_LAST,
          CASE WHEN C.IP_ADDRESS IS NULL THEN '-' ELSE C.IP_ADDRESS END AS SIAK_IP
        FROM SIAK_USER_PLUS A
        LEFT JOIN SIAK_SESSION_PLUS B ON A.USER_ID = B.USER_ID
        LEFT JOIN T5_SESSION@DB222 C ON A.USER_SIAK = C.USER_ID
        WHERE A.USER_ID = :b_user_id
        ORDER BY C.LAST_ACTIVITY DESC NULLS LAST
      )
      WHERE ROWNUM = 1
    `;

    const online = await execOne<OnlineRow>(
      sqlOnline,
      { b_user_id: userId },
      {},
      ORACLE_ALIAS
    );

    // === 2) clock in (porting get_clockin) ===
    const sqlClockIn = `
      SELECT
        CASE WHEN JAM_MASUK IS NULL THEN '-' ELSE JAM_MASUK END AS JML
      FROM SIAK_USER_PLUS A
      LEFT JOIN SIAK_ABSENSI B
        ON A.USER_ID = B.USER_ID
       AND TO_CHAR(B.TANGGAL,'DD/MM/YYYY') = TO_CHAR(SYSDATE,'DD/MM/YYYY')
      WHERE A.USER_ID = :b_user_id
    `;
    const clockInRow = await execOne<ClockRow>(
      sqlClockIn,
      { b_user_id: userId },
      {},
      ORACLE_ALIAS
    );

    // === 3) clock out (porting get_clockout) ===
    const sqlClockOut = `
      SELECT
        CASE WHEN JAM_KELUAR IS NULL THEN '-' ELSE JAM_KELUAR END AS JML
      FROM SIAK_USER_PLUS A
      LEFT JOIN SIAK_ABSENSI B
        ON A.USER_ID = B.USER_ID
       AND TO_CHAR(B.TANGGAL,'DD/MM/YYYY') = TO_CHAR(SYSDATE,'DD/MM/YYYY')
      WHERE A.USER_ID = :b_user_id
    `;
    const clockOutRow = await execOne<ClockRow>(
      sqlClockOut,
      { b_user_id: userId },
      {},
      ORACLE_ALIAS
    );

    return ok({
      clock_in: clockInRow?.JML ?? "-",
      clock_out: clockOutRow?.JML ?? "-",
      user_siak: online?.USER_SIAK ?? "-",
      user_id: online?.USER_ID ?? userId,
      monev_last: online?.MONEV_LAST ?? "-",
      monev_ip: online?.MONEV_IP ?? "-",
      siak_last: online?.SIAK_LAST ?? "-",
      siak_ip: online?.SIAK_IP ?? "-",
    });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "ABSENSI_INIT",
      at: "/api/report/absensi/init",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal memuat data awal absensi");
  }
}
