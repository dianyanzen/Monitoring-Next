import { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import {
  DuplicateAlias,
  DuplicateDetailRow,
  DuplicateListRow,
  execDuplicateRows,
  mapDuplicateDetailRow,
  mapDuplicateListRow,
  sanitizeNumberList,
} from "./utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DuplicateRequest = {
  nik?: string;
  noKec?: string;
  noKel?: string;
  dateStart?: string;
  dateEnd?: string;
};

type DuplicateMode = "nik" | "wilayah";

function normalizeWilayahCode(raw?: string | null) {
  const value = (raw ?? "").toString().trim();
  if (!value) return null;
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  return digits;
}

function normalizeDate(value?: string | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-");
    return `${d}-${m}-${y}`;
  }
  return null;
}

function buildInClause(values: string[], binds: Record<string, any>, prefix: string) {
  return values
    .map((val, idx) => {
      const key = `${prefix}${idx}`;
      binds[key] = val;
      return `:${key}`;
    })
    .join(", ");
}

function buildDetailSql(placeholders: string) {
  return `
    SELECT
      A.NIK,
      A.NO_PROP,
      A.NAMA_PROP,
      A.NO_KAB,
      A.NAMA_KAB,
      A.NO_KEC,
      A.NAMA_KEC,
      A.NO_KEL,
      A.NAMA_KEL,
      A.NAMA_LGKP,
      A.ALAMAT,
      A.CURRENT_STATUS_CODE,
      A.TGL_REKAM,
      A.NIK_SINGLE,
      A.NO_PROP_SINGLE,
      A.NAMA_PROP_SINGLE,
      A.NO_KAB_SINGLE,
      A.NAMA_KAB_SINGLE,
      A.NO_KEC_SINGLE,
      A.NAMA_KEC_SINGLE,
      A.NO_KEL_SINGLE,
      A.NAMA_KEL_SINGLE,
      A.NAMA_LGKP_SINGLE,
      A.ALAMAT_SINGLE,
      A.CURRENT_STATUS_CODE_SINGLE,
      A.TGL_REKAM_SINGLE
    FROM (
      SELECT
        A.NIK,
        A.NO_PROP,
        F5_GET_NAMA_PROVINSI(A.NO_PROP) AS NAMA_PROP,
        A.NO_KAB,
        F5_GET_NAMA_KABUPATEN(A.NO_PROP, A.NO_KAB) AS NAMA_KAB,
        A.NO_KEC,
        F5_GET_NAMA_KECAMATAN(A.NO_PROP, A.NO_KAB, A.NO_KEC) AS NAMA_KEC,
        '0' AS NO_KEL,
        '-' AS NAMA_KEL,
        A.NAMA_LGKP,
        '-' AS ALAMAT,
        A.CURRENT_STATUS_CODE,
        TO_CHAR(A.TGL_REKAM,'DD-MM-YYYY') AS TGL_REKAM,
        TO_CHAR(A.NIK_SINGLE) AS NIK_SINGLE,
        TO_CHAR(A.NO_PROP_SINGLE) AS NO_PROP_SINGLE,
        (SELECT C.NAMA_PROP FROM SETUP_PROP C WHERE A.NO_PROP_SINGLE = C.NO_PROP) AS NAMA_PROP_SINGLE,
        TO_CHAR(A.NO_KAB_SINGLE) AS NO_KAB_SINGLE,
        (
          SELECT C.NAMA_KAB
          FROM SETUP_KAB C
          WHERE A.NO_PROP_SINGLE = C.NO_PROP AND A.NO_KAB_SINGLE = C.NO_KAB
        ) AS NAMA_KAB_SINGLE,
        TO_CHAR(A.NO_KEC_SINGLE) AS NO_KEC_SINGLE,
        (
          SELECT C.NAMA_KEC
          FROM SETUP_KEC C
          WHERE A.NO_PROP_SINGLE = C.NO_PROP
            AND A.NO_KAB_SINGLE = C.NO_KAB
            AND A.NO_KEC_SINGLE = C.NO_KEC
        ) AS NAMA_KEC_SINGLE,
        '0' AS NO_KEL_SINGLE,
        '-' AS NAMA_KEL_SINGLE,
        A.NAMA_LGKP_SINGLE,
        '-' AS ALAMAT_SINGLE,
        A.CURRENT_STATUS_CODE_SINGLE,
        TO_CHAR(A.TGL_REKAM_SINGLE,'DD-MM-YYYY') AS TGL_REKAM_SINGLE
      FROM SIAK_DUPLICATE_FULL A
      WHERE A.NIK IN (${placeholders})
      UNION ALL
      SELECT
        B.NIK,
        B.NO_PROP,
        F5_GET_NAMA_PROVINSI(B.NO_PROP) AS NAMA_PROP,
        B.NO_KAB,
        F5_GET_NAMA_KABUPATEN(B.NO_PROP, B.NO_KAB) AS NAMA_KAB,
        B.NO_KEC,
        B.NAMA_KEC,
        '0' AS NO_KEL,
        '-' AS NAMA_KEL,
        B.NAMA_LGKP,
        '-' AS ALAMAT,
        B.CURRENT_STATUS_CODE,
        TO_CHAR(B.CREATED,'DD-MM-YYYY') AS TGL_REKAM,
        TO_CHAR(C.DUPLICATE_NIK) AS NIK_SINGLE,
        '0' AS NO_PROP_SINGLE,
        '-' AS NAMA_PROP_SINGLE,
        '0' AS NO_KAB_SINGLE,
        '-' AS NAMA_KAB_SINGLE,
        '0' AS NO_KEC_SINGLE,
        '-' AS NAMA_KEC_SINGLE,
        '0' AS NO_KEL_SINGLE,
        '-' AS NAMA_KEL_SINGLE,
        '-' AS NAMA_LGKP_SINGLE,
        '-' AS ALAMAT_SINGLE,
        '-' AS CURRENT_STATUS_CODE_SINGLE,
        '-' AS TGL_REKAM_SINGLE
      FROM DEMOGRAPHICS@DB5 B
      INNER JOIN DUPLICATE_RESULTS@DB5 C ON B.NIK = C.NIK
      WHERE B.NIK IN (${placeholders})
        AND NOT EXISTS (
          SELECT 1
          FROM SIAK_DUPLICATE_FULL A
          WHERE A.NIK = B.NIK
        )
    ) A
    WHERE A.NIK IN (${placeholders}) OR A.NIK_SINGLE IN (${placeholders})
    ORDER BY A.NIK, A.NIK_SINGLE
  `;
}

