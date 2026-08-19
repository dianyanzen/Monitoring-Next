// FILE: src/app/api/espasi/[...legacy]/route.ts

import { NextResponse, type NextRequest } from "next/server";
import {
  badRequest,
  err,
  forbidden,
  ok,
  unauthorized,
} from "@/lib/http";
import {
  execDml,
  execOne,
  execRows,
} from "@/lib/db";
import {
  ESPASI_DB_ALIAS,
  ensureSession,
} from "@/lib/espasi/api";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   CONFIG
   ========================================================= */

const LIMIT_DEFAULT = 15;
const LIMIT_MAX = 1000;

/*
 * Layanan yang tetap dipakai oleh logic legacy DISDUK.
 *
 * Jangan diubah tanpa memastikan mapping bisnis
 * layanan -> loket pada database.
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
 * Role yang dianggap administrator.
 *
 * Selain ADMIN, user dianggap sebagai user biasa/loket
 * dan wajib mengikuti mapping M_ESPASI_USER@YZDB.
 */
const ADMIN_ROLE = "ADMIN";

/* =========================================================
   TYPES
   ========================================================= */

type LegacyParams = {
  legacy?: string[];
};

type InboundSms = {
  telepon: string;
  message: string;
  serverModem: number;
};

type EspasiUserRow = {
  USERNAME?: string;
  NAME?: string;
  ROLE_NAME?: string;
  LOKET?: string;
  LOKASI?: string;
};

type EspasiAccess = {
  username: string;
  name: string;
  roleName: string;
  lokasi: string;
  loket: string;
  isAdmin: boolean;
};

type SessionAuth = Awaited<
  ReturnType<typeof ensureSession>
>;

/* =========================================================
   RESPONSE
   ========================================================= */

function legacyJson(
  data: unknown,
  status = 200,
) {
  return NextResponse.json(
    data,
    { status },
  );
}

/* =========================================================
   LEGACY TRANSFORM
   ========================================================= */

function toLegacyRow<
  T extends Record<string, any>,
>(
  row: T,
): Record<string, any> {
  const out: Record<
    string,
    any
  > = {};

  for (
    const [
      key,
      value,
    ] of Object.entries(
      row ?? {},
    )
  ) {
    out[
      key.toLowerCase()
    ] = value;
  }

  return out;
}

function toLegacyRows<
  T extends Record<string, any>,
>(
  rows: T[],
) {
  return rows.map(
    (row) =>
      toLegacyRow(row),
  );
}

/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function pathKey(
  params: LegacyParams,
) {
  return (
    params.legacy ?? []
  )
    .map((v) =>
      String(
        v || "",
      ).trim(),
    )
    .filter(Boolean);
}

function getNum(
  q: URLSearchParams,
  key: string,
  fallback: number,
  max = LIMIT_MAX,
) {
  const n = Number(
    q.get(key) ??
      fallback,
  );

  if (
    !Number.isFinite(n) ||
    n <= 0
  ) {
    return fallback;
  }

  return Math.min(
    Math.trunc(n),
    max,
  );
}

function normUpper(
  v:
    | string
    | null
    | undefined,
) {
  return String(
    v || "",
  )
    .trim()
    .toUpperCase();
}

function fmtOracleDate(
  d: Date,
) {
  const y =
    d.getFullYear();

  const m =
    `${d.getMonth() + 1}`
      .padStart(2, "0");

  const da =
    `${d.getDate()}`
      .padStart(2, "0");

  const hh =
    `${d.getHours()}`
      .padStart(2, "0");

  const mm =
    `${d.getMinutes()}`
      .padStart(2, "0");

  const ss =
    `${d.getSeconds()}`
      .padStart(2, "0");

  return `${y}-${m}-${da} ${hh}:${mm}:${ss}`;
}

function hariId(
  d: Date,
) {
  const map: Record<
    number,
    string
  > = {
    0: "MINGGU",
    1: "SENIN",
    2: "SELASA",
    3: "RABU",
    4: "KAMIS",
    5: "JUMAT",
    6: "SABTU",
  };

  return (
    map[d.getDay()] ??
    "SENIN"
  );
}

/* =========================================================
   SMS HELPERS
   ========================================================= */

