// FILE: src/app/api/check/kk/status/route.ts
import { NextRequest } from "next/server";
import { ok, err, badRequest } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import { readServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ganti sesuai alias koneksi Oracle kamu (boleh pakai ENV)
const ORACLE_ALIAS = process.env.DB_ALIAS_KK ?? "DB222";

/** Sanitasi CSV KK → hanya digit & koma, rapikan, dan buang duplikat */
function parseKkCsv(raw: unknown) {
  const s = String(raw ?? "")
    .trim()
    .replace(/^[,\s]+/, "")
    .replace(/[^\d,]/g, "")
    .replace(/,+/g, ",")
    .replace(/(^,|,$)/g, "");
  if (!s) return [];
  const list = s.split(",").map((v) => v.trim()).filter(Boolean);

  const seen = new Set<string>();
  return list.filter((v) => (seen.has(v) ? false : (seen.add(v), true)));
}

/** Bangun IN clause dinamis + binds aman */
function buildInClause(values: string[], prefix = "kk") {
  const names: string[] = [];
  const binds: Record<string, any> = {};
  values.forEach((v, i) => {
    const key = `${prefix}${i}`;
    names.push(`:${key}`);
    binds[key] = v;
  });
  return { clause: names.join(","), binds };
}

export async function GET(req: NextRequest) {
  const t0 = Date.now();

  try {
    // (opsional) jika butuh validasi sesi seperti legacy
    const session = await readServerSession();
    if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const url = new URL(req.url);
    const rawNoKk = (url.searchParams.get("noKk") || "").trim();
    const rawNoKec = (url.searchParams.get("noKec") || "").trim();

    // tanpa input KK → sama seperti legacy: view awal kosong
    if (!rawNoKk) {
      return ok({ items: [], count: 0 });
    }

    const kkList = parseKkCsv(rawNoKk);
    const isSingle = kkList.length === 1 && kkList[0].length <= 17;

    // filter kecamatan opsional
    const no_kec =
      rawNoKec === "" || rawNoKec === "0" || rawNoKec === "null"
        ? null
        : Number(rawNoKec) || null;

    const baseSql = `
      SELECT
        A.NO_KK,
        A.NAMA_KEP,
        A.ALAMAT,
        A.NO_PROP,
        A.NO_KAB,
        A.NO_KEC,
        A.NO_KEL,
        F5_GET_BSRE_KK_JML(A.NO_KK)                                   AS JML_PENGAJUAN,
        F5_GET_NAMA_KECAMATAN(A.NO_PROP,A.NO_KAB,A.NO_KEC)            AS NAMA_KEC,
        F5_GET_NAMA_KELURAHAN(A.NO_PROP,A.NO_KAB,A.NO_KEC,A.NO_KEL)   AS NAMA_KEL,
        LPAD(TO_CHAR(A.NO_RT), 3, '0') AS NO_RT,
        LPAD(TO_CHAR(A.NO_RW), 3, '0') AS NO_RW,
        CASE WHEN A.KODE_POS IS NULL THEN '-' ELSE TO_CHAR(A.KODE_POS) END AS KODE_POS,
        A.COUNT_KK,
        CASE WHEN B.CERT_STATUS IS NULL THEN '-' ELSE TO_CHAR(B.CERT_STATUS) END AS CERT_STATUS,
        CASE WHEN B.REQ_DATE IS NULL THEN '-' ELSE TO_CHAR(B.REQ_DATE,'DD-MM-YYYY') END AS REQ_DATE,
        CASE WHEN B.REQ_BY   IS NULL THEN '-' ELSE TO_CHAR(B.REQ_BY) END          AS REQ_BY,
        CASE WHEN B.URL_DOKUMEN IS NULL THEN '-' ELSE TO_CHAR(B.URL_DOKUMEN) END  AS URL_DOKUMEN,
        CASE WHEN B.URL_DOKUMEN IS NULL THEN '-' ELSE SUBSTR(B.URL_DOKUMEN,20) END AS URL_KK,
        CASE WHEN B.URL_DOKUMEN IS NULL THEN '-' ELSE SUBSTR(B.URL_DOKUMEN,11,8) END AS URL_DATE,
        CASE WHEN B.URL_DOKUMEN IS NULL THEN '-'
             ELSE 'http://10.32.73.7:8080/monitoring/pengajuan/tmpcetak/'
               || SUBSTR(B.URL_DOKUMEN,11,8) || '/'
               || SUBSTR(B.URL_DOKUMEN,20) || '.pdf'
        END AS URL_DOWNLOAD,
        CASE WHEN B.PEJABAT_PROCESS_DATE IS NULL THEN '-' ELSE TO_CHAR(B.PEJABAT_PROCESS_DATE,'DD-MM-YYYY') END AS APROVE_DATE,
        CASE WHEN C.PRINTED_DATE IS NULL THEN '-' ELSE TO_CHAR(C.PRINTED_DATE,'DD-MM-YYYY') END AS PRINTED_DATE,
        CASE WHEN C.PRINTED_BY   IS NULL THEN '-' ELSE TO_CHAR(C.PRINTED_BY) END   AS PRINTED_BY
      FROM DATA_KELUARGA A
      LEFT JOIN (
        SELECT NO_DOC, CERT_STATUS, REQ_DATE, REQ_BY, SEQN_ID, URL_DOKUMEN, PEJABAT_PROCCESS_BY, PEJABAT_PROCESS_DATE
        FROM (
          SELECT
            NO_DOC, CERT_STATUS, REQ_DATE, REQ_BY, SEQN_ID, URL_DOKUMEN, PEJABAT_PROCCESS_BY, PEJABAT_PROCESS_DATE,
            RANK() OVER (PARTITION BY NO_DOC ORDER BY REQ_DATE DESC, SEQN_ID DESC) AS RNK
          FROM BSRE_KARTU_KELUARGA
        )
        WHERE RNK = 1
      ) B ON A.NO_KK = B.NO_DOC
      LEFT JOIN (
        SELECT NO_KK, PRINTED_DATE, PRINTED_BY, SEQN_ID
        FROM (
          SELECT
            NO_KK, PRINTED_DATE, PRINTED_BY, SEQN_ID,
            RANK() OVER (PARTITION BY NO_KK ORDER BY PRINTED_DATE DESC, SEQN_ID DESC) AS RNK
          FROM T5_SEQN_PRINT_KK
        )
        WHERE RNK = 1
      ) C ON A.NO_KK = C.NO_KK
      WHERE 1=1
        AND ( :b_no_kec IS NULL OR A.NO_KEC = :b_no_kec )
    `;

    let sql = baseSql;
    let binds: Record<string, any> = { b_no_kec: no_kec };

    if (isSingle) {
      sql += ` AND TO_CHAR(A.NO_KK) = :b_no_kk `;
      binds.b_no_kk = kkList[0];
    } else {
      const { clause, binds: kkBinds } = buildInClause(kkList, "kk");
      sql += ` AND TO_CHAR(A.NO_KK) IN (${clause}) `;
      binds = { ...binds, ...kkBinds };
    }

    sql += ` ORDER BY A.NO_KEC, A.NO_KEL, A.NO_RW, A.NO_RT, A.NO_KK `;

    const rows = await execRows(sql, binds, {}, ORACLE_ALIAS);
    const items = Array.isArray(rows) ? rows : [];

    await Log.info({
      scope: "API",
      msg: "kk status served",
      at: "/api/check/kk/status",
      tookMs: Date.now() - t0,
      extra: { count: items.length, isSingle, no_kec: no_kec ?? "-" },
    });

    // kalau mau cache 30 detik: ok({ items, count: items.length }, 30)
    return ok({ items, count: items.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "kk status error",
      at: "/api/check/kk/status",
      tookMs: Date.now() - t0,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });

    const m = e?.message || "Gagal memuat status KK";
    if (/ORA-/i.test(m)) return badRequest("Query KK gagal dieksekusi. Cek parameter atau hak akses DB.");
    return err(m, 500);
  }
}
