// FILE: src/app/api/tracking-pengajuan/[trackingId]/route.ts
import type { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execOne } from "@/lib/db";
import { getClientInfo, readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import { normalizeText, normalizeUpper, TRACKING_STATUS_LABELS } from "@/lib/tracking/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_TRACKING ?? "DB";

type Params = { params: Promise<{ trackingId: string }> };

function statusLabel(status: unknown) {
  const key = normalizeUpper(status) as keyof typeof TRACKING_STATUS_LABELS;
  return TRACKING_STATUS_LABELS[key] || normalizeText(status);
}

export async function GET(_req: NextRequest, ctx: Params) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const { trackingId: rawId } = await ctx.params;
    const requestId = Number(rawId);
    if (!Number.isFinite(requestId) || requestId <= 0) return badRequest("Request ID tidak valid.");

    const row = await execOne<any>(
      `
      SELECT
        T.REQUEST_ID,
        T.REGISTRATION_NO,
        T.QUEUE_NO,
        T.LOCATION_ID,
        L.LOCATION_CODE,
        L.LOCATION_NAME,
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
        AND T.IS_ACTIVE = 'Y'
      `,
      { b_request_id: requestId },
      {},
      ORACLE_ALIAS
    );

    if (!row) return badRequest("Data tracking tidak ditemukan.");

    await Log.info({
      scope: "API",
      msg: "tracking/detail",
      at: "/api/tracking-pengajuan/[trackingId]",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { requestId },
    });

    return ok({
      item: {
        trackingId: Number(row.REQUEST_ID),
        requestId: Number(row.REQUEST_ID),
        registrationNo: normalizeText(row.REGISTRATION_NO),
        queueNo: normalizeText(row.QUEUE_NO),
        locationId: Number(row.LOCATION_ID),
        locationCode: normalizeText(row.LOCATION_CODE),
        locationName: normalizeText(row.LOCATION_NAME),
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
      },
      history: [],
    });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "tracking/detail_err",
      at: "/api/tracking-pengajuan/[trackingId]",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat detail tracking");
  }
}
