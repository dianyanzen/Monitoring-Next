// FILE: src/app/api/master/pemanfaatan/route.ts
import { NextRequest } from "next/server";
import { ok, badRequest, err, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ✅ Pakai alias DB: WEBDB (lihat .env / lib/oracle.ts alias map)
const ALIAS = "WEBDB";

export async function GET(req: NextRequest) {
  try {
    

    const { searchParams } = new URL(req.url);
    const start = (searchParams.get("start") || "").trim();
    const end = (searchParams.get("end") || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return badRequest("Invalid date range");
    }

    // endExclusive = end + 1 hari
    const endDate = new Date(`${end}T00:00:00`);
    endDate.setDate(endDate.getDate() + 1);
    const endExclusive = [
      endDate.getFullYear(),
      String(endDate.getMonth() + 1).padStart(2, "0"),
      String(endDate.getDate()).padStart(2, "0"),
    ].join("-");

    const whereRange = `
      (H.CREATED_AT >= TO_DATE(:b_start,'YYYY-MM-DD') AND H.CREATED_AT < TO_DATE(:b_end,'YYYY-MM-DD')) `;

    // === KUA (per kecamatan)
    const sqlKUA = `
        WITH KEC AS (
          SELECT NO_KEC, NAMA_KEC FROM SETUP_KEC
          WHERE NO_PROP = 32 AND NO_KAB = 73
        ),
        HDR AS (
          SELECT ID, JENIS_PENGAJUAN, PROC_STAT, STAT_BERKAS, CREATED_AT, UPDATED_AT, FROM_USER_ID FROM PENGAJUAN_HEADER
          UNION ALL
          SELECT ID, JENIS_PENGAJUAN, PROC_STAT, STAT_BERKAS, CREATED_AT, UPDATED_AT, FROM_USER_ID FROM PENGAJUAN_HEADER_DELETE
        ),
        U_MASTER AS (
          SELECT U.ID, U.NIK, U.NO_KK, U.TELEPON, U.NAME, U.SIAK_USER, U.EMAIL, U.PASSWORD, U.PIC,
                U.API_TOKEN, U.ANDROID_TOKEN, U.IOS_TOKEN, U.DEVICE_ID, U.REMEMBER_TOKEN,
                U.VERIFICATION_CODE, U.IS_VERIFIED, U.NO_KEC,
                U.CREATED_AT, U.UPDATED_AT, U.DELETED_AT, U.NAMA_INSTANSI,
                K.NAMA_KEC
            FROM USERS U
            JOIN KEC K ON K.NO_KEC = U.NO_KEC
          WHERE U.NO_KEC IS NOT NULL
            AND UPPER(TRIM(U.NAMA_INSTANSI)) LIKE 'KUA%'
        ),
        CNT AS (
          SELECT H.FROM_USER_ID AS NIK,
                SUM(CASE WHEN H.PROC_STAT = 1 THEN 1 ELSE 0 END) AS BARU,
                SUM(CASE WHEN H.PROC_STAT = 2 AND H.STAT_BERKAS IS NULL     THEN 1 ELSE 0 END) AS MELENGKAPI,
                SUM(CASE WHEN H.PROC_STAT = 2 AND H.STAT_BERKAS IS NOT NULL THEN 1 ELSE 0 END) AS BATAL,
                SUM(CASE WHEN H.PROC_STAT = 3 THEN 1 ELSE 0 END) AS SUDAH_DIVERIFIKASI,
                SUM(CASE WHEN H.PROC_STAT = 4 THEN 1 ELSE 0 END) AS SELESAI,
                COUNT(*) AS JUMLAH
            FROM HDR H
          WHERE ${whereRange}
          GROUP BY H.FROM_USER_ID
        )
        SELECT
          'KUA' AS KATEGORI,
          NVL('KUA '||K.NAMA_KEC,'-') AS NAMA_INSTANSI,
          K.NO_KEC AS NOKEC,
          NULL AS NOKEL,
          NVL(M.NIK,'-') AS NIK,
          NVL(M.NAME,'-') AS USER_NAME,
          NVL(C.BARU,0) AS BARU,
          NVL(C.MELENGKAPI,0) AS MELENGKAPI,
          NVL(C.BATAL,0) AS BATAL,
          NVL(C.SUDAH_DIVERIFIKASI,0) AS SUDAH_DIVERIFIKASI,
          NVL(C.SELESAI,0) AS SELESAI,
          NVL(C.JUMLAH,0) AS JUMLAH
        FROM (SELECT NO_KEC, NAMA_KEC FROM SETUP_KEC WHERE NO_PROP=32 AND NO_KAB=73) K
        LEFT JOIN U_MASTER M ON K.NO_KEC = M.NO_KEC
        LEFT JOIN CNT C ON C.NIK = M.NIK
        ORDER BY K.NO_KEC, M.NAME
      `;

      // === KELURAHAN (Pelita Hati)
      const sqlKel = `
        WITH KEL AS (
          SELECT NO_KEC, NO_KEL, NAMA_KEL FROM SETUP_KEL
          WHERE NO_PROP = 32 AND NO_KAB = 73
        ),
        HDR AS (
          SELECT ID, JENIS_PENGAJUAN, PROC_STAT, STAT_BERKAS, CREATED_AT, UPDATED_AT, FROM_USER_ID FROM PENGAJUAN_HEADER
          UNION ALL
          SELECT ID, JENIS_PENGAJUAN, PROC_STAT, STAT_BERKAS, CREATED_AT, UPDATED_AT, FROM_USER_ID FROM PENGAJUAN_HEADER_DELETE
        ),
        U_MASTER AS (
          SELECT U.ID, U.NIK, U.NO_KK, U.TELEPON, U.NAME, U.SIAK_USER, U.EMAIL, U.PASSWORD, U.PIC,
                U.API_TOKEN, U.ANDROID_TOKEN, U.IOS_TOKEN, U.DEVICE_ID, U.REMEMBER_TOKEN,
                U.VERIFICATION_CODE, U.IS_VERIFIED, U.NO_KEC, U.NO_KEL,
                U.CREATED_AT, U.UPDATED_AT, U.DELETED_AT, U.NAMA_INSTANSI,
                K.NAMA_KEL
            FROM USERS U
            JOIN KEL K ON K.NO_KEC = U.NO_KEC AND K.NO_KEL = U.NO_KEL
          WHERE U.NO_KEC IS NOT NULL
            AND U.NO_KEL IS NOT NULL
            AND UPPER(TRIM(U.NAMA_INSTANSI)) LIKE 'KELURAHAN%'
        ),
        CNT AS (
          SELECT H.FROM_USER_ID AS NIK,
                SUM(CASE WHEN H.PROC_STAT = 1 THEN 1 ELSE 0 END) AS BARU,
                SUM(CASE WHEN H.PROC_STAT = 2 AND H.STAT_BERKAS IS NULL     THEN 1 ELSE 0 END) AS MELENGKAPI,
                SUM(CASE WHEN H.PROC_STAT = 2 AND H.STAT_BERKAS IS NOT NULL THEN 1 ELSE 0 END) AS BATAL,
                SUM(CASE WHEN H.PROC_STAT = 3 THEN 1 ELSE 0 END) AS SUDAH_DIVERIFIKASI,
                SUM(CASE WHEN H.PROC_STAT = 4 THEN 1 ELSE 0 END) AS SELESAI,
                COUNT(*) AS JUMLAH
            FROM HDR H
          WHERE ${whereRange}
          GROUP BY H.FROM_USER_ID
        )
        SELECT
          'KELURAHAN' AS KATEGORI,
          NVL('KELURAHAN '||K.NAMA_KEL,'-') AS NAMA_INSTANSI,
          K.NO_KEC AS NOKEC,
          K.NO_KEL AS NOKEL,
          NVL(M.NIK,'-') AS NIK,
          NVL(M.NAME,'-') AS USER_NAME,
          NVL(C.BARU,0) AS BARU,
          NVL(C.MELENGKAPI,0) AS MELENGKAPI,
          NVL(C.BATAL,0) AS BATAL,
          NVL(C.SUDAH_DIVERIFIKASI,0) AS SUDAH_DIVERIFIKASI,
          NVL(C.SELESAI,0) AS SELESAI,
          NVL(C.JUMLAH,0) AS JUMLAH
        FROM (SELECT * FROM SETUP_KEL WHERE NO_PROP||NO_KAB='3273') K
        LEFT JOIN U_MASTER M ON K.NO_KEC = M.NO_KEC AND K.NO_KEL = M.NO_KEL
        LEFT JOIN CNT C ON C.NIK = M.NIK
        ORDER BY K.NO_KEC, K.NO_KEL, M.NAME
      `;

      // === Template kategori berbasis role
      const makeSqlRole = (roleName: string, kategoriOut: string, extraWhereInstansi = "") => `
        WITH U AS (
          SELECT A.ID, A.NIK, A.NO_KK, A.TELEPON, A.NAME, A.EMAIL, A.NAMA_INSTANSI, C.NAME AS KATEGORI
            FROM USERS A
            JOIN MODEL_HAS_ROLES B ON A.ID = B.MODEL_ID
            JOIN ROLES C          ON B.ROLE_ID = C.ID
          WHERE C.NAME = '${roleName}'
            AND A.NAMA_INSTANSI IS NOT NULL
            AND A.DELETED_AT IS NULL
            ${extraWhereInstansi}
        ),
        HDR AS (
          SELECT ID, JENIS_PENGAJUAN, PROC_STAT, STAT_BERKAS, CREATED_AT, UPDATED_AT, FROM_USER_ID FROM PENGAJUAN_HEADER
          UNION ALL
          SELECT ID, JENIS_PENGAJUAN, PROC_STAT, STAT_BERKAS, CREATED_AT, UPDATED_AT, FROM_USER_ID FROM PENGAJUAN_HEADER_DELETE
        ),
        CNT AS (
          SELECT H.FROM_USER_ID AS NIK,
                SUM(CASE WHEN H.PROC_STAT = 1 THEN 1 ELSE 0 END) AS BARU,
                SUM(CASE WHEN H.PROC_STAT = 2 AND H.STAT_BERKAS IS NULL     THEN 1 ELSE 0 END) AS MELENGKAPI,
                SUM(CASE WHEN H.PROC_STAT = 2 AND H.STAT_BERKAS IS NOT NULL THEN 1 ELSE 0 END) AS BATAL,
                SUM(CASE WHEN H.PROC_STAT = 3 THEN 1 ELSE 0 END) AS SUDAH_DIVERIFIKASI,
                SUM(CASE WHEN H.PROC_STAT = 4 THEN 1 ELSE 0 END) AS SELESAI,
                COUNT(*) AS JUMLAH
            FROM HDR H
          WHERE ${whereRange}
          GROUP BY H.FROM_USER_ID
        )
        SELECT
          '${kategoriOut}' AS KATEGORI,
          U.NAMA_INSTANSI AS NAMA_INSTANSI,
          NULL AS NOKEC,
          NULL AS NOKEL,
          NVL(U.NIK,'-')   AS NIK,
          NVL(U.NAME,'-')  AS USER_NAME,
          NVL(C.BARU,0)                AS BARU,
          NVL(C.MELENGKAPI,0)          AS MELENGKAPI,
          NVL(C.BATAL,0)               AS BATAL,
          NVL(C.SUDAH_DIVERIFIKASI,0)  AS SUDAH_DIVERIFIKASI,
          NVL(C.SELESAI,0)             AS SELESAI,
          NVL(C.JUMLAH,0)              AS JUMLAH
        FROM U
        LEFT JOIN CNT C ON C.NIK = U.NIK
        ORDER BY U.NAMA_INSTANSI
      `;

    const sqlBidan   = makeSqlRole("PELANA","BIDAN","AND A.NAMA_INSTANSI LIKE '%BIDAN%'");
    const sqlRS      = makeSqlRole("PELANA","PELANA RS","AND (A.NAMA_INSTANSI LIKE '%RS %' OR A.NAMA_INSTANSI LIKE '%RSU %'  OR A.NAMA_INSTANSI LIKE '%RSUD %' OR A.NAMA_INSTANSI LIKE '%RSB %' OR A.NAMA_INSTANSI LIKE '%RSUP %') ");
    const sqlKlinik  = makeSqlRole("PELANA","PELANA KLINIK","AND A.NAMA_INSTANSI LIKE '%KLINIK%'");
    const sqlPuskesmas = makeSqlRole("PELANA","PELANA PUSKESMAS","AND A.NAMA_INSTANSI LIKE '%PUSKESMAS%'");
    const sqlPaduka  = makeSqlRole("PELITA HATI","PADUKA", "AND A.NAMA_INSTANSI NOT LIKE '%KELURAHAN%'");
    const sqlHotline = makeSqlRole("Salaman Hotline", "HOTLINE");
    const sqlSiapPA  = makeSqlRole("SIAP PA","SIAP PA", "AND A.NAMA_INSTANSI NOT LIKE '%KUA%'");

    const binds = { b_start: start, b_end: endExclusive } as const;

    // ⬇️ Pakai alias WEBDB di setiap execRows
    const [kua, kel, bidan, rs, klinik, puskesmas, paduka, hotline, siap] = await Promise.all([
      execRows(sqlKUA, binds, {}, ALIAS),
      execRows(sqlKel, binds, {}, ALIAS),
      execRows(sqlBidan, binds, {}, ALIAS),
      execRows(sqlRS, binds, {}, ALIAS),
      execRows(sqlKlinik, binds, {}, ALIAS),
      execRows(sqlPuskesmas, binds, {}, ALIAS),
      execRows(sqlPaduka, binds, {}, ALIAS),
      execRows(sqlHotline, binds, {}, ALIAS),
      execRows(sqlSiapPA, binds, {}, ALIAS),
    ]);

    const data = [
      ...(kua ?? []),
      ...(kel ?? []),
      ...(bidan ?? []),
      ...(rs ?? []),
      ...(klinik ?? []),
      ...(puskesmas ?? []),
      ...(paduka ?? []),
      ...(hotline ?? []),
      ...(siap ?? []),
    ];

    return ok(data, "OK", 0);
  } catch (e: any) {
    return err(e?.message || "Gagal memuat pemanfaatan");
  }
}
