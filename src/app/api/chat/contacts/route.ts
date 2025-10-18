// FILE: src/app/api/chat/contacts/route.ts
import { ok, err, badRequest } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import { readServerSession } from "@/lib/session";

function toPlain(obj: any) {
  if (!obj) return obj;
  if (Array.isArray(obj))
    return obj.map((x) => toPlain(x));
  if (typeof obj === "object") {
    const plain: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) plain[k] = v;
      else if (["string", "number", "boolean"].includes(typeof v)) plain[k] = v;
    }
    return plain;
  }
  return obj;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  try {
    const s = await readServerSession();
    const sNik = s?.S_NIK;
    if (!sNik) return badRequest("Sesi tidak valid: S_NIK tidak ditemukan.");

    const b_nik = Number(sNik);
    if (isNaN(b_nik)) return badRequest("Format NIK tidak valid (bukan angka).");

    const sql = `
      SELECT A.USER_ID, INITCAP(A.NAMA_LGKP) NAMA_LGKP, A.NIK
            , CASE WHEN B.IS_ACTIVE IS NOT NULL AND TRUNC(B.LAST_ACTIVITY) = TRUNC(SYSDATE) THEN 'Online' ELSE 'Offline' END IS_ACTIVE
            , CASE WHEN B.IS_ACTIVE IS NOT NULL AND TRUNC(B.LAST_ACTIVITY) = TRUNC(SYSDATE) THEN 'text-success' ELSE 'text-muted' END IS_COLOR
            , TYPE_MSG
            , CASE WHEN C.TEXT IS NULL THEN NULL
               WHEN LENGTH(C.TEXT) >= 20 THEN SUBSTR(C.TEXT,0,20) || ' ...'
                 ELSE C.TEXT END TEXT
            , CASE WHEN C.READ IS NULL THEN '0' ELSE C.READ END READ
            , CASE WHEN C.JML IS NULL THEN 0 ELSE C.JML END JML
            , CASE 
                WHEN C.CREATED_AT IS NULL THEN NULL 
                WHEN TRUNC(C.CREATED_AT) = TRUNC(SYSDATE) THEN  TO_CHAR(C.CREATED_AT,'HH24:MI') 
                WHEN TRUNC(C.CREATED_AT) = TRUNC(SYSDATE-1) THEN  'Yesterday' 
                WHEN TRUNC(C.CREATED_AT) < TRUNC(SYSDATE-1) AND TRUNC(C.CREATED_AT) > TRUNC(SYSDATE-7)  THEN  TO_CHAR(C.CREATED_AT,'Day') 
                ELSE TO_CHAR(C.CREATED_AT,'DD/MM/YYYY') 
              END CREATED_AT
            FROM SIAK_USER_PLUS A 
            LEFT JOIN SIAK_SESSION_PLUS B ON A.USER_ID = B.USER_ID 
            LEFT JOIN 
                (SELECT ID, TYPE_MSG, SOURCE_NIK, SOURCE_MSG, DELETED_FROM, DELETED_TO, TEXT, READ, CREATED_AT, UPDATED_AT, OPR_READ, (SELECT COUNT(1) FROM MESSAGES X WHERE X.READ = 0 AND X.FROM_ID = A.SOURCE_NIK AND X.TO_ID = :b_nik ) JML FROM(  
                SELECT  ID, TYPE_MSG, SOURCE_NIK, SOURCE_MSG, DELETED_FROM, DELETED_TO, TEXT, READ, CREATED_AT, UPDATED_AT, OPR_READ, RANK() OVER (PARTITION BY SOURCE_MSG ORDER BY CREATED_AT DESC,UPDATED_AT DESC, ID DESC) RNK FROM 
                (SELECT ID, TYPE_MSG, SOURCE_NIK, SOURCE_MSG, DELETED_FROM, DELETED_TO, TEXT, READ, CREATED_AT, UPDATED_AT, OPR_READ, RNK FROM 
                (SELECT ID, 'Receive' TYPE_MSG, FROM_ID SOURCE_NIK, FROM_ID||TO_ID SOURCE_MSG, DELETED_FROM, DELETED_TO, TEXT, READ, CREATED_AT, UPDATED_AT, OPR_READ, RANK() OVER (PARTITION BY FROM_ID ORDER BY CREATED_AT DESC,UPDATED_AT DESC, ID DESC) RNK FROM MESSAGES WHERE TO_ID = :b_nik) 
                UNION ALL
                (SELECT ID, 'Sent' TYPE_MSG, TO_ID SOURCE_NIK,TO_ID||FROM_ID SOURCE_MSG, DELETED_FROM, DELETED_TO, TEXT, READ, CREATED_AT, UPDATED_AT, OPR_READ, RANK() OVER (PARTITION BY TO_ID ORDER BY CREATED_AT DESC,UPDATED_AT DESC, ID DESC) RNK FROM MESSAGES WHERE FROM_ID = :b_nik))) A WHERE RNK =1) C ON A.NIK = C.SOURCE_NIK
            WHERE A.NIK <> :b_nik
            ORDER BY C.CREATED_AT DESC NULLS LAST, NAMA_LGKP
    `;

    const rawRows = await execRows(sql, { b_nik }, {}, "DB");
    const rows = Array.isArray(rawRows) ? toPlain(rawRows) : [];

    const data = rows.map((r: any) => ({
      id: String(r.NIK),
      name: String(r.NAMA_LGKP ?? "-"),
      avatar: null,
      lastMessage: r.TEXT ?? null,
      unread: Number(r.JML ?? 0),
      typeMsg:
        r.TYPE_MSG === "Sent"
          ? "Sent"
          : r.TYPE_MSG === "Receive"
          ? "Receive"
          : null,
      isActive: r.IS_ACTIVE === "Online" ? "Online" : "Offline",
      isColor: String(r.IS_COLOR ?? "text-muted"),
      createdAtLabel: r.CREATED_AT_LABEL ?? null,
    }));

    await Log.info({
      scope: "API",
      msg: "contacts served",
      at: "/api/chat/contacts",
      tookMs: Date.now() - t0,
      extra: { rowCount: data.length },
      binds: { b_nik },
    });

    // kirim data aman (tanpa struktur circular)
    return ok(toPlain(data));
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "contacts error",
      at: "/api/chat/contacts",
      tookMs: Date.now() - t0,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal memuat kontak", 500);
  }
}
