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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_TRACKING ?? "DB";

type TrackingRow = {
  REQUEST_ID: number;
  REGISTRATION_NO: string;
  QUEUE_NO: string | null;
  LOCATION_ID: number;
  LOCATION_CODE: string;
  LOCATION_NAME: string;
  LOCATION_GROUP: string;
  PRODUCT_ID: number;
  PRODUCT_CODE: string;
  PRODUCT_NAME: string;
  NIK: string;
  APPLICANT_NAME: string;
  DISTRICT: string | null;
  VILLAGE: string | null;
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

function mapTracking(row: TrackingRow) {
  return {
    trackingId: Number(row.REQUEST_ID),
    requestId: Number(row.REQUEST_ID),
    registrationNo: normalizeText(row.REGISTRATION_NO),
    queueNo: normalizeText(row.QUEUE_NO),
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
    district: normalizeText(row.DISTRICT),
    village: normalizeText(row.VILLAGE),
    kecamatan: normalizeText(row.DISTRICT),
    kelurahan: normalizeText(row.VILLAGE),
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

function getTodayYmd() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const sp = req.nextUrl.searchParams;
    const start = normalizeText(sp.get("start"));
    const end = normalizeText(sp.get("end"));
    if ((start && !isIsoDate(start)) || (end && !isIsoDate(end))) return badRequest("Tanggal filter tidak valid.");

    const binds: Record<string, unknown> = {
      b_start: start || null,
      b_end: end || null,
      b_location_id: normalizeText(sp.get("locationId")) || null,
      b_product_id: normalizeText(sp.get("productId")) || null,
      b_status: normalizeUpper(sp.get("status")) || null,
      b_petugas: normalizeUpper(sp.get("petugas")) || null,
      b_nik: normalizeDigits(sp.get("nik"), 16) || null,
      b_registration_no: normalizeUpper(sp.get("registrationNo")) || null,
    };

    const where = `
      WHERE T.IS_ACTIVE = 'Y'
        AND (:b_start IS NULL OR TRUNC(T.CREATED_AT) >= TO_DATE(:b_start, 'YYYY-MM-DD'))
        AND (:b_end IS NULL OR TRUNC(T.CREATED_AT) <= TO_DATE(:b_end, 'YYYY-MM-DD'))
        AND (:b_location_id IS NULL OR T.LOCATION_ID = TO_NUMBER(:b_location_id))
        AND (:b_product_id IS NULL OR T.PRODUCT_ID = TO_NUMBER(:b_product_id))
        AND (:b_status IS NULL OR T.STATUS = :b_status)
        AND (:b_petugas IS NULL OR UPPER(T.CREATED_BY) LIKE '%' || :b_petugas || '%')
        AND (:b_nik IS NULL OR T.NIK = :b_nik)
        AND (:b_registration_no IS NULL OR UPPER(T.REGISTRATION_NO) LIKE '%' || :b_registration_no || '%')
    `;

    const rows = await execRows<TrackingRow>(
      `
      SELECT
        T.REQUEST_ID,
        T.REGISTRATION_NO,
        T.QUEUE_NO,
        T.LOCATION_ID,
        L.LOCATION_CODE,
        L.LOCATION_NAME,
        L.LOCATION_GROUP,
        T.PRODUCT_ID,
        P.PRODUCT_CODE,
        P.PRODUCT_NAME,
        T.NIK,
        T.APPLICANT_NAME,
        T.DISTRICT,
        T.VILLAGE,
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
      ${where}
      ORDER BY T.CREATED_AT DESC, T.REQUEST_ID DESC
      `,
      binds,
      {},
      ORACLE_ALIAS
    );

    const summaryRows = await execRows<{ STATUS: string; TOTAL: number }>(
      `
      SELECT T.STATUS, COUNT(*) AS TOTAL
      FROM M_TRACKING_REQUEST T
      ${where}
      GROUP BY T.STATUS
      `,
      binds,
      {},
      ORACLE_ALIAS
    );

    const summary = TRACKING_STATUSES.reduce<Record<string, number>>((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});
    for (const row of summaryRows) summary[normalizeUpper(row.STATUS)] = Number(row.TOTAL ?? 0);

    await Log.info({
      scope: "API",
      msg: "tracking/list",
      at: "/api/tracking-pengajuan",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { count: rows.length },
    });

    return ok({ rows: rows.map(mapTracking), summary }, "Data tracking berhasil dimuat");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "tracking/list_err",
      at: "/api/tracking-pengajuan",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat tracking pengajuan");
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
    const nik = normalizeDigits(body.nik, 16);
    const applicantName = normalizeUpper(body.applicantName ?? body.name);
    const kecamatan = normalizeUpper(body.kecamatan ?? body.district);
    const kelurahan = normalizeUpper(body.kelurahan ?? body.village);
    const phone = normalizeText(body.phone).replace(/[^\d+]/g, "").slice(0, 20);
    const email = normalizeText(body.email).toLowerCase();
    const queueNo = normalizeUpper(body.queueNo).slice(0, 20);
    const notes = normalizeText(body.notes).slice(0, 500);
    const source = normalizeUpper(body.source) || "MANUAL";

    if (!Number.isFinite(locationId) || locationId <= 0) return badRequest("Lokasi layanan wajib dipilih.");
    if (!Number.isFinite(productId) || productId <= 0) return badRequest("Jenis pelayanan wajib dipilih.");
    if (nik.length !== 16) return badRequest("NIK pemohon wajib 16 digit.");
    if (!applicantName) return badRequest("Nama pemohon wajib diisi.");
    if (!kecamatan) return badRequest("Kecamatan wajib diisi.");
    if (!kelurahan) return badRequest("Kelurahan wajib diisi.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Format email tidak valid.");
    if (!["MANUAL", "SALAMAN"].includes(source)) return badRequest("Source tidak valid.");

    let created: any = null;

    await withTransaction(
      async (conn) => {
        const relRes = await conn.execute(
          `
          SELECT L.LOCATION_CODE, P.PRODUCT_CODE
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

        const ymd = getTodayYmd();
        const prefix = `REG-${rel.LOCATION_CODE}-${rel.PRODUCT_CODE}-${ymd}-`;
        const seqRes = await conn.execute(
          `
          SELECT NVL(MAX(TO_NUMBER(SUBSTR(REGISTRATION_NO, -6))), 0) + 1 AS NEXT_SEQ
          FROM M_TRACKING_REQUEST
          WHERE REGISTRATION_NO LIKE :b_prefix || '%'
          `,
          { b_prefix: prefix },
          { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
        );
        const nextSeq = Number((seqRes.rows?.[0] as any)?.NEXT_SEQ ?? 1);
        const registrationNo = `${prefix}${String(nextSeq).padStart(6, "0")}`;

        const insertRes = await conn.execute(
          `
          INSERT INTO M_TRACKING_REQUEST (
            REGISTRATION_NO, QUEUE_NO, LOCATION_ID, PRODUCT_ID, NIK, APPLICANT_NAME,
            DISTRICT, VILLAGE, PHONE, EMAIL, STATUS, SOURCE, NOTES, IS_ACTIVE, CREATED_BY, CREATED_AT
          ) VALUES (
            :b_registration_no, :b_queue_no, :b_location_id, :b_product_id, :b_nik, :b_applicant_name,
            :b_kecamatan, :b_kelurahan, :b_phone, :b_email, 'BERKAS_MASUK', :b_source, :b_notes, 'Y', :b_user, SYSDATE
          )
          RETURNING REQUEST_ID INTO :b_request_id
          `,
          {
            b_registration_no: registrationNo,
            b_queue_no: queueNo || null,
            b_location_id: locationId,
            b_product_id: productId,
            b_nik: nik,
            b_applicant_name: applicantName,
            b_kecamatan: kecamatan,
            b_kelurahan: kelurahan,
            b_phone: phone || null,
            b_email: email || null,
            b_source: source,
            b_notes: notes || null,
            b_user: session.S_USER_ID,
            b_request_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          },
          { autoCommit: false }
        );
        const requestId = Number((insertRes.outBinds as any)?.b_request_id?.[0] ?? 0);

        const detailRes = await conn.execute(
          `
          SELECT
            T.REQUEST_ID,
            T.REGISTRATION_NO,
            T.QUEUE_NO,
            T.LOCATION_ID,
            L.LOCATION_CODE,
            L.LOCATION_NAME,
            L.LOCATION_GROUP,
            T.PRODUCT_ID,
            P.PRODUCT_CODE,
            P.PRODUCT_NAME,
            T.NIK,
            T.APPLICANT_NAME,
            T.DISTRICT,
            T.VILLAGE,
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
          WHERE T.REQUEST_ID = :b_request_id
          `,
          { b_request_id: requestId },
          { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
        );
        created = mapTracking(detailRes.rows?.[0] as TrackingRow);
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
