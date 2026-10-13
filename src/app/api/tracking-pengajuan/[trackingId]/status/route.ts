// FILE: src/app/api/tracking-pengajuan/[trackingId]/status/route.ts
import type { NextRequest } from "next/server";
import oracledb from "oracledb";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { withTransaction } from "@/lib/db";
import { getClientInfo, readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import {
  isTrackingStatus,
  nextAllowedStatuses,
  normalizeText,
  normalizeUpper,
  TRACKING_STATUS_LABELS,
  type TrackingStatus,
} from "@/lib/tracking/constants";
import { isOfficeAllowedForLocation } from "@/lib/tracking/office-location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_TRACKING ?? "DB";
const TRACKING_SUPERADMIN_USER = "ASSIST_YZ";

type Params = { params: Promise<{ trackingId: string }> };

function statusLabel(status: unknown) {
  const key = normalizeUpper(status) as keyof typeof TRACKING_STATUS_LABELS;
  return TRACKING_STATUS_LABELS[key] || normalizeText(status);
}

function normalizeUserKey(value: unknown) {
  return normalizeUpper(String(value ?? "")).trim();
}

function isTrackingSuperadminUser(value: unknown) {
  return normalizeUserKey(value) === TRACKING_SUPERADMIN_USER;
}

export async function POST(req: NextRequest, ctx: Params) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const { trackingId: rawId } = await ctx.params;
    const requestId = Number(rawId);
    if (!Number.isFinite(requestId) || requestId <= 0) return badRequest("Request ID tidak valid.");

    const body = await req.json().catch(() => ({}));
    const status = normalizeUpper(body.status);
    const description = normalizeText(body.description ?? "").slice(0, 500);
    if (!isTrackingStatus(status)) return badRequest("Status tidak valid.");
    if (status === "BATAL" && !description) return badRequest("Catatan petugas wajib diisi untuk status Batal.");

    let updated: any = null;

    await withTransaction(
      async (conn) => {
        const curRes = await conn.execute(
          `
          SELECT REQUEST_ID, STATUS, LOCATION_ID
          FROM M_TRACKING_REQUEST
          WHERE REQUEST_ID = :b_request_id
            AND IS_ACTIVE = 'Y'
          FOR UPDATE
          `,
          { b_request_id: requestId },
          { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
        );
        const current = (curRes.rows?.[0] as any) || null;
        if (!current) throw new Error("Data tracking tidak ditemukan.");

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
        if (!isTrackingSuperadminUser(session.S_USER_ID) && !isOfficeAllowedForLocation(session.S_NAMA_KANTOR, existingLocation.LOCATION_CODE, existingLocation.LOCATION_NAME)) {
          const forbidden = new Error("Anda tidak memiliki hak akses lokasi untuk memperbarui status data ini.");
          (forbidden as any).status = 403;
          throw forbidden;
        }

        const currentStatus = normalizeUpper(current.STATUS) as TrackingStatus;
        const allowed = nextAllowedStatuses(currentStatus);
        if (!allowed.includes(status as TrackingStatus)) {
          throw new Error(`Status ${statusLabel(currentStatus)} tidak dapat diubah ke ${statusLabel(status)}.`);
        }

        await conn.execute(
          `
          UPDATE M_TRACKING_REQUEST
          SET STATUS = :b_status,
              NOTES = CASE WHEN :b_notes IS NULL THEN NOTES ELSE :b_notes END,
              UPDATED_BY = :b_user,
              UPDATED_AT = SYSDATE
          WHERE REQUEST_ID = :b_request_id
          `,
          {
            b_status: status,
            b_notes: description || null,
            b_user: session.S_USER_ID,
            b_request_id: requestId,
          },
          { autoCommit: false }
        );

        const detailRes = await conn.execute(
          `
          SELECT
            T.REQUEST_ID,
            T.REGISTRATION_NO,
            L.LOCATION_NAME,
            P.PRODUCT_NAME,
            T.NIK,
            T.APPLICANT_NAME,
            T.STATUS,
            T.NOTES,
            TO_CHAR(T.UPDATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS UPDATED_AT
          FROM M_TRACKING_REQUEST T
          JOIN M_TRACKING_LOCATION L ON L.LOCATION_ID = T.LOCATION_ID
          JOIN M_TRACKING_PRODUCT P ON P.PRODUCT_ID = T.PRODUCT_ID
          WHERE T.REQUEST_ID = :b_request_id
          `,
          { b_request_id: requestId },
          { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
        );
        const row = (detailRes.rows?.[0] as any) || {};
        updated = {
          trackingId: Number(row.REQUEST_ID),
          requestId: Number(row.REQUEST_ID),
          registrationNo: normalizeText(row.REGISTRATION_NO),
          locationName: normalizeText(row.LOCATION_NAME),
          productName: normalizeText(row.PRODUCT_NAME),
          nik: normalizeText(row.NIK),
          name: normalizeText(row.APPLICANT_NAME),
          applicantName: normalizeText(row.APPLICANT_NAME),
          status: normalizeText(row.STATUS),
          statusLabel: statusLabel(row.STATUS),
          notes: normalizeText(row.NOTES),
          updatedAt: normalizeText(row.UPDATED_AT),
        };
      },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "tracking/status",
      at: "/api/tracking-pengajuan/[trackingId]/status",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { requestId, status },
    });

    return ok({ item: updated }, "Status tracking berhasil diperbarui");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "tracking/status_err",
      at: "/api/tracking-pengajuan/[trackingId]/status",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal memperbarui status tracking", Number(e?.status || 500));
  }
}
