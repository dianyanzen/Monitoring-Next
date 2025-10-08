import { NextResponse } from "next/server";
import { withConnection } from "@/lib/oracle";
import { cookies } from "next/headers";

export async function GET() {
  try {
    // 1) Ambil cookie
    const cookieStore = cookies(); // <-- jangan pakai await
    const sessionRaw = cookieStore.get("session_user")?.value;
    if (!sessionRaw) return NextResponse.json({ count: 0, items: [] }, { status: 401 });

    // 2) Parse session
    let sessionData: any;
    try {
      sessionData = JSON.parse(sessionRaw);
    } catch {
      return NextResponse.json({ count: 0, items: [] }, { status: 400 });
    }
    const nik = String(sessionData?.S_NIK ?? "");
    if (!nik || nik === "0") return NextResponse.json({ count: 0, items: [] }, { status: 401 });

    // 3) Count unread (aman)
    const sqlCount = `
      SELECT COUNT(DISTINCT FROM_ID) AS JML
      FROM MESSAGES
      WHERE TO_ID = :nik AND READ = 0
    `;
    const rowsCount = await withConnection("DB", async (conn) => {
      const res = await conn.execute(sqlCount, { nik }, {
        outFormat: (conn as any).oracledb?.OUT_FORMAT_OBJECT ?? undefined,
      });
      if (!res || !Array.isArray(res.rows)) return [];
      return res.rows.map((r: any) => ({ ...r }));
    });
    const unreadCount = rowsCount.length > 0 ? Number(rowsCount[0].JML ?? 0) : 0;
    if (unreadCount === 0) return NextResponse.json({ count: 0, items: [] });

    // 4) Ambil previews — PAKSA TEXT jadi VARCHAR agar tidak CLOB
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
          /* ⬇️ Pastikan TEXT bertipe VARCHAR2 (bukan CLOB) */
          CASE
            WHEN C.TEXT IS NULL THEN NULL
            WHEN DBMS_LOB.GETLENGTH(C.TEXT) >= 20
              THEN DBMS_LOB.SUBSTR(C.TEXT, 20, 1) || ' ...'
            ELSE DBMS_LOB.SUBSTR(C.TEXT, 4000, 1)
          END AS TEXT,
          NVL(C.READ, '0') AS READ,
          NVL(C.JML, 0)  AS JML,
          CASE
            WHEN C.CREATED_AT IS NULL THEN NULL
            WHEN TRUNC(C.CREATED_AT) = TRUNC(SYSDATE)     THEN TO_CHAR(C.CREATED_AT, 'HH24:MI')
            WHEN TRUNC(C.CREATED_AT) = TRUNC(SYSDATE - 1) THEN 'Yesterday'
            WHEN TRUNC(C.CREATED_AT) < TRUNC(SYSDATE - 1)
            AND TRUNC(C.CREATED_AT) > TRUNC(SYSDATE - 7) THEN TO_CHAR(C.CREATED_AT, 'Day')
            ELSE TO_CHAR(C.CREATED_AT, 'DD/MM/YYYY')
          END AS CREATED_AT
        FROM SIAK_USER_PLUS A
        INNER JOIN SIAK_SESSION_PLUS B ON A.USER_ID = B.USER_ID
        INNER JOIN (
          SELECT
            ID, TYPE_MSG, SOURCE_NIK, SOURCE_MSG,
            DELETED_FROM, DELETED_TO,
            TEXT, READ, CREATED_AT, UPDATED_AT, OPR_READ,
            /* unread count per pengirim → target :nik */
            (
              SELECT COUNT(1)
              FROM MESSAGES X
              WHERE X.READ   = 0
                AND X.FROM_ID = A.SOURCE_NIK
                AND X.TO_ID   = TO_CHAR(:nik)
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
              WHERE TO_ID = TO_CHAR(:nik)
            )
          ) A
          WHERE RNK = 1
        ) C
          ON TO_CHAR(A.NIK) = C.SOURCE_NIK
        WHERE TO_CHAR(A.NIK) <> TO_CHAR(:nik)
        ORDER BY C.CREATED_AT DESC NULLS LAST, A.NAMA_LGKP
    `;

    const rows = await withConnection("DB", async (conn) => {
      const res = await conn.execute(sqlMessages, { nik }, {
        outFormat: (conn as any).oracledb?.OUT_FORMAT_OBJECT ?? undefined,
        // (opsional) paksa TEXT ditangani sebagai STRING juga dari driver:
        // fetchInfo: { TEXT: { type: (conn as any).oracledb.STRING } },
      });
      if (!res || !Array.isArray(res.rows)) return [];
      // salin jadi plain object
      return res.rows.map((r: any) => ({ ...r }));
    });

    const items = rows.map((r: any) => ({
      nik: r.NIK,
      name: r.NAMA_LGKP,
      text: r.TEXT ?? "",
      status: r.IS_ACTIVE,
      statusColor: r.IS_COLOR,
      unread: Number(r.JML ?? 0),
      createdAt: r.CREATED_AT ?? "",
      avatarUrl: `/assets/upload/pp/${r.NIK}.jpg`,
    }));

    return NextResponse.json({ count: unreadCount, items });

  } catch (e: any) {
    console.error("🔥 Error di get_kontak_notif:", e);
    return NextResponse.json({ count: 0, items: [], error: e.message }, { status: 500 });
  }
}
