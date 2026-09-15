// FILE: src/app/api/tracking-pengajuan/route.ts
import type { NextRequest } from "next/server";
import oracledb from "oracledb";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows, withTransaction } from "@/lib/db";
import { getClientInfo, readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import {
  isIsoDate,
  normalizeDigits,
  normalizeText,
  normalizeUpper,
  TRACKING_STATUS_LABELS,
  TRACKING_STATUSES,
} from "@/lib/tracking/constants";
import { syncAutoCompletedTracking } from "@/lib/tracking/auto-complete";
import { isOfficeAllowedForLocation } from "@/lib/tracking/office-location";
import { fetchKecamatan, fetchKelurahan, resolveWilayahDefaults } from "../check/ktpel/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_TRACKING ?? "DB";
const TRACKING_SUPERADMIN_USER = "ASSIST_YZ";

type TrackingRow = {
  REQUEST_ID: number;
  REGISTRATION_NO: string;
  QUEUE_NO: string | null;
  NO_DOK: string | null;
  EXTRA_NOTE: string | null;
  LOCATION_ID: number;
  LOCATION_CODE: string;
  LOCATION_NAME: string;
  LOCATION_GROUP: string;
  PRODUCT_ID: number;
  PRODUCT_CODE: string;
  PRODUCT_NAME: string;
  NIK: string;
  APPLICANT_NAME: string;
  NO_KEC: string | null;
  NO_KEL: number | null;
  ALAMAT: string | null;
  NO_RW: number | null;
  NO_RT: number | null;
  PHONE: string | null;
  EMAIL: string | null;
  STATUS: string;
  SOURCE: string;
  NOTES: string | null;
  CREATED_BY: string;
  CREATED_AT: string;
  CREATED_DATE: string;
  CREATED_TIME: string;
  UPDATED_BY: string | null;
  UPDATED_AT: string | null;
};

function statusLabel(status: unknown) {
  const key = normalizeUpper(status) as keyof typeof TRACKING_STATUS_LABELS;
  return TRACKING_STATUS_LABELS[key] || normalizeText(status);
}

function isTrackingSuperadminUser(value: unknown) {
  return normalizeUpper(String(value ?? "")).trim() === TRACKING_SUPERADMIN_USER;
}

function mapTracking(row: TrackingRow) {
  return {
    trackingId: Number(row.REQUEST_ID),
    requestId: Number(row.REQUEST_ID),
    registrationNo: normalizeText(row.REGISTRATION_NO),
    queueNo: normalizeText(row.QUEUE_NO),
    noDok: normalizeText(row.NO_DOK),
    extraNote: normalizeText(row.EXTRA_NOTE),
    locationId: Number(row.LOCATION_ID),
    locationCode: normalizeText(row.LOCATION_CODE),
    locationName: normalizeText(row.LOCATION_NAME),
    locationType: normalizeText(row.LOCATION_GROUP),
    locationGroup: normalizeText(row.LOCATION_GROUP),
    productId: Number(row.PRODUCT_ID),
    productCode: normalizeText(row.PRODUCT_CODE),
    productName: normalizeText(row.PRODUCT_NAME),
    nik: normalizeText(row.NIK),
    name: normalizeText(row.APPLICANT_NAME),
    applicantName: normalizeText(row.APPLICANT_NAME),
    district: normalizeText(row.NO_KEC),
    kecamatan: normalizeText(row.NO_KEC),
    kelurahan: normalizeText(row.NO_KEL),
    alamat: normalizeText(row.ALAMAT),
    rw: normalizeText(row.NO_RW),
    rt: normalizeText(row.NO_RT),
    phone: normalizeText(row.PHONE),
    email: normalizeText(row.EMAIL),
    status: normalizeText(row.STATUS),
    statusLabel: statusLabel(row.STATUS),
    source: normalizeText(row.SOURCE),
    notes: normalizeText(row.NOTES),
    createdBy: normalizeText(row.CREATED_BY),
    createdAt: normalizeText(row.CREATED_AT),
    createdDate: normalizeText(row.CREATED_DATE),
    createdTime: normalizeText(row.CREATED_TIME),
    updatedBy: normalizeText(row.UPDATED_BY),
    updatedAt: normalizeText(row.UPDATED_AT),
  };
}

function normalizeWilayahCode(raw: unknown, width: number) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const trimmed = String(Number(digits));
  if (!Number.isFinite(Number(trimmed))) return "";
  return trimmed.padStart(width, "0");
}