function buildListSql(includeKec: boolean, includeKel: boolean) {
  return `
    SELECT
      TO_CHAR(A.NIK) AS NIK,
      NVL(D.NIK_SINGLE, '-') AS NIK_SINGLE,
      A.NAMA_LGKP,
      A.TMPT_LHR,
      TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
      NVL(A.ALAMAT, '-') AS ALAMAT,
      A.NO_KEC,
      A.NAMA_KEC,
      A.NO_KEL,
      A.NAMA_KEL,
      NVL(A.NO_RW, 0) AS NO_RW,
      NVL(A.NO_RT, 0) AS NO_RT,
      NVL(TO_CHAR(A.KODE_POS), '-') AS KODE_POS,
      A.AGAMA,
      A.STAT_KWN AS STATUS_KAWIN,
      A.JENIS_PKRJN AS PEKERJAAN,
      TO_CHAR(A.CREATED,'DD-MM-YYYY') AS TGL_REKAM,
      A.CURRENT_STATUS_CODE AS STATUS_KTP
    FROM DEMOGRAPHICS@DB5 A
    LEFT JOIN (
      SELECT DISTINCT A.NIK, A.NIK_SINGLE
      FROM (
        SELECT A.NIK, TO_CHAR(A.NIK_SINGLE) AS NIK_SINGLE
        FROM SIAK_DUPLICATE_FULL A
        UNION ALL
        SELECT B.NIK, TO_CHAR(B.NIK_SINGLE) AS NIK_SINGLE
        FROM (
          SELECT C.NIK, TO_CHAR(C.DUPLICATE_NIK) AS NIK_SINGLE
          FROM DUPLICATE_RESULTS@DB5 C
          WHERE NOT EXISTS (
            SELECT 1 FROM SIAK_DUPLICATE_FULL A WHERE A.NIK = C.NIK
          )
        ) B
      ) A
    ) D ON A.NIK = D.NIK
    WHERE A.CURRENT_STATUS_CODE = 'DUPLICATE_RECORD'
      AND (A.TGL_LHR <= ADD_MONTHS(SYSDATE, -12 * 17) OR A.STAT_KWN <> 'BELUM KAWIN')
      AND A.CREATED >= TO_DATE(:date_start, 'DD-MM-YYYY')
      AND A.CREATED < TO_DATE(:date_end, 'DD-MM-YYYY') + 1
      ${includeKec ? "AND A.NO_KEC = :no_kec" : ""}
      ${includeKel ? "AND A.NO_KEL = :no_kel" : ""}
    ORDER BY A.CREATED DESC, A.NO_KEL, A.NO_RW, A.NO_RT
  `;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const session = await readServerSession().catch(() => null);
  if (!session) return unauthorized("Sesi tidak ditemukan");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  const ua = req.headers.get("user-agent") || undefined;

  let payload: DuplicateRequest | null = null;
  try {
    payload = (await req.json()) as DuplicateRequest;
  } catch {
    return badRequest("Payload tidak valid (harus JSON)");
  }
  if (!payload) return badRequest("Payload tidak boleh kosong");

  const nikList = sanitizeNumberList(payload.nik);
  const mode: DuplicateMode = nikList.length ? "nik" : "wilayah";

  const noKec = normalizeWilayahCode(payload.noKec);
  const noKel = normalizeWilayahCode(payload.noKel);
  const dateStart = normalizeDate(payload.dateStart);
  const dateEnd = normalizeDate(payload.dateEnd);

  if (mode === "nik") {
    if (!nikList.length) return badRequest("Minimal isi satu NIK");
  } else {
    if (!dateStart || !dateEnd) {
      return badRequest("Rentang tanggal wajib diisi (DD-MM-YYYY)");
    }
  }

  try {
    let response: { mode: DuplicateMode; total: number; rows: DuplicateDetailRow[] | DuplicateListRow[] };
    if (mode === "nik") {
      const binds: Record<string, any> = {};
      const placeholders = buildInClause(nikList, binds, "nik");
      const sql = buildDetailSql(placeholders);
      const rows = await execDuplicateRows<Record<string, any>>(sql, binds);
      const mapped = rows.map(mapDuplicateDetailRow);
      response = { mode, total: mapped.length, rows: mapped };
    } else {
      const binds: Record<string, any> = {};
      binds.date_start = dateStart;
      binds.date_end = dateEnd;
      const includeKec = !!noKec && noKec !== "0";
      const includeKel = !!noKel && noKel !== "0";
      if (includeKec) binds.no_kec = noKec;
      if (includeKel) binds.no_kel = noKel;
      const sql = buildListSql(includeKec, includeKel);
      const rows = await execDuplicateRows<Record<string, any>>(sql, binds);
      const mapped = rows.map(mapDuplicateListRow);
      response = { mode, total: mapped.length, rows: mapped };
    }

    await Log.info({
      scope: "API",
      msg: "Duplicate search",
      at: "/api/check/duplicate",
      tookMs: Date.now() - startedAt,
      user: session.S_USER_ID,
      ip,
      ua,
      extra: {
        mode,
        total: response.total,
        alias: DuplicateAlias,
        filters:
          mode === "nik"
            ? { nik: nikList.length }
            : {
                noKec: noKec ?? null,
                noKel: noKel ?? null,
                dateStart,
                dateEnd,
              },
      },
    });

    return ok({ success: true, data: response });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "Duplicate search failed",
      at: "/api/check/duplicate",
      tookMs: Date.now() - startedAt,
      user: session.S_USER_ID,
      ip,
      ua,
      err: {
        name: e?.name || "Error",
        message: e?.message || String(e),
        stack: e?.stack,
      },
      extra: {
        mode,
      },
    });
    return err(e?.message || "Gagal memuat data duplicate", 500);
  }
}
