// app/api/messages/previews/route.ts
import { readServerSession } from "@/lib/session";
import { execOne, execRows } from "@/lib/db";
import { ok, badRequest, unauthorized, err } from "@/lib/http";
import { Log } from "@/lib/log";

type Row = {
  USER_ID: string;
  NAMA_LGKP: string;
  NIK: string | number;
  IS_ACTIVE: "Online" | "Offline";
  IS_COLOR: string;
  TYPE_MSG: string;
  TEXT: string | null;
  READ: string | number | null;
  JML: number | string | null;
  CREATED_AT: string | null;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  try {
    // ✅ Pakai helper resmi; tidak parse manual cookie (menghindari "Format cookie sesi tidak valid")
    const s = await readServerSession();
    if (!s?.S_NIK) return unauthorized("Sesi tidak valid (NIK kosong)");

    const nik = String(s.S_NIK);

    // ✳️ SQL ASLI — TIDAK DIUBAH
    const sqlCount = `
      SELECT COUNT(DISTINCT FROM_ID) AS JML
      FROM MESSAGES
      WHERE TO_ID = :b_nik AND READ = 0
    `;
    const countRow = await execOne<{ JML?: number | string }>(sqlCount, { b_nik: nik }, {}, "DB");
    const unreadCount = Number(countRow?.JML ?? 0);
    if (unreadCount === 0) {
      await Log.info({ scope: "API", msg: "Previews none", at: "/api/messages/previews", user: nik, tookMs: Date.now() - t0 });
      return ok({ count: 0, items: [] });
    }

    // ✳️ SQL ASLI — TIDAK DIUBAH
    const sqlMessages = `
      SELECT
        A.USER_ID,
        INITCAP(A.NAMA_LGKP) AS NAMA_LGKP,
        A.NIK,
        CASE
          WHEN B.IS_ACTIVE IS NOT NULL
            AND TRUNC(B.LAST_ACTIVITY) = TRUNC(SYSDATE)
          THEN 'Online' ELSE 'Offline'
        END AS IS_ACTIVE,
        CASE
          WHEN B.IS_ACTIVE IS NOT NULL
            AND TRUNC(B.LAST_ACTIVITY) = TRUNC(SYSDATE)
          THEN 'text-success' ELSE 'text-muted'
        END AS IS_COLOR,
        C.TYPE_MSG,
        /* Paksa potongan CLOB → VARCHAR2 max 120 char */
        CASE
          WHEN C.TEXT IS NULL THEN NULL
          WHEN DBMS_LOB.GETLENGTH(C.TEXT) > 120
            THEN DBMS_LOB.SUBSTR(C.TEXT, 120, 1) || ' ...'
          ELSE DBMS_LOB.SUBSTR(C.TEXT, 120, 1)
        END AS TEXT,
        NVL(C.READ, '0') AS READ,
        NVL(C.JML, 0) AS JML,
        CASE
          WHEN C.CREATED_AT IS NULL THEN NULL
          WHEN TRUNC(C.CREATED_AT) = TRUNC(SYSDATE)     THEN TO_CHAR(C.CREATED_AT, 'HH24:MI')
          WHEN TRUNC(C.CREATED_AT) = TRUNC(SYSDATE - 1) THEN 'Yesterday'
          WHEN TRUNC(C.CREATED_AT) > TRUNC(SYSDATE - 7) THEN TO_CHAR(C.CREATED_AT, 'FMDay')
          ELSE TO_CHAR(C.CREATED_AT, 'DD/MM/YYYY')
        END AS CREATED_AT
      FROM SIAK_USER_PLUS A
      /* LEFT JOIN supaya user tetap tampil meski tidak ada baris sesi */
      LEFT JOIN SIAK_SESSION_PLUS B ON A.USER_ID = B.USER_ID
      INNER JOIN (
        /* Ambil pesan terakhir per thread (SOURCE_MSG = FROM||TO) mengarah ke :b_nik */
        SELECT
          ID, TYPE_MSG, SOURCE_NIK, SOURCE_MSG,
          DELETED_FROM, DELETED_TO,
          TEXT, READ, CREATED_AT, UPDATED_AT, OPR_READ,
          /* unread count per pengirim → target :b_nik */
          (
            SELECT COUNT(1)
            FROM MESSAGES X
            WHERE X.READ   = 0
              AND X.FROM_ID = A.SOURCE_NIK
              AND X.TO_ID   = TO_CHAR(:b_nik)
          ) AS JML
        FROM (
          SELECT
            ID, TYPE_MSG, SOURCE_NIK, SOURCE_MSG,
            DELETED_FROM, DELETED_TO,
            TEXT, READ, CREATED_AT, UPDATED_AT, OPR_READ,
            RANK() OVER (
              PARTITION BY SOURCE_MSG
              ORDER BY CREATED_AT DESC, UPDATED_AT DESC, ID DESC
            ) AS RNK
          FROM (
            SELECT
              ID,
              'Receive' AS TYPE_MSG,
              FROM_ID   AS SOURCE_NIK,
              FROM_ID || TO_ID AS SOURCE_MSG,
              DELETED_FROM, DELETED_TO,
              TEXT, READ, CREATED_AT, UPDATED_AT, OPR_READ
            FROM MESSAGES
            WHERE TO_ID = TO_CHAR(:b_nik)
          )
        ) A
        WHERE RNK = 1
      ) C
        ON TO_CHAR(A.NIK) = C.SOURCE_NIK
      WHERE TO_CHAR(A.NIK) <> TO_CHAR(:b_nik)
      ORDER BY C.CREATED_AT DESC NULLS LAST, A.NAMA_LGKP
    `;

    const rows = await execRows<Row>(sqlMessages, { b_nik: nik }, {}, "DB");

    const items = rows.map((r) => ({
      nik: String(r.NIK),
      name: r.NAMA_LGKP,
      text: r.TEXT ?? "",
      status: r.IS_ACTIVE,
      statusColor: r.IS_COLOR,
      unread: Number(r.JML ?? 0),
      createdAt: r.CREATED_AT ?? "",
      avatarUrl: `/assets/upload/pp/${r.NIK}.jpg`,
    }));

    await Log.info({
      scope: "API",
      msg: "Previews ok",
      at: "/api/messages/previews",
      user: nik,
      tookMs: Date.now() - t0,
      extra: { count: unreadCount, items: items.length },
    });

    return ok({ count: unreadCount, items });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "Previews failed",
      at: "/api/messages/previews",
      tookMs: Date.now() - t0,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e), stack: e?.stack },
    });
    return err("Terjadi kesalahan server");
  }
}