function extractWilayahName(label: string) {
  const raw = String(label || "").trim();
  if (!raw) return "";
  const idx = raw.indexOf(" - ");
  return idx >= 0 ? raw.slice(idx + 3).trim() : raw;
}

async function enrichWilayahNames(session: any, rows: TrackingRow[]) {
  if (!rows.length) return rows.map(mapTracking);

  const defaults = resolveWilayahDefaults(session);
  const kecamatanList = await fetchKecamatan(defaults.noProp, defaults.noKab);
  const kecamatanNameByCode = new Map<string, string>();
  for (const item of kecamatanList) {
    const code = normalizeWilayahCode(item.value, 3);
    if (!code) continue;
    kecamatanNameByCode.set(code, extractWilayahName(item.label));
  }

  const uniqueKec = new Set<string>();
  for (const row of rows) {
    const code = normalizeWilayahCode(row.NO_KEC, 3);
    if (code) uniqueKec.add(code);
  }

  const kelurahanNameByKey = new Map<string, string>();
  await Promise.all(
    Array.from(uniqueKec).map(async (kecCode) => {
      const kelurahanList = await fetchKelurahan(defaults.noProp, defaults.noKab, kecCode);
      for (const item of kelurahanList) {
        const kelCode = normalizeWilayahCode(item.value, 3);
        if (!kelCode) continue;
        kelurahanNameByKey.set(`${kecCode}:${kelCode}`, extractWilayahName(item.label));
      }
    })
  );

  return rows.map((row) => {
    const mapped = mapTracking(row);
    const kecCode = normalizeWilayahCode(row.NO_KEC, 3);
    const kelCode = normalizeWilayahCode(row.NO_KEL, 3);
    const kecName = kecCode ? kecamatanNameByCode.get(kecCode) : "";
    const kelName = kecCode && kelCode ? kelurahanNameByKey.get(`${kecCode}:${kelCode}`) : "";
    return {
      ...mapped,
      kecamatan: kecName || mapped.kecamatan,
      kelurahan: kelName || mapped.kelurahan,
    };
  });
}

function getTodayYmd() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}

function normalizeNikText(value: unknown) {
  return normalizeUpper(String(value ?? "")).replace(/[^A-Z0-9-]/g, "").slice(0, 30);
}

const DEFAULT_BABY_NIK = "327300000000000";
const BBL_EXTRA_NOTE = "BBL";

