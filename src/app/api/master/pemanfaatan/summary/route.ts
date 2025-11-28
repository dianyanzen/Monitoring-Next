// FILE: src/app/api/master/pemanfaatan/summary/route.ts
import { NextRequest } from "next/server";
import { ok, badRequest, err, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALIAS = "WEBDB";

export async function GET(req: NextRequest) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const { searchParams } = new URL(req.url);
    const start = (searchParams.get("start") || "").trim();
    const end = (searchParams.get("end") || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return badRequest("Invalid date range");
    }

    // endExclusive = end + 1 day
    const e = new Date(`${end}T00:00:00`);
    e.setDate(e.getDate() + 1);
    const endExclusive = [
      e.getFullYear(),
      String(e.getMonth() + 1).padStart(2, "0"),
      String(e.getDate()).padStart(2, "0"),
    ].join("-");

    const whereRange = `
      (H.CREATED_AT >= TO_DATE(:b_start,'YYYY-MM-DD') AND H.CREATED_AT < TO_DATE(:b_end,'YYYY-MM-DD')) `;

    const sql = `
      /* =========================
         SUM PEMANFAATAN PER KATEGORI
         Output kolom:
           - KATEGORI (key konsisten untuk frontend)
           - BARU, MELENGKAPI, BATAL, SUDAH_DIVERIFIKASI, SELESAI, JUMLAH
           - TOTAL_INSTANSI (optional, untuk info)
         ========================= */
      WITH
      HDR AS (
        SELECT ID, JENIS_PENGAJUAN, PROC_STAT, STAT_BERKAS, CREATED_AT, UPDATED_AT, FROM_USER_ID
          FROM PENGAJUAN_HEADER
        UNION ALL
        SELECT ID, JENIS_PENGAJUAN, PROC_STAT, STAT_BERKAS, CREATED_AT, UPDATED_AT, FROM_USER_ID
          FROM PENGAJUAN_HEADER_DELETE
      ),
      CNT AS (
        SELECT H.FROM_USER_ID AS NIK,
               SUM(CASE WHEN H.PROC_STAT = 1 THEN 1 ELSE 0 END) AS BARU,
               SUM(CASE WHEN H.PROC_STAT = 2 AND H.STAT_BERKAS IS NULL     THEN 1 ELSE 0 END) AS MELENGKAPI,
               SUM(CASE WHEN H.PROC_STAT = 2 AND H.STAT_BERKAS IS NOT NULL THEN 1 ELSE 0 END) AS BATAL,
               SUM(CASE WHEN H.PROC_STAT = 3 THEN 1 ELSE 0 END) AS SUDAH_DIVERIFIKASI,
               SUM(CASE WHEN H.PROC_STAT IN (3,4) THEN 1 ELSE 0 END) AS SELESAI,
               COUNT(*) AS JUMLAH
        FROM HDR H
        WHERE ${whereRange}
        GROUP BY H.FROM_USER_ID
      ),
      /* === Mapping user per kategori === */
      U_KELURAHAN AS (
        SELECT U.NIK
        FROM USERS U
        WHERE U.NO_KEC IS NOT NULL
          AND U.NO_KEL IS NOT NULL
          AND UPPER(TRIM(U.NAMA_INSTANSI)) LIKE 'KELURAHAN%'
          AND U.DELETED_AT IS NULL
      ),
      U_KUA AS (
        SELECT U.NIK
        FROM USERS U
        WHERE U.NO_KEC IS NOT NULL
          AND UPPER(TRIM(U.NAMA_INSTANSI)) LIKE 'KUA%'
          AND U.DELETED_AT IS NULL
      ),
      U_BIDAN AS (
        SELECT A.NIK
        FROM USERS A
        JOIN MODEL_HAS_ROLES B ON A.ID = B.MODEL_ID
        JOIN ROLES C ON B.ROLE_ID = C.ID
        WHERE C.NAME = 'BIDAN' AND A.NAMA_INSTANSI IS NOT NULL AND A.DELETED_AT IS NULL
      ),
      U_RS AS (
        SELECT A.NIK
        FROM USERS A
        JOIN MODEL_HAS_ROLES B ON A.ID = B.MODEL_ID
        JOIN ROLES C ON B.ROLE_ID = C.ID
        WHERE C.NAME = 'RUMAH SAKIT' AND A.NAMA_INSTANSI IS NOT NULL AND A.DELETED_AT IS NULL
      ),
      U_PADUKA AS (
        SELECT A.NIK
        FROM USERS A
        JOIN MODEL_HAS_ROLES B ON A.ID = B.MODEL_ID
        JOIN ROLES C ON B.ROLE_ID = C.ID
        WHERE C.NAME = 'PADUKA' AND A.NAMA_INSTANSI IS NOT NULL AND A.DELETED_AT IS NULL
              AND A.NAMA_INSTANSI NOT LIKE '%KELURAHAN%'
      ),
      U_HOTLINE AS (
        SELECT A.NIK
        FROM USERS A
        JOIN MODEL_HAS_ROLES B ON A.ID = B.MODEL_ID
        JOIN ROLES C ON B.ROLE_ID = C.ID
        WHERE C.NAME = 'Salaman Hotline' AND A.NAMA_INSTANSI IS NOT NULL AND A.DELETED_AT IS NULL
      ),
      U_SIAPPA AS (
        SELECT A.NIK
        FROM USERS A
        JOIN MODEL_HAS_ROLES B ON A.ID = B.MODEL_ID
        JOIN ROLES C ON B.ROLE_ID = C.ID
        WHERE C.NAME = 'SIAP PA' AND A.NAMA_INSTANSI IS NOT NULL AND A.DELETED_AT IS NULL
              AND A.NAMA_INSTANSI NOT LIKE '%KUA%'
      ),
      /* === aggregator helper === */
      S_KELURAHAN AS (
        SELECT 'KELURAHAN' AS KATEGORI,
               COUNT(*) AS TOTAL_INSTANSI,
               SUM(NVL(C.BARU,0)) AS BARU,
               SUM(NVL(C.MELENGKAPI,0)) AS MELENGKAPI,
               SUM(NVL(C.BATAL,0)) AS BATAL,
               SUM(NVL(C.SUDAH_DIVERIFIKASI,0)) AS SUDAH_DIVERIFIKASI,
               SUM(NVL(C.SELESAI,0)) AS SELESAI,
               SUM(NVL(C.JUMLAH,0)) AS JUMLAH
        FROM U_KELURAHAN U LEFT JOIN CNT C ON C.NIK = U.NIK
      ),
      S_KUA AS (
        SELECT 'KUA' AS KATEGORI,
               COUNT(*) AS TOTAL_INSTANSI,
               SUM(NVL(C.BARU,0)) AS BARU,
               SUM(NVL(C.MELENGKAPI,0)) AS MELENGKAPI,
               SUM(NVL(C.BATAL,0)) AS BATAL,
               SUM(NVL(C.SUDAH_DIVERIFIKASI,0)) AS SUDAH_DIVERIFIKASI,
               SUM(NVL(C.SELESAI,0)) AS SELESAI,
               SUM(NVL(C.JUMLAH,0)) AS JUMLAH
        FROM U_KUA U LEFT JOIN CNT C ON C.NIK = U.NIK
      ),
      S_BIDAN AS (
        SELECT 'BIDAN' AS KATEGORI,
               COUNT(*) AS TOTAL_INSTANSI,
               SUM(NVL(C.BARU,0)) AS BARU,
               SUM(NVL(C.MELENGKAPI,0)) AS MELENGKAPI,
               SUM(NVL(C.BATAL,0)) AS BATAL,
               SUM(NVL(C.SUDAH_DIVERIFIKASI,0)) AS SUDAH_DIVERIFIKASI,
               SUM(NVL(C.SELESAI,0)) AS SELESAI,
               SUM(NVL(C.JUMLAH,0)) AS JUMLAH
        FROM U_BIDAN U LEFT JOIN CNT C ON C.NIK = U.NIK
      ),
      S_RS AS (
        SELECT 'RUMAH SAKIT' AS KATEGORI,
               COUNT(*) AS TOTAL_INSTANSI,
               SUM(NVL(C.BARU,0)) AS BARU,
               SUM(NVL(C.MELENGKAPI,0)) AS MELENGKAPI,
               SUM(NVL(C.BATAL,0)) AS BATAL,
               SUM(NVL(C.SUDAH_DIVERIFIKASI,0)) AS SUDAH_DIVERIFIKASI,
               SUM(NVL(C.SELESAI,0)) AS SELESAI,
               SUM(NVL(C.JUMLAH,0)) AS JUMLAH
        FROM U_RS U LEFT JOIN CNT C ON C.NIK = U.NIK
      ),
      S_PADUKA AS (
        SELECT 'PADUKA' AS KATEGORI,  -- ⟵ kunci untuk frontend
               COUNT(*) AS TOTAL_INSTANSI,
               SUM(NVL(C.BARU,0)) AS BARU,
               SUM(NVL(C.MELENGKAPI,0)) AS MELENGKAPI,
               SUM(NVL(C.BATAL,0)) AS BATAL,
               SUM(NVL(C.SUDAH_DIVERIFIKASI,0)) AS SUDAH_DIVERIFIKASI,
               SUM(NVL(C.SELESAI,0)) AS SELESAI,
               SUM(NVL(C.JUMLAH,0)) AS JUMLAH
        FROM U_PADUKA U LEFT JOIN CNT C ON C.NIK = U.NIK
      ),
      S_HOTLINE AS (
        SELECT 'HOTLINE' AS KATEGORI,
               COUNT(*) AS TOTAL_INSTANSI,
               SUM(NVL(C.BARU,0)) AS BARU,
               SUM(NVL(C.MELENGKAPI,0)) AS MELENGKAPI,
               SUM(NVL(C.BATAL,0)) AS BATAL,
               SUM(NVL(C.SUDAH_DIVERIFIKASI,0)) AS SUDAH_DIVERIFIKASI,
               SUM(NVL(C.SELESAI,0)) AS SELESAI,
               SUM(NVL(C.JUMLAH,0)) AS JUMLAH
        FROM U_HOTLINE U LEFT JOIN CNT C ON C.NIK = U.NIK
      ),
      S_SIAPPA AS (
        SELECT 'SIAP PA' AS KATEGORI, -- ⟵ kunci untuk frontend
               COUNT(*) AS TOTAL_INSTANSI,
               SUM(NVL(C.BARU,0)) AS BARU,
               SUM(NVL(C.MELENGKAPI,0)) AS MELENGKAPI,
               SUM(NVL(C.BATAL,0)) AS BATAL,
               SUM(NVL(C.SUDAH_DIVERIFIKASI,0)) AS SUDAH_DIVERIFIKASI,
               SUM(NVL(C.SELESAI,0)) AS SELESAI,
               SUM(NVL(C.JUMLAH,0)) AS JUMLAH
        FROM U_SIAPPA U LEFT JOIN CNT C ON C.NIK = U.NIK
      )
      SELECT * FROM S_KELURAHAN
      UNION ALL SELECT * FROM S_KUA
      UNION ALL SELECT * FROM S_SIAPPA
      UNION ALL SELECT * FROM S_BIDAN
      UNION ALL SELECT * FROM S_RS
      UNION ALL SELECT * FROM S_PADUKA
      UNION ALL SELECT * FROM S_HOTLINE
    `;

    const rows = await execRows(
      sql,
      { b_start: start, b_end: endExclusive },
      {},
      ALIAS
    );

    // bentuk respons ramah-frontend (urutkan sesuai ORDER_KEYS di FE)
    const ORDER_KEYS = [
      "KELURAHAN",
      "KUA",
      "SIAP PA",
      "BIDAN",
      "RUMAH SAKIT",
      "PADUKA",
      "HOTLINE",
    ];

    const map = new Map<string, any>();
    (rows ?? []).forEach((r: any) => map.set(r.KATEGORI, r));
    const data = ORDER_KEYS.map((k) => ({
      kategori: k,
      ...(map.get(k) ?? {
        TOTAL_INSTANSI: 0,
        BARU: 0,
        MELENGKAPI: 0,
        BATAL: 0,
        SUDAH_DIVERIFIKASI: 0,
        SELESAI: 0,
        JUMLAH: 0,
      }),
    }));

    return ok(data, "OK", data.length);
  } catch (e: any) {
    return err(e?.message || "Gagal memuat ringkasan pemanfaatan per kategori");
  }
}