function sanitizeMessage(
  v: unknown,
) {
  return String(
    v || "",
  )
    .replace(
      /[^a-zA-Z0-9 #_]/g,
      "",
    )
    .toUpperCase()
    .trim();
}

function normalizePhone(
  raw: unknown,
) {
  let p =
    String(
      raw || "",
    ).trim();

  if (!p) {
    return "";
  }

  p = p.replace(
    /@c\.us$/i,
    "",
  );

  if (
    p.startsWith("+62")
  ) {
    return p;
  }

  if (
    p.startsWith("62")
  ) {
    return `+${p}`;
  }

  if (
    p.startsWith("08")
  ) {
    return `+62${p.slice(
      1,
    )}`;
  }

  if (
    p.startsWith("8")
  ) {
    return `+62${p}`;
  }

  return p;
}

function parseInboundSms(
  body: any,
  fallbackServer = 1,
): InboundSms {
  const payload =
    body?.payload ??
    null;

  if (
    payload &&
    typeof payload ===
      "object"
  ) {
    return {
      telepon:
        normalizePhone(
          payload.from,
        ),

      message:
        sanitizeMessage(
          payload.body,
        ),

      serverModem:
        Number(
          payload.serverModem ??
            fallbackServer,
        ) ||
        fallbackServer,
    };
  }

  return {
    telepon:
      normalizePhone(
        body?.telepon ??
          body?.from ??
          body?.sender,
      ),

    message:
      sanitizeMessage(
        body?.message ??
          body?.isi_pesan ??
          body?.text,
      ),

    serverModem:
      Number(
        body?.serverModem ??
          body?.modem ??
          fallbackServer,
      ) ||
      fallbackServer,
  };
}

function normalizeLayananCode(
  raw: string,
) {
  const key =
    String(raw || "")
      .toUpperCase()
      .replace(
        /[^A-Z0-9]/g,
        "",
      );

  const map: Record<
    string,
    string
  > = {
    AKTAKELAHIRAN:
      "AKTA_KELAHIRAN",

    AKTAKEMATIAN:
      "AKTA_KEMATIAN",

    AKTAPERKAWINAN:
      "AKTA_PERKAWINAN",

    AKTAPERCERAIAN:
      "AKTA_PERCERAIAN",

    PERBAIKANDATA:
      "PERBAIKAN_DATA",

    PERBAIKANAKTA:
      "PERBAIKAN_AKTA",

    PINDAHKELUAR:
      "PINDAH_KELUAR",

    PELAPORANLN:
      "PELAPORAN_LN",

    KUTIPANKEDUA:
      "KUTIPAN_KEDUA",

    LAYANANWNA:
      "LAYANAN_WNA",

    NONPERMANEN:
      "NON_PERMANEN",
  };

  return (
    map[key] ??
    key
  );
}

/* =========================================================
   ESPASI ACCESS CONTROL
   ========================================================= */

/*
 * Satu sumber kebenaran untuk:
 *
 *   Session
 *       ↓
 *   S_USER_ID
 *       ↓
 *   M_ESPASI_USER@YZDB
 *       ↓
 *   ROLE_NAME / LOKASI / LOKET
 *
 * User Loket:
 *   lokasi + loket berasal dari DB.
 *
 * Admin:
 *   lokasi + loket boleh dipilih dari request.
 */
async function resolveEspasiAccess(
  auth: SessionAuth,
) {
  if (
    auth.error ||
    !auth.session?.S_USER_ID
  ) {
    return null;
  }

  const username =
    String(
      auth.session.S_USER_ID,
    ).trim();

  if (!username) {
    return null;
  }

  const row =
    await execOne<EspasiUserRow>(
      `
      SELECT
        USERNAME,
        NAME,
        ROLE_NAME,
        LOKET,
        LOKASI
      FROM M_ESPASI_USER@YZDB
      WHERE UPPER(USERNAME) =
            UPPER(:b_username)
      FETCH FIRST 1 ROW ONLY
      `,
      {
        b_username:
          username,
      },
      {},
      ESPASI_DB_ALIAS,
    );

  if (!row) {
    return null;
  }

  const roleName =
    normUpper(
      row.ROLE_NAME,
    );

  return {
    username:
      String(
        row.USERNAME ??
          username,
      ).trim(),

    name:
      String(
        row.NAME ?? "",
      ).trim(),

    roleName,

    lokasi:
      normUpper(
        row.LOKASI,
      ),

    loket:
      normUpper(
        row.LOKET,
      ),

    isAdmin:
      roleName ===
      ADMIN_ROLE,
  } satisfies EspasiAccess;
}

/*
 * Menentukan scope lokasi/loket yang boleh digunakan
 * oleh endpoint antrean.
 *
 * ADMIN:
 *   menggunakan request.
 *
 * LOKET:
 *   request diabaikan dan menggunakan DB.
 */
async function resolveLoketScope(
  auth: SessionAuth,
  requestedLokasi:
    | string
    | null
    | undefined,
  requestedLoket:
    | string
    | null
    | undefined,
) {
  if (
    auth.error ||
    !auth.session?.S_USER_ID
  ) {
    return {
      error:
        unauthorized(
          "Unauthorized",
        ),
    };
  }

  const access =
    await resolveEspasiAccess(
      auth,
    );

  if (!access) {
    await Log.warn({
      scope: "API",
      msg:
        "ESPASI user tidak terdaftar",
      user:
        auth.session
          ?.S_USER_ID,
      extra: {
        resource:
          "M_ESPASI_USER@YZDB",
      },
    });

    return {
      error:
        forbidden(
          "User tidak terdaftar pada M_ESPASI_USER@YZDB",
        ),
    };
  }

  /*
   * ADMIN
   *
   * Boleh memilih lokasi dan loket.
   */
  if (
    access.isAdmin
  ) {
    const lokasi =
      normUpper(
        requestedLokasi,
      );

    const loket =
      normUpper(
        requestedLoket,
      );

    if (!lokasi) {
      return {
        error:
          badRequest(
            "Parameter lokasi wajib diisi",
          ),
      };
    }

    if (!loket) {
      return {
        error:
          badRequest(
            "Parameter loket wajib diisi",
          ),
      };
    }

    return {
      access,
      lokasi,
      loket,
    };
  }

  /*
   * USER LOKET
   *
   * Browser TIDAK dipercaya.
   *
   * Nilai dari M_ESPASI_USER@YZDB menjadi
   * sumber kebenaran.
   */
  if (
    !access.lokasi ||
    !access.loket
  ) {
    await Log.warn({
      scope: "API",
      msg:
        "ESPASI mapping lokasi/loket belum lengkap",
      user:
        access.username,
      extra: {
        roleName:
          access.roleName,
        lokasi:
          access.lokasi,
        loket:
          access.loket,
      },
    });

    return {
      error:
        forbidden(
          "Mapping lokasi/loket user belum lengkap",
        ),
    };
  }

  return {
    access,

    lokasi:
      access.lokasi,

    loket:
      access.loket,
  };
}

/* =========================================================
   SMS DB
   ========================================================= */

async function insertInboxLog(
  telepon: string,
  isiPesan: string,
  serverModem: number,
) {
  await execDml(
    `
    INSERT INTO INBOX_LOG
      (
        TELEPON,
        ISI_PESAN,
        TANGGAL_SMS,
        SERVER
      )
    VALUES
      (
        :b_telepon,
        :b_pesan,
        SYSTIMESTAMP,
        :b_server
      )
    `,
    {
      b_telepon:
        telepon,

      b_pesan:
        isiPesan,

      b_server:
        serverModem,
    },
    {},
    ESPASI_DB_ALIAS,
  );
}

async function insertOutbox(
  telepon: string,
  isiPesan: string,
  serverModem: number,
) {
  await execDml(
    `
    INSERT INTO OUTBOX
      (
        TELEPON,
        ISI_PESAN,
        TANGGAL_SMS,
        SERVER
      )
    VALUES
      (
        :b_telepon,
        :b_pesan,
        SYSTIMESTAMP,
        :b_server
      )
    `,
    {
      b_telepon:
        telepon,

      b_pesan:
        isiPesan,

      b_server:
        serverModem,
    },
    {},
    ESPASI_DB_ALIAS,
  );
}

/* =========================================================
   QUEUE REGISTRATION
   ========================================================= */

async function processQueueRegistration(
  opts: {
    tableName:
      | "ANTRIAN"
      | "DEV_ANTRIAN";

    activeFlag:
      | 1
      | 0;

    inbound:
      InboundSms;
  },
) {
  const parts =
    opts.inbound.message
      .split("#")
      .map((v) =>
        v.trim(),
      );

  if (
    parts.length !== 3
  ) {
    const pesan =
      "Mohon cek kembali jenis format layanan anda. Contoh NAMA#NIK#JENIS_LAYANAN";

    return {
      status:
        "cek_layanan",
      pesan,
    };
  }

  const nama =
    parts[0]
      .replace(
        /[^a-zA-Z ]/g,
        "",
      )
      .trim();

  const nik =
    parts[1]
      .replace(
        /[^0-9]/g,
        "",
      )
      .trim();

  const layanan =
    normalizeLayananCode(
      parts[2],
    );

  if (
    !/^\d{16}$/.test(
      nik,
    )
  ) {
    const pesan =
      "Format NIK yang anda masukan salah.";

    return {
      status:
        "error",
      pesan,
    };
  }

  const existing =
    await execOne<{
      KODE_PELAYANAN?: string;
      URUTAN?: string;
      HARI?: string;
      JAM?: string;
      TGL?: string;
    }>(
      `
      SELECT
        KODE_PELAYANAN,
        URUTAN,
        HARI,
        TO_CHAR(JAM) AS JAM,
        TO_CHAR(
          TGL_PELAYANAN,
          'DD-MM-YYYY'
        ) AS TGL
      FROM ${opts.tableName}
      WHERE NIK = :b_nik
      ORDER BY
        TGL_PELAYANAN DESC
      FETCH FIRST 1 ROWS ONLY
      `,
      {
        b_nik:
          nik,
      },
      {},
      ESPASI_DB_ALIAS,
    );

  if (existing) {
    const pesan =
      `NIK anda masih terdaftar pada layanan ${existing.KODE_PELAYANAN || "-"}\nHari ${existing.HARI || "-"}, ${existing.TGL || "-"}\nJam ${existing.JAM || "-"}\nNomor antrian : ${existing.URUTAN || "-"}`;

    return {
      status:
        "success",
      pesan,
    };
  }

  const layananRow =
    await execOne<any>(
      `
      SELECT
        LAYANAN,
        KODE_PELAYANAN,
        LOKASI,
        KUOTA,
        JAM_AWAL,
        JAM_AKHIR,
        WAKTU_LAYANAN
      FROM DATA_LOKET
      WHERE ACTIVE = :b_active
        AND UPPER(LAYANAN) =
            :b_layanan
      FETCH FIRST 1 ROWS ONLY
      `,
      {
        b_active:
          opts.activeFlag,

        b_layanan:
          layanan,
      },
      {},
      ESPASI_DB_ALIAS,
    );

  if (!layananRow) {
    const pesan =
      "Mohon cek kembali jenis format layanan anda.";

    return {
      status:
        "cek_layanan",
      pesan,
    };
  }

  const kuota =
    Number(
      layananRow.KUOTA ??
        0,
    ) || 1;

  const waktuLayanan =
    Number(
      layananRow.WAKTU_LAYANAN ??
        300,
    ) || 300;

  const lokasi =
    String(
      layananRow.LOKASI ||
        "DISDUK",
    ).toUpperCase();

  const kodePelayanan =
    String(
      layananRow.KODE_PELAYANAN ||
        "A",
    ).toUpperCase();

  const last =
    await execOne<{
      MAX_NO?: number;
      LAST_TS?: string;
    }>(
      `
      SELECT
        NVL(
          MAX(
            TO_NUMBER(
              REGEXP_REPLACE(
                URUTAN,
                '\\D',
                ''
              )
            )
          ),
          0
        ) AS MAX_NO,

        TO_CHAR(
          MAX(TGL_PELAYANAN),
          'YYYY-MM-DD HH24:MI:SS'
        ) AS LAST_TS

      FROM ${opts.tableName}

      WHERE UPPER(LOKASI) =
            :b_lokasi

        AND UPPER(URUTAN) LIKE
            :b_prefix

        AND TRUNC(
              TGL_PELAYANAN
            ) =
            TRUNC(SYSDATE)
      `,
      {
        b_lokasi:
          lokasi,

        b_prefix:
          `${kodePelayanan}%`,
      },
      {},
      ESPASI_DB_ALIAS,
    );

  let nextNo =
    Number(
      last?.MAX_NO ??
        0,
    ) + 1;

  let tgl =
    new Date();

  if (
    last?.LAST_TS
  ) {
    const parsed =
      new Date(
        last.LAST_TS.replace(
          " ",
          "T",
        ),
      );

    if (
      !Number.isNaN(
        parsed.getTime(),
      )
    ) {
      tgl =
        new Date(
          parsed.getTime() +
            waktuLayanan *
              1000,
        );
    }
  } else {
    tgl =
      new Date();

    tgl.setDate(
      tgl.getDate() +
        1,
    );
  }

  if (
    nextNo >
    kuota
  ) {
    nextNo = 1;

    tgl =
      new Date();

    tgl.setDate(
      tgl.getDate() +
        1,
    );
  }

  const jamAwal =
    String(
      layananRow.JAM_AWAL ||
        "08:00:00",
    );

  const [
    hh,
    mm,
    ss,
  ] =
    jamAwal
      .split(":")
      .map(
        (v) =>
          Number(v || 0),
      );

  if (
    nextNo === 1
  ) {
    tgl.setHours(
      hh,
      mm,
      ss,
      0,
    );
  }

  const urutan =
    `${kodePelayanan}${nextNo}`;

  const hari =
    hariId(tgl);

  const jam =
    `${`${tgl.getHours()}`.padStart(2, "0")}:${`${tgl.getMinutes()}`.padStart(2, "0")}:${`${tgl.getSeconds()}`.padStart(2, "0")}`;

  await execDml(
    `
    INSERT INTO ${opts.tableName}
      (
        TELEPON,
        NIK,
        NAMA,
        KODE_PELAYANAN,
        URUTAN,
        STATUS_PELAYANAN,
        TGL_PELAYANAN,
        HARI,
        JAM,
        LOKASI
      )
    VALUES
      (
        :b_telepon,
        :b_nik,
        :b_nama,
        :b_layanan,
        :b_urutan,
        'BELUM',
        TO_DATE(
          :b_tgl,
          'YYYY-MM-DD HH24:MI:SS'
        ),
        :b_hari,
        :b_jam,
        :b_lokasi
      )
    `,
    {
      b_telepon:
        opts.inbound
          .telepon,

      b_nik:
        nik,

      b_nama:
        nama,

      b_layanan:
        layanan,

      b_urutan:
        urutan,

      b_tgl:
        fmtOracleDate(
          tgl,
        ),

      b_hari:
        hari,

      b_jam:
        jam,

      b_lokasi:
        lokasi,
    },
    {},
    ESPASI_DB_ALIAS,
  );

  const jadwal =
    `${`${tgl.getDate()}`.padStart(2, "0")}-${`${tgl.getMonth() + 1}`.padStart(2, "0")}-${tgl.getFullYear()}`;

  const pesan =
    `Jadwal anda\n${hari}, ${jadwal}\nJam ${jam}\nUrutan : ${urutan}\nLoket : ${kodePelayanan}`;

  return {
    status:
      "success",

    pesan,
  };
}

/* =========================================================
   SALAMAN
   ========================================================= */

async function processSalaman(
  inbound: InboundSms,
) {
  const parts =
    inbound.message
      .split("#")
      .map((v) =>
        v.trim(),
      );

  if (
    parts.length !== 3
  ) {
    return {
      status:
        "cek_layanan",

      pesan:
        "Mohon cek kembali jenis format layanan anda. Contoh NAMA#NIK#JENIS_LAYANAN",
    };
  }

  const nik =
    parts[1]
      .replace(
        /[^0-9]/g,
        "",
      )
      .trim();

  const layanan =
    normalizeLayananCode(
      parts[2],
    );

  if (
    !/^\d{16}$/.test(
      nik,
    )
  ) {
    return {
      status:
        "error",

      pesan:
        "Mohon cek kembali NIK anda",
    };
  }

  const layananRow =
    await execOne<any>(
      `
      SELECT
        LAYANAN,
        WAKTU_LAYANAN,
        JAM_AWAL
      FROM DATA_LOKET
      WHERE ACTIVE = 0
        AND UPPER(LAYANAN) =
            :b_layanan
      FETCH FIRST 1 ROWS ONLY
      `,
      {
        b_layanan:
          layanan,
      },
      {},
      ESPASI_DB_ALIAS,
    );

  if (!layananRow) {
    return {
      status:
        "cek_layanan",

      pesan:
        "Mohon cek kembali jenis format layanan anda.",
    };
  }

  const last =
    await execOne<{
      TGL?: string;
      URUTAN?: string;
    }>(
      `
      SELECT *
      FROM (
        SELECT
          TO_CHAR(
            TGL_PENGAMBILAN,
            'YYYY-MM-DD HH24:MI:SS'
          ) AS TGL,

          TO_CHAR(
            URUTAN
          ) AS URUTAN

        FROM WEBDISDUK.HIST_PENGAMBILAN@WEBDISDUK

        WHERE ID_ANTRIAN =
              :b_layanan

        ORDER BY
          TGL_PENGAMBILAN DESC
      )
      WHERE ROWNUM = 1
      `,
      {
        b_layanan:
          layanan,
      },
      {},
      ESPASI_DB_ALIAS,
    );

  let tgl =
    new Date();

  let urutan =
    1;

  if (
    last?.TGL
  ) {
    const parsed =
      new Date(
        last.TGL.replace(
          " ",
          "T",
        ),
      );

    if (
      !Number.isNaN(
        parsed.getTime(),
      )
    ) {
      const waktuLayanan =
        Number(
          layananRow.WAKTU_LAYANAN ??
            300,
        ) || 300;

      tgl =
        new Date(
          parsed.getTime() +
            waktuLayanan *
              1000,
        );
    }

    urutan =
      (
        Number(
          last.URUTAN ??
            0,
        ) || 0
      ) + 1;
  } else {
    tgl =
      new Date();

    tgl.setDate(
      tgl.getDate() +
        1,
    );

    const jamAwal =
      String(
        layananRow.JAM_AWAL ||
          "08:00:00",
      );

    const [
      hh,
      mm,
      ss,
    ] =
      jamAwal
        .split(":")
        .map(
          (v) =>
            Number(
              v || 0,
            ),
        );

    tgl.setHours(
      hh,
      mm,
      ss,
      0,
    );
  }

  const hari =
    hariId(tgl);

  const jadwal =
    `${`${tgl.getDate()}`.padStart(2, "0")}-${`${tgl.getMonth() + 1}`.padStart(2, "0")}-${tgl.getFullYear()}`;

  const jam =
    `${`${tgl.getHours()}`.padStart(2, "0")}:${`${tgl.getMinutes()}`.padStart(2, "0")}:${`${tgl.getSeconds()}`.padStart(2, "0")}`;

  return {
    status:
      "success",

    jadwal,

    tanggal:
      `${tgl.getFullYear()}-${`${tgl.getMonth() + 1}`.padStart(2, "0")}-${`${tgl.getDate()}`.padStart(2, "0")}`,

    hari,

    jam,

    urutan,
  };
}

/* =========================================================
   SORT / PAGING
   ========================================================= */

function buildSort(
  sortRaw:
    | string
    | null,
  sortTypeRaw:
    | string
    | null,
  allowed:
    Record<
      string,
      string
    >,
  fallback: string,
) {
  const sortKey =
    String(
      sortRaw || "",
    )
      .trim()
      .toLowerCase();

  const col =
    allowed[
      sortKey
    ] ??
    fallback;

  const sortType =
    String(
      sortTypeRaw || "",
    )
      .trim()
      .toLowerCase() ===
    "desc"
      ? "DESC"
      : "ASC";

  return `${col} ${sortType}`;
}

async function queryPaged(
  opts: {
    baseSql: string;
    binds?: Record<
      string,
      unknown
    >;
    orderBy: string;
    page: number;
    limit: number;
  },
) {
  const binds = {
    ...(opts.binds ??
      {}),
  };

  const offset =
    (opts.page - 1) *
    opts.limit;

  const endRow =
    opts.page *
    opts.limit;

  const countRow =
    await execOne<{
      TOTAL?: number;
    }>(
      `
      SELECT
        COUNT(1) AS TOTAL
      FROM (
        ${opts.baseSql}
      ) X
      `,
      binds,
      {},
      ESPASI_DB_ALIAS,
    );

  const rows =
    await execRows(
      `
      SELECT *
      FROM (
        SELECT
          X.*,
          ROW_NUMBER()
          OVER (
            ORDER BY
              ${opts.orderBy}
          ) AS RN

        FROM (
          ${opts.baseSql}
        ) X
      )
      WHERE RN >
            :b_offset

        AND RN <=
            :b_end
      `,
      {
        ...binds,

        b_offset:
          offset,

        b_end:
          endRow,
      },
      {},
      ESPASI_DB_ALIAS,
    );

  const total =
    Number(
      countRow?.TOTAL ??
        0,
    );

  const lastPage =
    Math.max(
      1,
      Math.ceil(
        total /
          opts.limit,
      ),
    );

  return {
    total,

    per_page:
      opts.limit,

    current_page:
      opts.page,

    last_page:
      lastPage,

    pageSize:
      opts.limit,

    data:
      rows,
  };
}

/* =========================================================
   LOKET SQL
   ========================================================= */

function buildLoketSql(
  statusLike: string,
  lokasi: string,
  loket: string,
) {
  const binds: Record<
    string,
    unknown
  > = {
    b_lokasi:
      lokasi,

    b_status:
      `${statusLike}%`,
  };

  let extra =
    "";

  let orderBy =
    "A.TGL_PELAYANAN ASC";

  /*
   * Logic legacy tetap dipertahankan.
   *
   * Non-DISDUK:
   *   loket dipetakan melalui prefix URUTAN.
   *
   * DISDUK:
   *   tetap menggunakan daftar KODE_PELAYANAN
   *   legacy yang sudah dipakai sebelumnya.
   */
  if (
    lokasi !==
    "DISDUK"
  ) {
    extra =
      "AND UPPER(A.URUTAN) LIKE :b_loket";

    binds.b_loket =
      `${loket.toUpperCase()}%`;
  } else {
    const slot =
      DISDUK_KODE_PELAYANAN
        .map(
          (_, i) =>
            `:b_kode_${i}`,
        )
        .join(",");

    extra =
      `
      AND UPPER(
        A.KODE_PELAYANAN
      ) IN (${slot})
      `;

    DISDUK_KODE_PELAYANAN.forEach(
      (v, i) => {
        binds[
          `b_kode_${i}`
        ] = v;
      },
    );

    orderBy =
      `
      TO_NUMBER(
        REGEXP_REPLACE(
          A.URUTAN,
          '\\D',
          ''
        )
      ) ASC,
      A.TGL_PELAYANAN ASC
      `;
  }

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

      UPPER(
        A.LOKASI
      ) AS LOKASI

    FROM ANTRIAN A

    WHERE TRUNC(
      A.TGL_PELAYANAN
    ) =
    TRUNC(SYSDATE)

      AND UPPER(
        A.LOKASI
      ) =
      :b_lokasi

      AND UPPER(
        A.STATUS_PELAYANAN
      ) LIKE
      :b_status

      ${extra}

    ORDER BY
      ${orderBy}
  `;

  return {
    sql,
    binds,
  };
}

/* =========================================================
   GET - LOKET
   ========================================================= */

async function getLoketByStatus(
  req: NextRequest,
  statusLike: string,
  auth: SessionAuth,
) {
  const requestedLokasi =
    req.nextUrl.searchParams.get(
      "lokasi",
    );

  const requestedLoket =
    req.nextUrl.searchParams.get(
      "loket",
    );

  const scope =
    await resolveLoketScope(
      auth,
      requestedLokasi,
      requestedLoket,
    );

  if (scope.error) {
    return scope.error;
  }

  const {
    lokasi,
    loket,
    access,
  } = scope;

  if (!lokasi) {
    return badRequest(
      "Parameter lokasi wajib diisi",
    );
  }

  if (
    lokasi !==
      "DISDUK" &&
    !loket
  ) {
    return badRequest(
      "Parameter loket wajib diisi untuk lokasi non-DISDUK",
    );
  }

  const {
    sql,
    binds,
  } =
    buildLoketSql(
      statusLike,
      lokasi,
      loket,
    );

  const antrian =
    toLegacyRows(
      await execRows(
        sql,
        binds,
        {},
        ESPASI_DB_ALIAS,
      ),
    );

  const urutan_sekarang =
    antrian[0] ??
    null;

  await Log.info({
    scope: "API",
    msg:
      "ESPASI antrian loket",
    user:
      access.username,
    extra: {
      endpoint:
        "antrian-loket",
      statusLike,
      role:
        access.roleName,
      lokasi,
      loket,
      count:
        antrian.length,
    },
  });

  return legacyJson({
    antrian,

    urutan_sekarang,

    /*
     * Data access dikembalikan supaya
     * page modern dapat menampilkan
     * lokasi/loket yang benar.
     */
    access: {
      username:
        access.username,

      name:
        access.name,

      roleName:
        access.roleName,

      lokasi,

      loket,

      isAdmin:
        access.isAdmin,
    },
  });
}

/* =========================================================
   GENERIC ANTRIAN LIST
   ========================================================= */

async function getGenericList(
  req: NextRequest,
  source:
    | "antrian"
    | "antrian_log"
    | "hist_antrian",
) {
  const q =
    req.nextUrl.searchParams;

  const page =
    getNum(
      q,
      "page",
      1,
      100000,
    );

  const limit =
    getNum(
      q,
      "limit",
      LIMIT_DEFAULT,
    );

  const searchBy =
    normUpper(
      q.get(
        "searchBy",
      ),
    );

  const nik =
    String(
      q.get("nik") ||
        "",
    ).trim();

  const nama =
    normUpper(
      q.get("nama"),
    );

  const kodePelayanan =
    normUpper(
      q.get(
        "kode_pelayanan",
      ),
    );

  const statusPelayanan =
    normUpper(
      q.get(
        "status_pelayanan",
      ),
    );

  const tglPelayanan =
    String(
      q.get(
        "tgl_pelayanan",
      ) || "",
    ).trim();

  const telepon =
    String(
      q.get(
        "telepon",
      ) || "",
    ).trim();

  const loket =
    normUpper(
      q.get("loket"),
    );

  const table =
    source ===
    "antrian"
      ? "ANTRIAN"
      : source ===
          "antrian_log"
        ? "ANTRIAN_LOG"
        : "HIST_ANTRIAN";

  const binds: Record<
    string,
    unknown
  > = {};

  const where: string[] =
    [];

  if (searchBy) {
    binds.b_search =
      `%${searchBy}%`;

    where.push(
      `
      (
        UPPER(A.NIK) =
          :b_search

        OR UPPER(A.NAMA)
          LIKE :b_search

        OR UPPER(A.TELEPON) =
          :b_search
      )
      `,
    );
  }

  if (loket) {
    binds.b_loket =
      loket;

    where.push(
      `
      UPPER(
        A.KODE_PELAYANAN
      ) = :b_loket
      `,
    );
  }

  if (nik) {
    const nikParts =
      nik
        .split(",")
        .map((v) =>
          v.trim(),
        )
        .filter(Boolean);

    if (
      nikParts.length ===
      1
    ) {
      binds.b_nik =
        nikParts[0];

      where.push(
        "A.NIK = :b_nik",
      );
    } else if (
      nikParts.length >
      1
    ) {
      const slot =
        nikParts
          .map(
            (_, i) =>
              `:b_nik_${i}`,
          )
          .join(",");

      nikParts.forEach(
        (v, i) => {
          binds[
            `b_nik_${i}`
          ] = v;
        },
      );

      where.push(
        `A.NIK IN (${slot})`,
      );
    }
  }

  if (nama) {
    binds.b_nama =
      `%${nama}%`;

    where.push(
      `
      UPPER(A.NAMA)
      LIKE :b_nama
      `,
    );
  }

  if (
    kodePelayanan
  ) {
    binds.b_kode =
      kodePelayanan;

    where.push(
      `
      UPPER(
        A.KODE_PELAYANAN
      ) = :b_kode
      `,
    );
  }

  if (
    statusPelayanan
  ) {
    binds.b_status =
      statusPelayanan;

    where.push(
      `
      UPPER(
        TRIM(
          A.STATUS_PELAYANAN
        )
      ) = :b_status
      `,
    );
  }

  if (
    tglPelayanan
  ) {
    binds.b_tgl =
      tglPelayanan;

    where.push(
      `
      TO_CHAR(
        A.TGL_PELAYANAN,
        'DD-MM-YYYY'
      ) = :b_tgl
      `,
    );
  }

  if (telepon) {
    binds.b_telepon =
      `%${telepon}%`;

    where.push(
      `
      A.TELEPON
      LIKE :b_telepon
      `,
    );
  }

  const baseSql = `
    SELECT
      A.NIK,
      A.NAMA,
      A.TELEPON,
      A.KODE_PELAYANAN,
      A.URUTAN,
      A.STATUS_PELAYANAN,

      TO_CHAR(
        A.TGL_PELAYANAN,
        'DD-MM-YYYY HH24:MI:SS'
      ) AS TGL_PELAYANAN,

      A.HARI,

      TO_CHAR(
        A.JAM
      ) AS JAM,

      UPPER(
        A.LOKASI
      ) AS LOKASI

    FROM ${table} A

    ${
      where.length
        ? `WHERE ${where.join(
            " AND ",
          )}`
        : ""
    }
  `;

  const allowedSort: Record<
    string,
    string
  > = {
    nik:
      "X.NIK",

    nama:
      "X.NAMA",

    telepon:
      "X.TELEPON",

    kode_pelayanan:
      "X.KODE_PELAYANAN",

    urutan:
      "X.URUTAN",

    status_pelayanan:
      "X.STATUS_PELAYANAN",

    tgl_pelayanan:
      "X.TGL_PELAYANAN",

    hari:
      "X.HARI",

    lokasi:
      "X.LOKASI",
  };

  const orderBy =
    buildSort(
      q.get("sort"),
      q.get("sortType"),
      allowedSort,
      "X.TGL_PELAYANAN DESC",
    );

  const paged =
    await queryPaged({
      baseSql,
      binds,
      orderBy,
      page,
      limit,
    });

  return legacyJson({
    ...paged,

    data:
      toLegacyRows(
        paged.data as any[],
      ),
  });
}

/* =========================================================
   SMS TABLE
   ========================================================= */

async function getSmsTable(
  req: NextRequest,
  source:
    | "masuk"
    | "keluar",
) {
  const q =
    req.nextUrl.searchParams;

  const page =
    getNum(
      q,
      "page",
      1,
      100000,
    );

  const limit =
    getNum(
      q,
      "limit",
      LIMIT_DEFAULT,
    );

  const searchBy =
    normUpper(
      q.get(
        "searchBy",
      ),
    );

  const pesan =
    normUpper(
      q.get("pesan"),
    );

  const telepon =
    String(
      q.get(
        "telepon",
      ) || "",
    ).trim();

  const table =
    source ===
    "masuk"
      ? "INBOX_LOG"
      : "OUTBOX";

  const binds: Record<
    string,
    unknown
  > = {};

  const where: string[] =
    [];

  if (searchBy) {
    binds.b_search =
      `%${searchBy}%`;

    where.push(
      `
      (
        UPPER(A.TELEPON)
          LIKE :b_search

        OR UPPER(A.ISI_PESAN)
          LIKE :b_search
      )
      `,
    );
  }

  if (pesan) {
    binds.b_pesan =
      `%${pesan}%`;

    where.push(
      `
      UPPER(
        A.ISI_PESAN
      )
      LIKE :b_pesan
      `,
    );
  }

  if (telepon) {
    binds.b_telepon =
      `%${telepon}%`;

    where.push(
      `
      A.TELEPON
      LIKE :b_telepon
      `,
    );
  }

  const baseSql = `
    SELECT
      A.TELEPON,
      A.ISI_PESAN,

      TO_CHAR(
        A.TANGGAL_SMS,
        'DD-MM-YYYY HH24:MI:SS'
      ) AS TANGGAL_SMS,

      A.SERVER

    FROM ${table} A

    ${
      where.length
        ? `WHERE ${where.join(
            " AND ",
          )}`
        : ""
    }
  `;

  const allowedSort: Record<
    string,
    string
  > = {
    telepon:
      "X.TELEPON",

    isi_pesan:
      "X.ISI_PESAN",

    tanggal_sms:
      "X.TANGGAL_SMS",

    server:
      "X.SERVER",
  };

  const orderBy =
    buildSort(
      q.get("sort"),
      q.get("sortType"),
      allowedSort,
      "X.TANGGAL_SMS DESC",
    );

  const paged =
    await queryPaged({
      baseSql,
      binds,
      orderBy,
      page,
      limit,
    });

  return ok(
    paged,
  );
}

/* =========================================================
   TELEPON
   ========================================================= */

async function getTelepon(
  req: NextRequest,
) {
  const q =
    req.nextUrl.searchParams;

  const page =
    getNum(
      q,
      "page",
      1,
      100000,
    );

  const limit =
    getNum(
      q,
      "limit",
      LIMIT_DEFAULT,
    );

  const searchBy =
    normUpper(
      q.get(
        "searchBy",
      ),
    );

  const binds: Record<
    string,
    unknown
  > = {};

  const where: string[] =
    [];

  if (searchBy) {
    binds.b_search =
      `%${searchBy}%`;

    where.push(
      `
      UPPER(
        TRIM(A.TELEPON)
      )
      LIKE :b_search
      `,
    );
  }

  const baseSql = `
    SELECT
      A.TELEPON,
      A.JUMLAH_SMS,

      TO_CHAR(
        A.TANGGAL_BLOKIR,
        'DD-MM-YYYY HH24:MI:SS'
      ) AS TANGGAL_BLOKIR

    FROM KONTAK A

    ${
      where.length
        ? `WHERE ${where.join(
            " AND ",
          )}`
        : ""
    }
  `;

  const allowedSort: Record<
    string,
    string
  > = {
    telepon:
      "X.TELEPON",

    jumlah_sms:
      "X.JUMLAH_SMS",

    tanggal_blokir:
      "X.TANGGAL_BLOKIR",
  };

  const orderBy =
    buildSort(
      q.get("sort"),
      q.get("sortType"),
      allowedSort,
      "X.TANGGAL_BLOKIR DESC",
    );

  const paged =
    await queryPaged({
      baseSql,
      binds,
      orderBy,
      page,
      limit,
    });

  return ok(
    paged,
  );
}

/* =========================================================
   CASS LAHIR
   ========================================================= */

async function getCassLahir(
  req: NextRequest,
) {
  const q =
    req.nextUrl.searchParams;

  const page =
    getNum(
      q,
      "page",
      1,
      100000,
    );

  const limit =
    getNum(
      q,
      "limit",
      LIMIT_DEFAULT,
    );

  const searchBy =
    normUpper(
      q.get(
        "searchBy",
      ),
    );

  const searchByDate =
    String(
      q.get(
        "searchByDate",
      ) || "",
    ).trim();

  const nik =
    String(
      q.get("nik") ||
        "",
    ).trim();

  const noAkta =
    normUpper(
      q.get(
        "cass_no_akta_lhr",
      ),
    );

  const nama =
    normUpper(
      q.get(
        "cass_nama_lgkp",
      ),
    );

  const tmptLhr =
    normUpper(
      q.get(
        "cass_tmpt_lhr",
      ),
    );

  const tglLhr =
    String(
      q.get(
        "cass_tgl_lhr",
      ) || "",
    ).trim();

  const ayah =
    normUpper(
      q.get(
        "cass_nama_lgkp_ayah",
      ),
    );

  const ibu =
    normUpper(
      q.get(
        "cass_nama_lgkp_ibu",
      ),
    );

  const binds: Record<
    string,
    unknown
  > = {};

  const where: string[] =
    [];

  if (searchBy) {
    binds.b_search =
      `%${searchBy}%`;

    where.push(
      `
      (
        UPPER(
          A.CASS_NAMA_LGKP
        ) LIKE :b_search

        OR UPPER(
          A.CASS_NAMA_LGKP_IBU
        ) LIKE :b_search

        OR UPPER(
          A.CASS_NAMA_LGKP_AYAH
        ) LIKE :b_search
      )
      `,
    );
  }

  if (
    searchByDate
  ) {
    binds.b_searchdate =
      searchByDate;

    where.push(
      `
      (
        TO_CHAR(
          A.CASS_TGL_LHR,
          'DD-MM-YYYY'
        ) = :b_searchdate

        OR TO_CHAR(
          A.TGL_LHR,
          'DD-MM-YYYY'
        ) = :b_searchdate
      )
      `,
    );
  }

  if (nik) {
    binds.b_nik =
      nik;

    where.push(
      "A.NIK = :b_nik",
    );
  }

  if (noAkta) {
    binds.b_noakta =
      `%${noAkta}%`;

    where.push(
      `
      (
        UPPER(
          A.CASS_NO_AKTA_LHR
        ) LIKE :b_noakta

        OR UPPER(
          A.NO_AKTA_LHR
        ) LIKE :b_noakta
      )
      `,
    );
  }

  if (nama) {
    binds.b_nama =
      `%${nama}%`;

    where.push(
      `
      (
        UPPER(
          A.CASS_NAMA_LGKP
        ) LIKE :b_nama

        OR UPPER(
          A.NAMA_LGKP
        ) LIKE :b_nama
      )
      `,
    );
  }

  if (tmptLhr) {
    binds.b_tmpt =
      `%${tmptLhr}%`;

    where.push(
      `
      (
        UPPER(
          A.CASS_TMPT_LHR
        ) LIKE :b_tmpt

        OR UPPER(
          A.TMPT_LHR
        ) LIKE :b_tmpt
      )
      `,
    );
  }

  if (tglLhr) {
    binds.b_tgllhr =
      tglLhr;

    where.push(
      `
      (
        TO_CHAR(
          A.CASS_TGL_LHR,
          'DD-MM-YYYY'
        ) = :b_tgllhr

        OR TO_CHAR(
          A.TGL_LHR,
          'DD-MM-YYYY'
        ) = :b_tgllhr
      )
      `,
    );
  }

  if (ayah) {
    binds.b_ayah =
      `%${ayah}%`;

    where.push(
      `
      (
        UPPER(
          A.CASS_NAMA_LGKP_AYAH
        ) LIKE :b_ayah

        OR UPPER(
          A.NAMA_LGKP_AYAH
        ) LIKE :b_ayah
      )
      `,
    );
  }

  if (ibu) {
    binds.b_ibu =
      `%${ibu}%`;

    where.push(
      `
      (
        UPPER(
          A.CASS_NAMA_LGKP_IBU
        ) LIKE :b_ibu

        OR UPPER(
          A.NAMA_LGKP_IBU
        ) LIKE :b_ibu
      )
      `,
    );
  }

  const baseSql = `
    SELECT
      A.NIK,
      A.CASS_NO_AKTA_LHR,
      A.NO_AKTA_LHR,
      A.CASS_NAMA_LGKP,
      A.NAMA_LGKP,
      A.CASS_TMPT_LHR,
      A.TMPT_LHR,

      TO_CHAR(
        A.CASS_TGL_LHR,
        'DD-MM-YYYY'
      ) AS CASS_TGL_LHR,

      TO_CHAR(
        A.TGL_LHR,
        'DD-MM-YYYY'
      ) AS TGL_LHR,

      A.CASS_NAMA_LGKP_AYAH,
      A.NAMA_LGKP_AYAH,
      A.CASS_NAMA_LGKP_IBU,
      A.NAMA_LGKP_IBU

    FROM CASS_LAHIR A

    ${
      where.length
        ? `WHERE ${where.join(
            " AND ",
          )}`
        : ""
    }
  `;

  const allowedSort: Record<
    string,
    string
  > = {
    nik:
      "X.NIK",

    cass_no_akta_lhr:
      "X.CASS_NO_AKTA_LHR",

    cass_nama_lgkp:
      "X.CASS_NAMA_LGKP",

    cass_tmpt_lhr:
      "X.CASS_TMPT_LHR",

    cass_tgl_lhr:
      "X.CASS_TGL_LHR",
  };

  const orderBy =
    buildSort(
      q.get("sort"),
      q.get("sortType"),
      allowedSort,
      "X.CASS_TGL_LHR DESC",
    );

  const paged =
    await queryPaged({
      baseSql,
      binds,
      orderBy,
      page,
      limit,
    });

  return ok(
    paged,
  );
}

/* =========================================================
   GET
   ========================================================= */

export async function GET(
  req: NextRequest,
  ctx: {
    params: Promise<LegacyParams>;
  },
) {
  const auth =
    await ensureSession();

  if (auth.error) {
    return auth.error;
  }

  const params =
    await ctx.params;

  const parts =
    pathKey(params);

  if (
    !parts.length
  ) {
    return err(
      "Endpoint legacy tidak valid",
      404,
    );
  }

  const [
    first,
    second,
  ] = parts;

  try {
    /* =====================================================
       ANTRIAN LOKET
       ===================================================== */

    if (
      first ===
      "antrian-loket"
    ) {
      return getLoketByStatus(
        req,
        "BELUM",
        auth,
      );
    }

    if (
      first ===
      "antrian-loket-terlewat"
    ) {
      return getLoketByStatus(
        req,
        "PENDING",
        auth,
      );
    }

    if (
      first ===
      "antrian-loket-sudah"
    ) {
      return getLoketByStatus(
        req,
        "SUDAH",
        auth,
      );
    }

    if (
      first ===
      "antrian-loket-menunggu"
    ) {
      return getLoketByStatus(
        req,
        "MENUNGGU",
        auth,
      );
    }

    /* =====================================================
       CEK PESAN
       ===================================================== */

    if (
      first ===
        "cek-pesan" &&
      second
    ) {
      const modem =
        Number(
          second,
        );

      if (
        !Number.isFinite(
          modem,
        ) ||
        modem <= 0
      ) {
        return badRequest(
          "modem tidak valid",
        );
      }

      const row =
        await execOne<any>(
          `
          SELECT *
          FROM (
            SELECT
              TELEPON,
              ISI_PESAN,

              TO_CHAR(
                TANGGAL_SMS,
                'DD-MM-YYYY HH24:MI:SS'
              ) AS TANGGAL_SMS,

              SERVER

            FROM INBOX_LOG

            WHERE SERVER =
                  :b_modem

            ORDER BY
              TANGGAL_SMS DESC
          )
          WHERE ROWNUM = 1
          `,
          {
            b_modem:
              modem,
          },
          {},
          ESPASI_DB_ALIAS,
        );

      if (!row) {
        return ok([
          {
            sms: 1,
          },
        ]);
      }

      return ok(
        row,
      );
    }

    /* =====================================================
       GENERIC ANTRIAN
       ===================================================== */

    if (
      first ===
      "sms-antrian"
    ) {
      return getGenericList(
        req,
        "antrian",
      );
    }

    if (
      first ===
      "sms-antrian-log"
    ) {
      return getGenericList(
        req,
        "antrian_log",
      );
    }

    if (
      first ===
      "hist-antrian"
    ) {
      return getGenericList(
        req,
        "hist_antrian",
      );
    }

    /* =====================================================
       SMS
       ===================================================== */

    if (
      first ===
      "sms-antrian-masuk"
    ) {
      return getSmsTable(
        req,
        "masuk",
      );
    }

    if (
      first ===
      "sms-antrian-keluar"
    ) {
      return getSmsTable(
        req,
        "keluar",
      );
    }

    /* =====================================================
       TELEPON
       ===================================================== */

    if (
      first ===
      "telepon"
    ) {
      return getTelepon(
        req,
      );
    }

    /* =====================================================
       CASS LAHIR
       ===================================================== */

    if (
      first ===
      "cass-lahir"
    ) {
      return getCassLahir(
        req,
      );
    }

    /* =====================================================
       KODE LOKET
       ===================================================== */

    if (
      first ===
      "kode-loket"
    ) {
      const rows =
        await execRows(
          `
          SELECT
            LAYANAN
          FROM DATA_LOKET

          GROUP BY
            LAYANAN

          ORDER BY
            LAYANAN ASC
          `,
          {},
          {},
          ESPASI_DB_ALIAS,
        );

      return ok(
        rows,
      );
    }

    /* =====================================================
       SETTING LOKET
       ===================================================== */

    if (
      first ===
      "setting-loket"
    ) {
      const rows =
        await execRows(
          `
          SELECT *
          FROM DATA_LOKET
          ORDER BY
            LAYANAN
          `,
          {},
          {},
          ESPASI_DB_ALIAS,
        );

      return ok(
        rows,
      );
    }

    /* =====================================================
       DATA LOKET
       ===================================================== */

    if (
      first ===
      "data-loket"
    ) {
      const rows =
        await execRows(
          `
          SELECT *
          FROM DATA_LOKET

          WHERE ACTIVE =
                1

          ORDER BY
            LAYANAN
          `,
          {},
          {},
          ESPASI_DB_ALIAS,
        );

      return ok({
        message:
          "success",

        layanan:
          rows,
      });
    }

    /* =====================================================
       DATA KUOTA
       ===================================================== */

    if (
      first ===
      "data-kuota-antrian"
    ) {
      const rows =
        await execRows(
          `
          SELECT
            ROWNUM AS NO,
            X.*

          FROM (
            SELECT
              A.KODE_PELAYANAN,

              TO_CHAR(
                A.TGL_PELAYANAN,
                'DD-MM-YYYY HH24:MI:SS'
              ) AS TANGGAL,

              B.URUTAN

            FROM (
              SELECT
                KODE_PELAYANAN,
                MAX(
                  TGL_PELAYANAN
                ) AS TGL_PELAYANAN

              FROM ANTRIAN

              GROUP BY
                KODE_PELAYANAN
            ) A

            INNER JOIN
              ANTRIAN B

              ON
                A.KODE_PELAYANAN =
                B.KODE_PELAYANAN

              AND
                A.TGL_PELAYANAN =
                B.TGL_PELAYANAN

            ORDER BY
              A.KODE_PELAYANAN ASC
          ) X
          `,
          {},
          {},
          ESPASI_DB_ALIAS,
        );

      return ok({
        status:
          "success",

        pesan:
          rows,
      });
    }

    /* =====================================================
       VIDEO
       ===================================================== */

    if (
      first ===
      "video"
    ) {
      const rows =
        await execRows(
          `
          SELECT
            PATH
          FROM (
            SELECT
              '/assets/video/' ||
              TO_CHAR(
                SYSDATE,
                'DAY',
                'NLS_DATE_LANGUAGE=ENGLISH'
              ) ||
              '/' ||
              FILENAME AS PATH

            FROM VIDEOS
          )
          `,
          {},
          {},
          ESPASI_DB_ALIAS,
        ).catch(
          () => [],
        );

      if (
        rows.length
      ) {
        const items =
          rows
            .map(
              (
                r: any,
              ) =>
                String(
                  r.PATH ||
                    "",
                ).trim(),
            )
            .filter(
              Boolean,
            );

        return ok(
          items,
        );
      }

      return ok(
        [],
      );
    }

    /* =====================================================
       DISDUK SMS ANTRIAN
       ===================================================== */

    if (
      first ===
        "disduk-sms-antrian" &&
      /^[1-4]$/.test(
        String(
          second || "",
        ),
      )
    ) {
      const server =
        Number(
          second,
        );

      const rows =
        await execRows(
          `
          SELECT *
          FROM (
            SELECT
              'by-me' AS JENIS,

              TO_CHAR(
                TANGGAL_SMS,
                'YYYYMMDDHH24MISS'
              ) AS WAKTU,

              TO_CHAR(
                TANGGAL_SMS,
                'DD-MM-YYYY HH24:MI:SS'
              ) AS TANGGAL,

              A.TELEPON,
              A.ISI_PESAN,
              A.SERVER

            FROM OUTBOX A

            WHERE TO_CHAR(
              TANGGAL_SMS,
              'YYYYMMDD'
            ) >=
            TO_CHAR(
              SYSDATE,
              'YYYYMMDD'
            ) - 2

            AND A.SERVER =
                :b_server

            UNION ALL

            SELECT
              'by-other' AS JENIS,

              TO_CHAR(
                TANGGAL_SMS,
                'YYYYMMDDHH24MISS'
              ) AS WAKTU,

              TO_CHAR(
                TANGGAL_SMS,
                'DD-MM-YYYY HH24:MI:SS'
              ) AS TANGGAL,

              B.TELEPON,
              B.ISI_PESAN,
              B.SERVER

            FROM INBOX_LOG B

            WHERE TO_CHAR(
              TANGGAL_SMS,
              'YYYYMMDD'
            ) >=
            TO_CHAR(
              SYSDATE,
              'YYYYMMDD'
            ) - 2

            AND B.SERVER =
                :b_server
          )

          ORDER BY
            WAKTU DESC
          `,
          {
            b_server:
              server,
          },
          {},
          ESPASI_DB_ALIAS,
        );

      return ok(
        rows,
      );
    }

    return err(
      `Endpoint legacy belum tersedia: /${parts.join("/")}`,
      404,
    );
  } catch (
    e: any
  ) {
    await Log.error({
      scope: "API",
      msg:
        "ESPASI GET legacy error",
      user:
        auth.session
          ?.S_USER_ID,
      extra: {
        path:
          parts.join("/"),
      },
      err:
        e instanceof
        Error
          ? e
          : new Error(
              String(e),
            ),
    });

    return err(
      e?.message ||
        "Gagal memproses endpoint legacy",
      500,
    );
  }
}

/* =========================================================
   POST
   ========================================================= */

export async function POST(
  req: NextRequest,
  ctx: {
    params: Promise<LegacyParams>;
  },
) {
  const auth =
    await ensureSession();

  if (auth.error) {
    return auth.error;
  }

  const params =
    await ctx.params;

  const parts =
    pathKey(params);

  const [
    first,
  ] = parts;

  if (!first) {
    return err(
      "Endpoint legacy tidak valid",
      404,
    );
  }

  let body: any =
    {};

  try {
    body =
      await req.json();
  } catch {
    body =
      {};
  }

  try {
    /* =====================================================
       INBOX
       ===================================================== */

    if (
      first ===
      "inbox"
    ) {
      const telepon =
        normalizePhone(
          body?.telepon,
        );

      const isiPesan =
        sanitizeMessage(
          body?.isi_pesan ??
            body?.message,
        );

      const modem =
        Number(
          body?.modem ??
            body?.serverModem ??
            1,
        ) || 1;

      if (
        !telepon ||
        !isiPesan
      ) {
        return badRequest(
          "telepon dan isi_pesan wajib diisi",
        );
      }

      await insertInboxLog(
        telepon,
        isiPesan,
        modem,
      );

      return ok(
        "success",
      );
    }

    /* =====================================================
       SMS ANTRIAN 1-4
       ===================================================== */

    if (
      first ===
        "sms-antrian-1" ||
      first ===
        "sms-antrian-2" ||
      first ===
        "sms-antrian-3" ||
      first ===
        "sms-antrian-4"
    ) {
      const modem =
        Number(
          first.slice(
            -1,
          ),
        );

      const telepon =
        normalizePhone(
          body?.telepon ??
            body?.[
              `telepon${modem}`
            ],
        );

      const isiPesan =
        String(
          body?.isi_pesan ??
            body?.[
              `isi_pesan${modem}`
            ] ??
            "",
        ).trim();

      if (
        !telepon ||
        !isiPesan
      ) {
        return badRequest(
          "telepon dan isi_pesan wajib diisi",
        );
      }

      await insertOutbox(
        telepon,
        isiPesan,
        modem,
      );

      return ok({
        success:
          true,

        modem,

        telepon,
      });
    }

    /* =====================================================
       E-SPASI
       ===================================================== */

    if (
      first ===
        "e-spasi" ||
      first ===
        "e-spasi-all-in-one" ||
      first ===
        "e-spasi2"
    ) {
      const inbound =
        parseInboundSms(
          body,
          first ===
            "e-spasi2"
            ? 11
            : 1,
        );

      if (
        !inbound.telepon ||
        !inbound.message
      ) {
        return badRequest(
          "telepon/from dan message/body wajib diisi",
        );
      }

      await insertInboxLog(
        inbound.telepon,
        inbound.message,
        inbound.serverModem,
      );

      const result =
        await processQueueRegistration(
          {
            tableName:
              "ANTRIAN",

            activeFlag:
              1,

            inbound,
          },
        );

      if (
        result?.pesan
      ) {
        await insertOutbox(
          inbound.telepon,
          result.pesan,
          inbound.serverModem,
        );
      }

      return ok(
        result,
      );
    }

    /* =====================================================
       DEV E-SPASI
       ===================================================== */

    if (
      first ===
      "dev-e-spasi"
    ) {
      const inbound =
        parseInboundSms(
          body,
          1,
        );

      if (
        !inbound.telepon ||
        !inbound.message
      ) {
        return badRequest(
          "telepon dan message wajib diisi",
        );
      }

      await insertInboxLog(
        inbound.telepon,
        inbound.message,
        inbound.serverModem,
      );

      const result =
        await processQueueRegistration(
          {
            tableName:
              "DEV_ANTRIAN",

            activeFlag:
              1,

            inbound,
          },
        );

      if (
        result?.pesan
      ) {
        await insertOutbox(
          inbound.telepon,
          result.pesan,
          inbound.serverModem,
        );
      }

      return ok(
        result,
      );
    }

    /* =====================================================
       SALAMAN
       ===================================================== */

    if (
      first ===
      "salaman-e-spasi"
    ) {
      const inbound =
        parseInboundSms(
          body,
          Number(
            body?.serverModem ??
              11,
          ) || 11,
        );

      if (
        !inbound.message
      ) {
        return badRequest(
          "message wajib diisi",
        );
      }

      const result =
        await processSalaman(
          inbound,
        );

      return ok(
        result,
      );
    }

    /* =====================================================
       HITUNG DETIK
       ===================================================== */

    if (
      first ===
      "hitungDetik"
    ) {
      const jam =
        Number(
          body?.jam ??
            0,
        );

      const kuota =
        Number(
          body?.kuota ??
            0,
        );

      if (
        !Number.isFinite(
          jam,
        ) ||
        !Number.isFinite(
          kuota,
        ) ||
        jam <= 0 ||
        kuota <= 0
      ) {
        return badRequest(
          "jam dan kuota wajib angka > 0",
        );
      }

      return ok(
        (jam *
          60 *
          60) /
          kuota,
      );
    }

    /* =====================================================
       UPDATE ANTRIAN LOKET
       ===================================================== */

    if (
      first ===
        "antrian-loket-update" ||
      first ===
        "antrian-loket-update2"
    ) {
      const nik =
        String(
          body?.nik ||
            "",
        ).trim();

      const telepon =
        String(
          body?.telepon ||
            "",
        ).trim();

      const layanan =
        normUpper(
          body?.layanan ??
            "",
        );

      const status =
        normUpper(
          body?.status ??
            "",
        );

      if (
        !nik ||
        !telepon ||
        !layanan ||
        !status
      ) {
        return badRequest(
          "nik, telepon, layanan, status wajib diisi",
        );
      }

      /*
       * Admin:
       *   boleh menggunakan body.lokasi + body.loket.
       *
       * Loket:
       *   body.lokasi/body.loket DIABAIKAN.
       *   server mengambil dari M_ESPASI_USER@YZDB.
       */
      const scope =
        await resolveLoketScope(
          auth,
          body?.lokasi,
          body?.loket,
        );

      if (scope.error) {
        return scope.error;
      }

      const {
        lokasi,
        loket,
        access,
      } = scope;

      /*
       * Untuk non-DISDUK, legacy menggunakan
       * prefix URUTAN sebagai loket.
       *
       * Untuk DISDUK, query legacy sebelumnya
       * tidak menggunakan LOKET karena memang
       * menggunakan KODE_PELAYANAN.
       *
       * Kita tidak mengubah business logic itu
       * tanpa mapping database yang eksplisit.
       */
      const loketCondition =
        lokasi !==
        "DISDUK"
          ? `
            AND UPPER(
              URUTAN
            ) LIKE :b_loket
            `
          : "";

      const binds: Record<
        string,
        unknown
      > = {
        b_status:
          status,

        b_updated_by:
          auth.session
            ?.S_USER_ID ??
          "SYSTEM",

        b_nik:
          nik,

        b_telepon:
          telepon,

        b_layanan:
          layanan,

        b_lokasi:
          lokasi,
      };

      if (
        lokasi !==
        "DISDUK"
      ) {
        binds.b_loket =
          `${loket.toUpperCase()}%`;
      }

      const rowsAffected =
        await execDml(
          `
          UPDATE ANTRIAN

             SET
               STATUS_PELAYANAN =
                 :b_status,

               UPDATED_BY =
                 :b_updated_by

           WHERE NIK =
                 :b_nik

             AND TELEPON =
                 :b_telepon

             AND UPPER(
                   KODE_PELAYANAN
                 ) =
                 :b_layanan

             AND UPPER(
                   LOKASI
                 ) =
                 :b_lokasi

             AND TRUNC(
                   TGL_PELAYANAN
                 ) <=
                 TRUNC(
                   SYSDATE
                 )

             ${loketCondition}
          `,
          binds,
          {},
          ESPASI_DB_ALIAS,
        );

      if (
        !rowsAffected
      ) {
        await Log.warn({
          scope: "API",
          msg:
            "ESPASI update antrian tidak menemukan data",
          user:
            auth.session
              ?.S_USER_ID,
          extra: {
            nik,
            layanan,
            status,
            lokasi,
            loket,
            role:
              access.roleName,
          },
        });

        return err(
          "Data antrian tidak ditemukan",
          404,
        );
      }

      await Log.info({
        scope: "API",
        msg:
          "ESPASI update status antrian",
        user:
          auth.session
            ?.S_USER_ID,
        extra: {
          nik,
          layanan,
          status,
          lokasi,
          loket,
          role:
            access.roleName,
          rowsAffected,
        },
      });

      return legacyJson({
        success: {
          status: 200,
          message:
            "success",
        },
      });
    }

    return err(
      `Endpoint POST legacy belum tersedia: /${parts.join("/")}`,
      404,
    );
  } catch (
    e: any
  ) {
    await Log.error({
      scope: "API",
      msg:
        "ESPASI POST legacy error",
      user:
        auth.session
          ?.S_USER_ID,
      extra: {
        path:
          parts.join("/"),
      },
      err:
        e instanceof
        Error
          ? e
          : new Error(
              String(e),
            ),
    });

    return err(
      e?.message ||
        "Gagal memproses endpoint legacy",
      500,
    );
  }
}

/* =========================================================
   DELETE
   ========================================================= */

export async function DELETE(
  req: NextRequest,
  ctx: {
    params: Promise<LegacyParams>;
  },
) {
  const auth =
    await ensureSession();

  if (auth.error) {
    return auth.error;
  }

  const params =
    await ctx.params;

  const parts =
    pathKey(params);

  const [
    first,
    second,
  ] = parts;

  if (!first) {
    return err(
      "Endpoint legacy tidak valid",
      404,
    );
  }

  try {
    /* =====================================================
       DELETE ANTRIAN
       ===================================================== */

    if (
      first ===
        "sms-antrian" &&
      second
    ) {
      const nik =
        decodeURIComponent(
          second,
        );

      const rowsAffected =
        await execDml(
          `
          DELETE FROM
            ANTRIAN

          WHERE NIK =
                :b_nik
          `,
          {
            b_nik:
              nik,
          },
          {},
          ESPASI_DB_ALIAS,
        );

      if (
        !rowsAffected
      ) {
        return err(
          "Data antrian tidak ditemukan",
          404,
        );
      }

      return legacyJson({
        success: {
          status: 200,
          message:
            "success",
        },
      });
    }

    /* =====================================================
       DELETE TELEPON
       ===================================================== */

    if (
      first ===
        "telepon" &&
      second
    ) {
      const telepon =
        decodeURIComponent(
          second,
        );

      const blockedRow =
        await execOne<{
          IS_BLOCKED?: number;
        }>(
          `
          SELECT
            CASE
              WHEN
                TANGGAL_BLOKIR >
                ADD_MONTHS(
                  SYSDATE,
                  1
                )
              THEN 1
              ELSE 0
            END AS IS_BLOCKED

          FROM
            KONTAK

          WHERE TELEPON =
                :b_telepon
          `,
          {
            b_telepon:
              telepon,
          },
          {},
          ESPASI_DB_ALIAS,
        );

      if (
        !blockedRow
      ) {
        return err(
          "Data telepon tidak ditemukan",
          404,
        );
      }

      if (
        Number(
          blockedRow.IS_BLOCKED ??
            0,
        ) === 1
      ) {
        return ok({
          success: {
            status: 200,
            message:
              "blokir",
          },
        });
      }

      const rowsAffected =
        await execDml(
          `
          DELETE FROM
            KONTAK

          WHERE TELEPON =
                :b_telepon
          `,
          {
            b_telepon:
              telepon,
          },
          {},
          ESPASI_DB_ALIAS,
        );

      if (
        !rowsAffected
      ) {
        return ok({
          success: {
            status: 200,
            message:
              "gagal",
          },
        });
      }

      return ok({
        success: {
          status: 200,
          message:
            "success",
        },
      });
    }

    return err(
      `Endpoint DELETE legacy belum tersedia: /${parts.join("/")}`,
      404,
    );
  } catch (
    e: any
  ) {
    await Log.error({
      scope: "API",
      msg:
        "ESPASI DELETE legacy error",
      user:
        auth.session
          ?.S_USER_ID,
      extra: {
        path:
          parts.join("/"),
      },
      err:
        e instanceof
        Error
          ? e
          : new Error(
              String(e),
            ),
    });

    return err(
      e?.message ||
        "Gagal memproses endpoint legacy",
      500,
    );
  }
}