// FILE: src/app/api/espasi/antrian-loket/route.ts

import type { NextRequest } from "next/server";

import {
  badRequest,
  err,
  ok,
  unauthorized,
} from "@/lib/http";

import {
  execOne,
  execRows,
} from "@/lib/db";

import {
  readServerSession,
} from "@/lib/session";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

/* =========================================================
   KONFIGURASI
   ========================================================= */

const ALIAS =
  "WEBDB";

const FIXED_LOKASI =
  "DISDUK";

const DEFAULT_LOKET =
  "A";

const DEFAULT_LIMIT =
  150;

const MAX_LIMIT =
  1000;

/*
 * Kode pelayanan yang digunakan
 * oleh alur legacy untuk Dinas.
 *
 * Untuk menu:
 * /loket/dinas/baru
 *
 * lokasi tetap DISDUK.
 */
const DISDUK_KODE_PELAYANAN = [
  "PERBAIKAN_AKTA",
  "PELAPORAN_LN",
  "PINDAH_KELUAR",
  "AKTA_KELAHIRAN",
  "AKTA_KEMATIAN",
  "PERBAIKAN_DATA",
  "AKTA_PERKAWINAN",
  "AKTA_PERCERAIAN",
  "KUTIPAN_KEDUA",
  "LAYANAN_WNA",
  "NON_PERMANEN",
];

/*
 * Loket yang memang tersedia
 * pada sisi Dinas.
 */
const LOKET_OPTIONS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "K",
];

/* =========================================================
   TYPES
   ========================================================= */

type EspasiUserRow = {
  USERNAME?: string;
  ROLE_NAME?: string;
  LOKASI?: string;
  LOKET?: string;
};

type QueueRow = {
  NIK?: string;
  NAMA?: string;
  KODE_PELAYANAN?: string;
  URUTAN?: string;
  STATUS_PELAYANAN?: string;
  TGL_PELAYANAN?: string;
  HARI?: string;
  TELEPON?: string;
  LOKASI?: string;
};

type EspasiAccess = {
  username: string;
  roleName: string;
  hasAccess: boolean;
  canAction: boolean;
  isAdmin: boolean;
  lokasi: string;
  loket: string;
};

/* =========================================================
   SQL USER ESPASI
   ========================================================= */

const ESPASI_USER_SQL = `
SELECT
    USERNAME,
    ROLE_NAME,
    LOKASI,
    LOKET
FROM M_ESPASI_USER@YZDB
WHERE UPPER(USERNAME) = UPPER(:b_username)
FETCH FIRST 1 ROW ONLY
`;

/* =========================================================
   HELPER
   ========================================================= */

function clean(
  value: unknown,
): string {
  return String(
    value ?? "",
  ).trim();
}

function upper(
  value: unknown,
): string {
  return clean(
    value,
  ).toUpperCase();
}

/* =========================================================
   RESOLVE ACCESS
   ========================================================= */

async function resolveAccess() {
  const sess =
    await readServerSession();

  if (!sess?.S_USER_ID) {
    return {
      error:
        unauthorized(
          "Sesi tidak ditemukan",
        ),
    };
  }

  const user =
    (await execOne(
      ESPASI_USER_SQL,
      {
        b_username:
          sess.S_USER_ID,
      },
      {},
      ALIAS,
    )) as
      | EspasiUserRow
      | null;

  /*
   * =======================================================
   * USER TIDAK ADA DI M_ESPASI_USER@YZDB
   * =======================================================
   *
   * Tetap boleh melihat.
   * Tidak boleh melakukan aksi.
   */

  if (!user) {
    return {
      sessionUser:
        sess.S_USER_ID,

      access: {
        username:
          sess.S_USER_ID,

        roleName:
          "",

        hasAccess:
          false,

        canAction:
          false,

        isAdmin:
          false,

        lokasi:
          FIXED_LOKASI,

        loket:
          DEFAULT_LOKET,
      } satisfies EspasiAccess,
    };
  }

  const roleName =
    upper(
      user.ROLE_NAME,
    );

  const dbLokasi =
    upper(
      user.LOKASI,
    );

  const dbLoket =
    upper(
      user.LOKET,
    );

  /*
   * Admin:
   * boleh memilih loket.
   *
   * Loket:
   * hanya boleh menggunakan loket
   * yang terdaftar di M_ESPASI_USER@YZDB.
   *
   * Arsip / Informasi:
   * tetap bisa melihat,
   * tetapi tidak boleh melakukan aksi.
   */
  const isAdmin =
    roleName ===
    "ADMIN";

  const isLoket =
    roleName ===
    "LOKET";

  const canAction =
    isAdmin ||
    isLoket;

  return {
    sessionUser:
      sess.S_USER_ID,

    access: {
      username:
        sess.S_USER_ID,

      roleName,

      hasAccess:
        true,

      canAction,

      isAdmin,

      lokasi:
        FIXED_LOKASI,

      loket:
        dbLoket ||
        DEFAULT_LOKET,
    } satisfies EspasiAccess,
  };
}

/* =========================================================
   BUILD SQL
   ========================================================= */

