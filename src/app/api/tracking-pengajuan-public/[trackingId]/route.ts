import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { execOne, withTransaction } from "@/lib/db";
import { getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";
import oracledb from "oracledb";
import { normalizeDigits, normalizeText, normalizeUpper, TRACKING_STATUS_LABELS } from "@/lib/tracking/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_TRACKING ?? "DB";
const DEFAULT_BABY_NIK = "327300000000000";
const BBL_EXTRA_NOTE = "BBL";

type Params = { params: Promise<{ trackingId: string }> };

function statusLabel(status: unknown) {
  const key = normalizeUpper(status) as keyof typeof TRACKING_STATUS_LABELS;
  return TRACKING_STATUS_LABELS[key] || normalizeText(status);
}

function toNumber(raw: unknown) {
  const value = Number(raw ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function normalizeNikText(value: unknown) {
  return normalizeUpper(String(value ?? "")).replace(/[^A-Z0-9-]/g, "").slice(0, 30);
}

async function loadUpdatedItem(conn: any, requestId: number) {
  const detailRes = await conn.execute(
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
      TO_CHAR(T.CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_AT,
      TO_CHAR(T.CREATED_AT, 'DD-MM-YYYY') AS CREATED_DATE,
      TO_CHAR(T.CREATED_AT, 'HH24:MI') AS CREATED_TIME,
      T.UPDATED_BY,
      TO_CHAR(T.UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS UPDATED_AT
    FROM M_TRACKING_REQUEST T
    JOIN M_TRACKING_LOCATION L ON L.LOCATION_ID = T.LOCATION_ID
    JOIN M_TRACKING_PRODUCT P ON P.PRODUCT_ID = T.PRODUCT_ID
    WHERE T.REQUEST_ID = :b_request_id
      AND T.IS_ACTIVE = 'Y'
    `,
    { b_request_id: requestId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
  );
  const row = (detailRes.rows?.[0] as any) || null;
  if (!row) return null;
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
    productId: Number(row.PRODUCT_ID),
    productCode: normalizeText(row.PRODUCT_CODE),
    productName: normalizeText(row.PRODUCT_NAME),
    nik: normalizeText(row.NIK),
    name: normalizeText(row.APPLICANT_NAME),
    applicantName: normalizeText(row.APPLICANT_NAME),
    noKec: normalizeText(row.NO_KEC),
    noKel: normalizeText(row.NO_KEL),
    district: normalizeText(row.NO_KEC),
    kecamatan: normalizeText(row.NO_KEC),
    kelurahan: normalizeText(row.NO_KEL),
    alamat: normalizeText(row.ALAMAT),
    noRw: normalizeText(row.NO_RW),
    noRt: normalizeText(row.NO_RT),
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

export async function GET(_req: NextRequest, ctx: Params) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const { trackingId: rawId } = await ctx.params;
    const requestId = Number(rawId);
    if (!Number.isFinite(requestId) || requestId <= 0) return badRequest("Request ID tidak valid.");

    const row = await execOne<any>(
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
        TO_CHAR(T.CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_AT,
        TO_CHAR(T.CREATED_AT, 'DD-MM-YYYY') AS CREATED_DATE,
        TO_CHAR(T.CREATED_AT, 'HH24:MI') AS CREATED_TIME,
        T.UPDATED_BY,
        TO_CHAR(T.UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS UPDATED_AT
      FROM M_TRACKING_REQUEST T
      JOIN M_TRACKING_LOCATION L ON L.LOCATION_ID = T.LOCATION_ID
      JOIN M_TRACKING_PRODUCT P ON P.PRODUCT_ID = T.PRODUCT_ID
      WHERE T.REQUEST_ID = :b_request_id
        AND T.IS_ACTIVE = 'Y'
      `,
      { b_request_id: requestId },
      {},
      ORACLE_ALIAS
    );

    if (!row) return badRequest("Data tracking tidak ditemukan.");

    await Log.info({
      scope: "API",
      msg: "tracking/detail public",
      at: "/api/tracking-pengajuan-public/[trackingId]",
      user: "PUBLIC",
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { requestId },
    });

    return ok({ item: await loadUpdatedItem({ execute: async (...args: any[]) => ({ rows: [row] }) } as any, requestId), history: [] });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "tracking/detail public err",
      at: "/api/tracking-pengajuan-public/[trackingId]",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat detail tracking public");
  }
}

export async function PATCH(req: NextRequest, ctx: Params) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const { trackingId: rawId } = await ctx.params;
    const requestId = Number(rawId);
    if (!Number.isFinite(requestId) || requestId <= 0) return badRequest("Request ID tidak valid.");

    const body = await req.json().catch(() => ({}));
    const locationId = toNumber(body.locationId);
    const productId = toNumber(body.productId);
    const nikDigits = normalizeDigits(body.nik, 16);
    const nikText = normalizeNikText(body.nik);
    const applicantName = normalizeUpper(body.applicantName ?? body.name);
    const noKec = normalizeText(body.noKec ?? "");
    const noKel = toNumber(body.noKel);
    const alamat = normalizeUpper(body.alamat ?? "") || null;
    const noRw = toNumber(body.noRw);
    const noRt = toNumber(body.noRt);
    const noDok = normalizeUpper(body.noDok).slice(0, 100);
    const extraNote = normalizeUpper(body.extraNote).slice(0, 100);
    const phone = String(body.phone ?? "").replace(/[^\d+]/g, "").slice(0, 20) || null;
    const email = String(normalizeText(body.email) ?? "").toLowerCase();
    const notes = String(normalizeText(body.notes) ?? "").slice(0, 500);
    const source = normalizeUpper(body.source) || "MANUAL";

    if (!Number.isFinite(locationId) || locationId <= 0) return badRequest("Lokasi layanan wajib dipilih.");
    if (!Number.isFinite(productId) || productId <= 0) return badRequest("Jenis pelayanan wajib dipilih.");
    if (!applicantName) return badRequest("Nama pemohon wajib diisi.");
    if (!noKec || noKec === "0") return badRequest("Kecamatan wajib diisi.");
    if (!Number.isFinite(noKel) || noKel <= 0) return badRequest("Kelurahan wajib diisi.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Format email tidak valid.");
    if (!["MANUAL", "SALAMAN"].includes(source)) return badRequest("Source tidak valid.");

    const item = await withTransaction(async (conn) => {
      const currentRes = await conn.execute(
        `
        SELECT REQUEST_ID, STATUS, IS_ACTIVE, LOCATION_ID
        FROM M_TRACKING_REQUEST
        WHERE REQUEST_ID = :b_request_id
        FOR UPDATE
        `,
        { b_request_id: requestId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
      );
      const current = (currentRes.rows?.[0] as any) || null;
      if (!current || normalizeText(current.IS_ACTIVE) !== "Y") throw new Error("Data tracking tidak ditemukan.");

      const existingLocationRes = await conn.execute(
        `
        SELECT LOCATION_CODE, LOCATION_NAME
        FROM M_TRACKING_LOCATION
        WHERE LOCATION_ID = :b_location_id
        `,
        { b_location_id: Number(current.LOCATION_ID ?? 0) },
        { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
      );
      const existingLocation = (existingLocationRes.rows?.[0] as any) || null;
      if (!existingLocation) throw new Error("Lokasi layanan tracking tidak ditemukan.");

      const relRes = await conn.execute(
        `
        SELECT L.LOCATION_CODE, L.LOCATION_NAME, L.LOCATION_GROUP, P.PRODUCT_NAME
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
      if (!(relRes.rows?.length ?? 0)) throw new Error("Jenis pelayanan tidak tersedia untuk lokasi yang dipilih.");
      const rel = (relRes.rows?.[0] as any) || {};
      
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

      await conn.execute(
        `
        UPDATE M_TRACKING_REQUEST
        SET LOCATION_ID = :b_location_id,
            PRODUCT_ID = :b_product_id,
            NIK = :b_nik,
            APPLICANT_NAME = :b_applicant_name,
            NO_KEC = :b_no_kec,
            NO_KEL = :b_no_kel,
            ALAMAT = :b_alamat,
            NO_RW = :b_no_rw,
            NO_RT = :b_no_rt,
            NO_DOK = :b_no_dok,
            EXTRA_NOTE = :b_extra_note,
            PHONE = :b_phone,
            EMAIL = :b_email,
            NOTES = :b_notes,
            SOURCE = :b_source,
            UPDATED_BY = :b_user,
            UPDATED_AT = SYSDATE
        WHERE REQUEST_ID = :b_request_id
        `,
        {
          b_location_id: locationId,
          b_product_id: productId,
          b_nik: nikForSave,
          b_applicant_name: applicantName,
          b_no_kec: noKec,
          b_no_kel: noKel,
          b_alamat: alamat,
          b_no_rw: Number.isFinite(noRw) && noRw > 0 ? noRw : null,
          b_no_rt: Number.isFinite(noRt) && noRt > 0 ? noRt : null,
          b_no_dok: noDok || null,
          b_extra_note: isBbl ? BBL_EXTRA_NOTE : null,
          b_phone: phone,
          b_email: email || null,
          b_notes: notes || null,
          b_source: source,
          b_user: "PUBLIC",
          b_request_id: requestId,
        },
        { autoCommit: false }
      );

      return loadUpdatedItem(conn, requestId);
    }, ORACLE_ALIAS);

    await Log.info({
      scope: "API",
      msg: "tracking/update public",
      at: "/api/tracking-pengajuan-public/[trackingId]",
      user: "PUBLIC",
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { requestId },
    });

    return ok({ item }, "Pengajuan berhasil diperbarui");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "tracking/update public err",
      at: "/api/tracking-pengajuan-public/[trackingId]",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memperbarui tracking public", Number(e?.status || 500));
  }
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const { trackingId: rawId } = await ctx.params;
    const requestId = Number(rawId);
    if (!Number.isFinite(requestId) || requestId <= 0) return badRequest("Request ID tidak valid.");

    const deleted = await withTransaction(async (conn) => {
      const currentRes = await conn.execute(
        `
        SELECT REQUEST_ID, REGISTRATION_NO, IS_ACTIVE, LOCATION_ID
        FROM M_TRACKING_REQUEST
        WHERE REQUEST_ID = :b_request_id
        FOR UPDATE
        `,
        { b_request_id: requestId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
      );
      const current = (currentRes.rows?.[0] as any) || null;
      if (!current || normalizeText(current.IS_ACTIVE) !== "Y") throw new Error("Data tracking tidak ditemukan.");

      const existingLocationRes = await conn.execute(
        `
        SELECT LOCATION_CODE, LOCATION_NAME
        FROM M_TRACKING_LOCATION
        WHERE LOCATION_ID = :b_location_id
        `,
        { b_location_id: Number(current.LOCATION_ID ?? 0) },
        { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
      );
      const existingLocation = (existingLocationRes.rows?.[0] as any) || null;
      if (!existingLocation) throw new Error("Lokasi layanan tracking tidak ditemukan.");

      await conn.execute(
        `
        UPDATE M_TRACKING_REQUEST
        SET IS_ACTIVE = 'N',
            UPDATED_BY = :b_user,
            UPDATED_AT = SYSDATE
        WHERE REQUEST_ID = :b_request_id
        `,
        { b_user: "PUBLIC", b_request_id: requestId },
        { autoCommit: false }
      );

      return {
        trackingId: requestId,
        registrationNo: normalizeText(current.REGISTRATION_NO),
      };
    }, ORACLE_ALIAS);

    await Log.info({
      scope: "API",
      msg: "tracking/delete public",
      at: "/api/tracking-pengajuan-public/[trackingId]",
      user: "PUBLIC",
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { requestId },
    });

    return ok({ item: deleted }, "Pengajuan berhasil dihapus");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "tracking/delete public err",
      at: "/api/tracking-pengajuan-public/[trackingId]",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal menghapus tracking public", Number(e?.status || 500));
  }
}