export async function GET(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();

  try {
    // ============================================================
    // 1. AUTH
    // ============================================================
    const session = await readServerSession();

    if (!session?.S_USER_ID) {
      return unauthorized("Unauthorized");
    }

    // ============================================================
    // 2. PARAMETER
    // ============================================================
    const sp = req.nextUrl.searchParams;

    const start = normalizeText(sp.get("start"));
    const end = normalizeText(sp.get("end"));

    if ((start && !isIsoDate(start)) || (end && !isIsoDate(end))) {
      return badRequest("Tanggal filter tidak valid.");
    }

    const locationId = normalizeText(sp.get("locationId"));
    const productId = normalizeText(sp.get("productId"));
    const status = normalizeUpper(sp.get("status"));
    const petugas = normalizeUpper(sp.get("petugas"));
    const nik = normalizeDigits(sp.get("nik"), 16);
    const registrationNo = normalizeUpper(sp.get("registrationNo"));

    // ============================================================
    // 3. WHERE CLAUSE
    //
    // IMPORTANT:
    // Jangan gunakan TRUNC(CREATED_AT)
    // supaya index CREATED_AT tetap bisa digunakan Oracle.
    // ============================================================
    const conditions: string[] = [
      `T.IS_ACTIVE = 'Y'`,
    ];

    const binds: Record<string, unknown> = {};

    if (start) {
      conditions.push(`
        T.CREATED_AT >= TO_DATE(:b_start, 'YYYY-MM-DD')
      `);

      binds.b_start = start;
    }

    if (end) {
      conditions.push(`
        T.CREATED_AT < TO_DATE(:b_end, 'YYYY-MM-DD') + 1
      `);

      binds.b_end = end;
    }

    if (locationId) {
      conditions.push(`
        T.LOCATION_ID = TO_NUMBER(:b_location_id)
      `);

      binds.b_location_id = locationId;
    }

    if (productId) {
      conditions.push(`
        T.PRODUCT_ID = TO_NUMBER(:b_product_id)
      `);

      binds.b_product_id = productId;
    }

    if (status) {
      conditions.push(`
        T.STATUS = :b_status
      `);

      binds.b_status = status;
    }

    if (petugas) {
      conditions.push(`
        UPPER(T.CREATED_BY) LIKE '%' || :b_petugas || '%'
      `);

      binds.b_petugas = petugas;
    }

    if (nik) {
      conditions.push(`
        T.NIK = :b_nik
      `);

      binds.b_nik = nik;
    }

    if (registrationNo) {
      conditions.push(`
        UPPER(T.REGISTRATION_NO) LIKE '%' || :b_registration_no || '%'
      `);

      binds.b_registration_no = registrationNo;
    }

    const where = `
      WHERE ${conditions.join("\n        AND ")}
    `;

    // ============================================================
    // 4. QUERY DATA
    //
    // Summary status dihitung sekaligus menggunakan analytic
    // COUNT OVER(), sehingga tidak perlu query kedua.
    // ============================================================
    const rows = await execRows<TrackingRow & {
      STATUS_TOTAL?: number;
    }>(
      `
        SELECT
          T.REQUEST_ID,
          T.REGISTRATION_NO,
          T.QUEUE_NO,
          T.NO_DOK,
          T.EXTRA_NOTE,

          T.LOCATION_ID,
          L.LOCATION_CODE,
          L.LOCATION_NAME,
          L.LOCATION_GROUP,

          T.PRODUCT_ID,
          P.PRODUCT_CODE,
          P.PRODUCT_NAME,

          T.NIK,
          T.APPLICANT_NAME,

          T.NO_KEC,
          T.NO_KEL,
          T.ALAMAT,
          T.NO_RW,
          T.NO_RT,

          T.PHONE,
          T.EMAIL,

          T.STATUS,
          T.SOURCE,
          T.NOTES,

          T.CREATED_BY,

          TO_CHAR(
            T.CREATED_AT,
            'YYYY-MM-DD HH24:MI:SS'
          ) AS CREATED_AT,

          TO_CHAR(
            T.CREATED_AT,
            'DD-MM-YYYY'
          ) AS CREATED_DATE,

          TO_CHAR(
            T.CREATED_AT,
            'HH24:MI'
          ) AS CREATED_TIME,

          T.UPDATED_BY,

          TO_CHAR(
            T.UPDATED_AT,
            'YYYY-MM-DD HH24:MI:SS'
          ) AS UPDATED_AT,

          COUNT(*) OVER (
            PARTITION BY T.STATUS
          ) AS STATUS_TOTAL

        FROM M_TRACKING_REQUEST T

        JOIN M_TRACKING_LOCATION L
          ON L.LOCATION_ID = T.LOCATION_ID

        JOIN M_TRACKING_PRODUCT P
          ON P.PRODUCT_ID = T.PRODUCT_ID

        ${where}

        ORDER BY
          T.CREATED_AT DESC,
          T.REQUEST_ID DESC
      `,
      binds,
      {},
      ORACLE_ALIAS
    );

    // ============================================================
    // 5. SUMMARY
    //
    // Dibuat dari hasil query yang sama.
    // Tidak perlu SELECT COUNT kedua.
    // ============================================================
    const summary = TRACKING_STATUSES.reduce<Record<string, number>>(
      (acc, statusName) => {
        acc[statusName] = 0;
        return acc;
      },
      {}
    );

    for (const row of rows) {
      const key = normalizeUpper(row.STATUS);

      if (key && summary[key] !== undefined) {
        summary[key] = Number(row.STATUS_TOTAL ?? 0);
      }
    }

    // ============================================================
    // 6. MAP DATA
    // ============================================================
    const mappedRows = rows.map(mapTracking);

    // ============================================================
    // 7. LOG
    // ============================================================
    await Log.info({
      scope: "API",
      msg: "tracking/list",
      at: "/api/tracking-pengajuan",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: {
        count: mappedRows.length,
      },
    });

    // ============================================================
    // 8. RESPONSE
    // ============================================================
    return ok(
      {
        rows: mappedRows,
        summary,
      },
      "Data tracking berhasil dimuat"
    );

  } catch (e: any) {

    await Log.error({
      scope: "API",
      msg: "tracking/list_err",
      at: "/api/tracking-pengajuan",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: {
        name: e?.name ?? "Error",
        message: e?.message ?? String(e),
      },
    });

    return err(
      e?.message || "Gagal memuat tracking pengajuan"
    );
  }
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const locationId = Number(body.locationId ?? 0);
    const productId = Number(body.productId ?? 0);
    const nikDigits = normalizeDigits(body.nik, 16);
    const nikText = normalizeNikText(body.nik);
    const applicantName = normalizeUpper(body.applicantName ?? body.name);
    const noKec = normalizeText(body.noKec ?? "");
    const noKel = Number(body.noKel ?? 0);
    const alamat = normalizeUpper(body.alamat ?? "") || null;
    const noRw = Number(body.noRw ?? 0);
    const noRt = Number(body.noRt ?? 0);
    const phone = normalizeText(body.phone).replace(/[^\d+]/g, "").slice(0, 20) || null;
    const email = normalizeText(body.email).toLowerCase();
    const queueNoBody = normalizeUpper(body.queueNo).slice(0, 20);
    const noDok = normalizeUpper(body.noDok).slice(0, 100);
    const extraNote = normalizeUpper(body.extraNote).slice(0, 100);
    const notes = normalizeText(body.notes).slice(0, 500);
    const source = normalizeUpper(body.source) || "MANUAL";

    if (!Number.isFinite(locationId) || locationId <= 0) return badRequest("Lokasi layanan wajib dipilih.");
    if (!Number.isFinite(productId) || productId <= 0) return badRequest("Jenis pelayanan wajib dipilih.");
    if (!applicantName) return badRequest("Nama pemohon wajib diisi.");
    if (!noKec || noKec === "0") return badRequest("Kecamatan wajib diisi.");
    if (!Number.isFinite(noKel) || noKel <= 0) return badRequest("Kelurahan wajib diisi.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Format email tidak valid.");
    if (!["MANUAL", "SALAMAN", "ESPASI"].includes(source)) return badRequest("Source tidak valid.");

    let created: any = null;

    await withTransaction(
      async (conn) => {
        const relRes = await conn.execute(
          `
          SELECT L.LOCATION_CODE, L.LOCATION_NAME, L.LOCATION_GROUP, P.PRODUCT_CODE, P.PRODUCT_NAME
          FROM M_TRACKING_LOCATION_PRODUCT LP
          JOIN M_TRACKING_LOCATION L ON L.LOCATION_ID = LP.LOCATION_ID
          JOIN M_TRACKING_PRODUCT P ON P.PRODUCT_ID = LP.PRODUCT_ID
          WHERE LP.LOCATION_ID = :b_location_id
            AND LP.PRODUCT_ID = :b_product_id
            AND LP.IS_ACTIVE = 'Y'
            AND L.IS_ACTIVE = 'Y'
            AND P.IS_ACTIVE = 'Y'
          `,
          { b_location_id: locationId, b_product_id: productId },
          { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
        );
        const rel = (relRes.rows?.[0] as any) || null;
        if (!rel?.LOCATION_CODE || !rel?.PRODUCT_CODE) throw new Error("Jenis pelayanan tidak tersedia untuk lokasi yang dipilih.");
        if (!isTrackingSuperadminUser(session.S_USER_ID) && !isOfficeAllowedForLocation(session.S_NAMA_KANTOR, rel.LOCATION_CODE, rel.LOCATION_NAME)) {
          throw new Error("Lokasi layanan tidak sesuai dengan kantor user login.");
        }

        const productName = normalizeUpper(rel.PRODUCT_NAME);
        const isAktaKelahiran = productName.includes("AKTA KELAHIRAN");
        const isAktaKematian = productName.includes("AKTA KEMATIAN");
        const isGeraiLocation = locationId >= 31 && locationId <= 36;
        const isNikOptional = isAktaKelahiran || isAktaKematian;
        const isBbl = extraNote === BBL_EXTRA_NOTE;
        if (isBbl && !(isAktaKelahiran && isGeraiLocation)) {
          throw new Error("Flag BBL hanya berlaku untuk akta kelahiran di gerai.");
        }
        let nikForSave = nikDigits;
        if (isNikOptional) {
          if (nikText.includes("-KM-")) {
            throw new Error("Format NIK 3273-KM-06082026-0019 tidak diizinkan. Silakan isi format tersebut pada No. Dokumen.");
          }
          if (nikText && nikDigits.length !== 16) {
            throw new Error("Untuk akta kelahiran/kematian, NIK harus 16 digit atau boleh dikosongkan.");
          }
          if (isBbl) {
            if (nikDigits.length !== 16) {
              throw new Error("NIK bayi wajib 16 digit untuk BBL (Bayi Baru Lahir BPJS).");
            }
            nikForSave = nikDigits;
          } else {
            nikForSave = nikDigits.length === 16 ? nikDigits : DEFAULT_BABY_NIK;
          }
        } else if (nikDigits.length !== 16) {
          throw new Error("NIK pemohon wajib 16 digit.");
        }

        const ymd = getTodayYmd();
        const prefix = `REG-${rel.LOCATION_CODE}-${rel.PRODUCT_CODE}-${ymd}-`;
        const seqRes = await conn.execute(
          `
          SELECT NVL(MAX(TO_NUMBER(SUBSTR(REGISTRATION_NO, -3))), 0) + 1 AS NEXT_SEQ
          FROM M_TRACKING_REQUEST
          WHERE REGISTRATION_NO LIKE :b_prefix || '%'
          `,
          { b_prefix: prefix },
          { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
        );
        const nextSeq = Number((seqRes.rows?.[0] as any)?.NEXT_SEQ ?? 1);
        const registrationNo = `${prefix}${String(nextSeq).padStart(3, "0")}`;

        // compute next queue number for today, same location & product
        const queueRes = await conn.execute(
          `
          SELECT NVL(MAX(TO_NUMBER(QUEUE_NO)), 0) + 1 AS NEXT_QUEUE
          FROM M_TRACKING_REQUEST
          WHERE LOCATION_ID = :b_location_id
            AND PRODUCT_ID = :b_product_id
            AND TRUNC(CREATED_AT) = TRUNC(SYSDATE)
          `,
          { b_location_id: locationId, b_product_id: productId },
          { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
        );
        const nextQueue = Number((queueRes.rows?.[0] as any)?.NEXT_QUEUE ?? 1);
        const queueNo = String(nextQueue).padStart(3, "0");

        const noKelNum = Number.isFinite(noKel) && noKel > 0 ? noKel : null;
        const cleanPhone = phone == null ? null : String(phone);

        const insertBinds = {
          b_registration_no: String(registrationNo),
          b_queue_no: queueNo ? String(queueNo) : null,
          b_no_dok: noDok || null,
          b_extra_note: isBbl ? BBL_EXTRA_NOTE : null,
          b_location_id: Number(locationId),
          b_product_id: Number(productId),
          b_nik: String(nikForSave),
          b_applicant_name: String(applicantName),
          b_kecamatan: noKec ? String(noKec) : null,
          b_kelurahan: noKelNum,
          b_alamat: alamat ? String(alamat) : null,
          b_no_rw: Number.isFinite(noRw) && noRw > 0 ? noRw : null,
          b_no_rt: Number.isFinite(noRt) && noRt > 0 ? noRt : null,
          b_phone: cleanPhone,
          b_email: email ? String(email) : null,
          b_source: String(source),
          b_notes: notes ? String(notes) : null,
          b_user: String(session.S_USER_ID),
        } as const;

        // Log sanitized binds and SQL for debugging (avoid logging sensitive data)
        const insertSql = `
          INSERT INTO M_TRACKING_REQUEST (
            REGISTRATION_NO, QUEUE_NO, NO_DOK, EXTRA_NOTE, LOCATION_ID, PRODUCT_ID, NIK, APPLICANT_NAME,
            NO_KEC, NO_KEL, ALAMAT, NO_RW, NO_RT, PHONE, EMAIL, STATUS, SOURCE, NOTES, IS_ACTIVE, CREATED_BY, CREATED_AT
          ) VALUES (
            :b_registration_no, :b_queue_no, :b_no_dok, :b_extra_note, :b_location_id, :b_product_id, :b_nik, :b_applicant_name,
            :b_kecamatan, :b_kelurahan, :b_alamat, :b_no_rw, :b_no_rt, :b_phone, :b_email, 'BERKAS_MASUK', :b_source, :b_notes, 'Y', :b_user, SYSDATE
          )
        `;
        try {
          const debugBinds: Record<string, any> = {};
          for (const k of Object.keys(insertBinds)) {
            const v: any = (insertBinds as any)[k];
            if (k === 'b_request_id') {
              debugBinds[k] = { val: '<OUT>', typeName: 'DB_TYPE_NUMBER' };
            } else {
              debugBinds[k] = { val: v, valType: v == null ? String(v) : typeof v };
            }
          }
          await Log.info({ scope: "DB", msg: "tracking/insert_sql", at: ORACLE_ALIAS, extra: { sql: insertSql, binds: debugBinds } });
        } catch (e) {
          try { await Log.warn({ scope: "DB", msg: "tracking/insert_sql_log_fail", at: ORACLE_ALIAS, extra: { err: String(e) } }); } catch {}
        }

        // Diagnostic: print connection type and execute implementation
        try {
          await Log.info({ scope: "DB", msg: "tracking/conn_debug", at: ORACLE_ALIAS, extra: { connClass: conn?.constructor?.name } });
          // eslint-disable-next-line no-console
          console.log("Connection class:", conn?.constructor?.name);
          // eslint-disable-next-line no-console
          console.log("Execute function snippet:", String(conn?.execute).slice(0, 200));
          // oracledb diagnostics
          try {
            // eslint-disable-next-line no-console
            console.log("oracledb.versionString:", (oracledb as any).versionString || oracledb.version);
            // eslint-disable-next-line no-console
            console.log("oracledb.STRING:", (oracledb as any).STRING);
            // eslint-disable-next-line no-console
            console.log("oracledb.DB_TYPE_VARCHAR:", (oracledb as any).DB_TYPE_VARCHAR);
            // eslint-disable-next-line no-console
            console.log("oracledb.DB_TYPE_NUMBER:", (oracledb as any).DB_TYPE_NUMBER);
          } catch (e) {}
        } catch (e) {
          try { await Log.warn({ scope: "DB", msg: "tracking/conn_debug_fail", at: ORACLE_ALIAS, extra: { err: String(e) } }); } catch {}
        }

        // Optional hardcoded test execute — enable by setting ORACLE_DEBUG_HARD=1 in env
        let insertRes: any;
        // Print prototype and keys of insertBinds
        try {
          const proto = Object.getPrototypeOf(insertBinds);
          await Log.info({ scope: "DB", msg: "tracking/binds_proto", at: ORACLE_ALIAS, extra: { prototype: String(proto), keys: Object.keys(insertBinds), isPlain: proto === Object.prototype } });
          // eslint-disable-next-line no-console
          console.log("Prototype:", proto);
          // eslint-disable-next-line no-console
          console.log("Keys:", Object.keys(insertBinds));
          // eslint-disable-next-line no-console
          console.log("isPlain:", Object.getPrototypeOf(insertBinds) === Object.prototype);
        } catch (e) {}

        try {
          if (process.env.ORACLE_DEBUG_HARD === '1') {
            const hardBinds = {
              b_registration_no: "TEST-001",
              b_queue_no: "001",
              b_no_dok: noDok || null,
              b_extra_note: isBbl ? BBL_EXTRA_NOTE : null,
              b_location_id: Number(locationId),
              b_product_id: Number(productId),
              b_nik: String(nikForSave),
              b_applicant_name: String(applicantName),
              b_kecamatan: noKec ? String(noKec) : null,
              b_kelurahan: noKelNum,
              b_phone: cleanPhone,
              b_email: email ? String(email) : null,
              b_source: String(source),
              b_notes: notes ? String(notes) : null,
              b_user: String(session.S_USER_ID),
            };
            await Log.info({ scope: "DB", msg: "tracking/insert_hard_test", at: ORACLE_ALIAS });
            insertRes = await conn.execute(insertSql, hardBinds, { autoCommit: false });
            await Log.info({ scope: "DB", msg: "tracking/insert_hard_test_ok", at: ORACLE_ALIAS, extra: { rowsAffected: insertRes.rowsAffected } });
          } else {
            insertRes = await conn.execute(insertSql, insertBinds, { autoCommit: false });
          }
        } catch (e: any) {
          // Log full stack and error for diagnosis
          try {
            await Log.error({ scope: "DB", msg: "tracking/execute_err", at: ORACLE_ALIAS, err: { name: e?.name ?? 'Error', message: e?.message ?? String(e), stack: e?.stack } });
          } catch {}
          // also print to console
          // eslint-disable-next-line no-console
          console.error(e);
          // eslint-disable-next-line no-console
          console.error(e?.stack);
          throw e;
        }
        const selRes = await conn.execute(
          `
          SELECT
            T.REQUEST_ID,
            T.REGISTRATION_NO,
            T.QUEUE_NO,
            T.NO_DOK,
            T.EXTRA_NOTE,
            T.LOCATION_ID,
            L.LOCATION_CODE,
            L.LOCATION_NAME,
            L.LOCATION_GROUP,
            T.PRODUCT_ID,
            P.PRODUCT_CODE,
            P.PRODUCT_NAME,
            T.NIK,
            T.APPLICANT_NAME,
            T.NO_KEC,
            T.NO_KEL,
            T.PHONE,
            T.EMAIL,
            T.STATUS,
            T.SOURCE,
            T.NOTES,
            T.CREATED_BY,
            TO_CHAR(T.CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_AT,
            TO_CHAR(T.CREATED_AT, 'DD-MM-YYYY') AS CREATED_DATE,
            TO_CHAR(T.CREATED_AT, 'HH24:MI') AS CREATED_TIME,
            T.UPDATED_BY,
            TO_CHAR(T.UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS UPDATED_AT
          FROM M_TRACKING_REQUEST T
          JOIN M_TRACKING_LOCATION L ON L.LOCATION_ID = T.LOCATION_ID
          JOIN M_TRACKING_PRODUCT P ON P.PRODUCT_ID = T.PRODUCT_ID
          WHERE T.REGISTRATION_NO = :rno
          `,
          { rno: registrationNo },
          { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
        );
        const createdRow = selRes.rows?.[0] ?? null;
        created = createdRow ? mapTracking(createdRow as TrackingRow) : null;
      },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "tracking/create",
      at: "/api/tracking-pengajuan",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { registrationNo: created?.registrationNo },
    });

    return ok({ item: created }, "Pengajuan berhasil disimpan");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "tracking/create_err",
      at: "/api/tracking-pengajuan",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal menyimpan pengajuan");
  }
}