function buildQueueSql(
  status: string,
) {
  const kodeBinds =
    DISDUK_KODE_PELAYANAN.map(
      (
        _,
        index,
      ) =>
        `:b_kode_${index}`,
    ).join(
      ",",
    );

  const binds: Record<
    string,
    unknown
  > = {
    b_lokasi:
      FIXED_LOKASI,

    b_status:
      `${status}%`,
  };

  DISDUK_KODE_PELAYANAN.forEach(
    (
      value,
      index,
    ) => {
      binds[
        `b_kode_${index}`
      ] = value;
    },
  );

  /*
   * Untuk DISDUK mengikuti
   * alur legacy:
   *
   * - lokasi DISDUK
   * - status
   * - kode pelayanan Dinas
   *
   * Loket merupakan scope operasional
   * page, bukan filter URUTAN.
   */
  const sql = `
    SELECT
        A.NIK,
        A.NAMA,
        A.KODE_PELAYANAN,
        A.URUTAN,
        A.STATUS_PELAYANAN,

        TO_CHAR(
          A.TGL_PELAYANAN,
          'DD-MM-YYYY HH24:MI:SS'
        ) AS TGL_PELAYANAN,

        A.HARI,
        A.TELEPON,
        UPPER(A.LOKASI) AS LOKASI

    FROM SMSDISDUK.ANTRIAN@SMSDISDUK A

    WHERE TRUNC(
      A.TGL_PELAYANAN
    ) = TRUNC(
      SYSDATE
    )

      AND UPPER(
        A.LOKASI
      ) = :b_lokasi

      AND UPPER(
        A.STATUS_PELAYANAN
      ) LIKE :b_status

      AND UPPER(
        A.KODE_PELAYANAN
      ) IN (
        ${kodeBinds}
      )

    ORDER BY
      TO_NUMBER(
        REGEXP_REPLACE(
          A.URUTAN,
          '\\D',
          ''
        )
      ) ASC,
      A.TGL_PELAYANAN ASC
  `;

  return {
    sql,
    binds,
  };
}

/* =========================================================
   GET
   ========================================================= */

export async function GET(
  req: NextRequest,
) {
  try {
    /*
     * =====================================================
     * 1. SESSION + ACCESS
     * =====================================================
     */

    const resolved =
      await resolveAccess();

    if (
      resolved.error
    ) {
      return resolved.error;
    }

    const {
      sessionUser,
      access,
    } =
      resolved;

    /*
     * =====================================================
     * 2. PARAMETER
     * =====================================================
     */

    const url =
      new URL(
        req.url,
      );

    const requestedLoket =
      upper(
        url.searchParams.get(
          "loket",
        ),
      );

    const requestedStatus =
      upper(
        url.searchParams.get(
          "status",
        ) ||
          "BELUM",
      );

    const rawLimit =
      Number(
        url.searchParams.get(
          "limit",
        ) ||
          DEFAULT_LIMIT,
      );

    const limit =
      Number.isFinite(
        rawLimit,
      )
        ? Math.min(
            Math.max(
              Math.trunc(
                rawLimit,
              ),
              1,
            ),
            MAX_LIMIT,
          )
        : DEFAULT_LIMIT;

    /*
     * =====================================================
     * 3. VALIDASI STATUS
     * =====================================================
     */

    const allowedStatus = [
      "BELUM",
      "PENDING",
      "SUDAH",
      "MENUNGGU",
      "SELESAI",
    ];

    if (
      !allowedStatus.includes(
        requestedStatus,
      )
    ) {
      return badRequest(
        "Status antrian tidak valid",
      );
    }

    /*
     * =====================================================
     * 4. RESOLVE LOKET
     * =====================================================
     *
     * ADMIN:
     *   requestedLoket
     *
     * PETUGAS LOKET:
     *   DB M_ESPASI_USER@YZDB
     *
     * READ ONLY:
     *   boleh memilih loket untuk melihat.
     */

    let loket =
      DEFAULT_LOKET;

    if (
      access.isAdmin
    ) {
      loket =
        requestedLoket ||
        DEFAULT_LOKET;
    } else if (
      access.canAction &&
      access.roleName ===
        "LOKET"
    ) {
      loket =
        access.loket ||
        DEFAULT_LOKET;
    } else {
      /*
       * READ ONLY:
       *
       * Boleh melihat loket yang diminta.
       */
      loket =
        requestedLoket ||
        DEFAULT_LOKET;
    }

    /*
     * Pastikan loket valid.
     */
    if (
      !LOKET_OPTIONS.includes(
        loket,
      )
    ) {
      return badRequest(
        "Loket Dinas tidak valid",
      );
    }

    /*
     * =====================================================
     * 5. QUERY
     * =====================================================
     */

    const {
      sql,
      binds,
    } =
      buildQueueSql(
        requestedStatus,
      );

    const rows =
      (await execRows(
        sql,
        binds,
        {},
        ALIAS,
      )) as QueueRow[];

    /*
     * =====================================================
     * 6. LIMIT
     * =====================================================
     */

    const antrian =
      rows.slice(
        0,
        limit,
      );

    /*
     * =====================================================
     * 7. RESPONSE
     * =====================================================
     */

    return ok(
      {
        antrian,

        urutan_sekarang:
          antrian[0] ??
          null,

        total:
          rows.length,

        access: {
          username:
            sessionUser,

          roleName:
            access.roleName,

          hasAccess:
            access.hasAccess,

          canAction:
            access.canAction,

          isAdmin:
            access.isAdmin,

          lokasi:
            FIXED_LOKASI,

          loket,
        },

        meta: {
          lokasi:
            FIXED_LOKASI,

          loket,

          status:
            requestedStatus,

          readOnly:
            !access.canAction,
        },
      },
      "OK",
      rows.length,
    );
  } catch (
    e: unknown
  ) {
    return err(
      e instanceof Error
        ? e.message
        : "Gagal memuat antrian Dinas",
    );
  }
}