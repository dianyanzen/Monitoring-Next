// FILE: src/app/api/check/kk/status/route.ts
import { ok, err, badRequest } from "@/lib/http";
import { execRows } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Replikasi legacy: scr_cek_kk($no_kk, $no_kec)
 * - Input:
 *   - noKk  : string (boleh 1 KK atau CSV "kk1,kk2,..."; leading/trailing comma akan dibersihkan)
 *   - noKec : string/number opsional (default: null) → filter A.NO_KEC
 *
 * Catatan:
 * - Tidak ada konversi Number() untuk KK (biarkan string).
 * - Pakai teknik CSV → REGEXP_SUBSTR untuk IN-list aman (single bind).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawNoKk = (url.searchParams.get("noKk") || "").trim();
  const noKec = (url.searchParams.get("noKec") || "").trim() || null;

  // jika kosong → sama seperti legacy: view awal tanpa data
  if (!rawNoKk) return ok({ items: [], count: 0 });

  // normalisasi: hilangkan koma di awal/akhir dan koma ganda
  const noKkNorm = rawNoKk.replace(/^\s*,+/, "").replace(/,+\s*$/, "").replace(/,{2,}/g, ",");

  // jika tanpa koma dan panjang ≤ 17 → anggap single KK (mengikuti legacy)
  const isSingle = !noKkNorm.includes(",") && noKkNorm.length <= 17;
  const b_no_kk = isSingle ? noKkNorm : null;
  const b_no_kk_csv = isSingle ? null : noKkNorm;

  try {
    const sql = `
      SELECT
        A.NO_KK,
        A.NAMA_KEP,
        A.ALAMAT,
        A.NO_PROP,
        A.NO_KAB,
        A.NO_KEC,
        A.NO_KEL,
        F5_GET_BSRE_KK_JML(A.NO_KK)         AS JML_PENGAJUAN,
        F5_GET_NAMA_KECAMATAN(A.NO_PROP,A.NO_KAB,A.NO_KEC)            AS NAMA_KEC,
        F5_GET_NAMA_KELURAHAN(A.NO_PROP,A.NO_KAB,A.NO_KEC,A.NO_KEL)   AS NAMA_KEL,
        LPAD(TO_CHAR(A.NO_RT), 3, '0')       AS NO_RT,
        LPAD(TO_CHAR(A.NO_RW), 3, '0')       AS NO_RW,
        CASE WHEN A.KODE_POS IS NULL THEN '-' ELSE TO_CHAR(A.KODE_POS) END AS KODE_POS,
        A.COUNT_KK,
        CASE WHEN B.CERT_STATUS IS NULL THEN '-' ELSE TO_CHAR(B.CERT_STATUS) END AS CERT_STATUS,
        CASE WHEN B.REQ_DATE IS NULL THEN '-' ELSE TO_CHAR(B.REQ_DATE,'DD-MM-YYYY') END AS REQ_DATE,
        CASE WHEN B.REQ_BY   IS NULL THEN '-' ELSE TO_CHAR(B.REQ_BY) END          AS REQ_BY,
        CASE WHEN B.URL_DOKUMEN IS NULL THEN '-' ELSE TO_CHAR(B.URL_DOKUMEN) END  AS URL_DOKUMEN,
        CASE WHEN B.URL_DOKUMEN IS NULL THEN '-' ELSE SUBSTR(B.URL_DOKUMEN,20) END AS URL_KK,
        CASE WHEN B.URL_DOKUMEN IS NULL THEN '-' ELSE SUBSTR(B.URL_DOKUMEN,11,8) END AS URL_DATE,
        CASE WHEN B.URL_DOKUMEN IS NULL THEN '-'
             ELSE 'http://10.32.73.7:8080/monitoring/pengajuan/tmpcetak/' || SUBSTR(B.URL_DOKUMEN,11,8) || '/' || SUBSTR(B.URL_DOKUMEN,20) || '.pdf'
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
        AND (
          :b_no_kk IS NULL OR A.NO_KK = :b_no_kk
          OR (
            :b_no_kk_csv IS NOT NULL AND TO_CHAR(A.NO_KK) IN (
              SELECT TRIM(REGEXP_SUBSTR(:b_no_kk_csv, '[^,]+', 1, LEVEL))
              FROM DUAL
              CONNECT BY REGEXP_SUBSTR(:b_no_kk_csv, '[^,]+', 1, LEVEL) IS NOT NULL
            )
          )
        )
      ORDER BY A.NO_KEC, A.NO_KEL, A.NO_RW, A.NO_RT, A.NO_KK
    `;

    const rows = await execRows(sql, {
      b_no_kec: noKec,
      b_no_kk: b_no_kk,
      b_no_kk_csv: b_no_kk_csv,
    });

    return ok({ items: rows, count: rows.length });
  } catch (e: any) {
    if (String(e?.message || "").includes("ORA-")) {
      return badRequest("Query KK gagal dieksekusi. Cek parameter atau hak akses DB.");
    }
    return err(e?.message || "Gagal memuat status KK", { scope: "API/CHECK_KK_STATUS" });
  }
}
