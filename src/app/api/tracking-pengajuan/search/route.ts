// FILE: src/app/api/tracking-pengajuan/search/route.ts
import type { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { getClientInfo, readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import { normalizeDigits, normalizeText, normalizeUpper, TRACKING_STATUS_LABELS } from "@/lib/tracking/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_TRACKING ?? "DB";

function statusLabel(status: unknown) {
  const key = normalizeUpper(status) as keyof typeof TRACKING_STATUS_LABELS;
  return TRACKING_STATUS_LABELS[key] || normalizeText(status);
}

export async function GET(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const q = normalizeText(req.nextUrl.searchParams.get("q"));
    const registrationNo = normalizeUpper(req.nextUrl.searchParams.get("registrationNo") || q);
    const nik = normalizeDigits(req.nextUrl.searchParams.get("nik") || q, 16);

    const registrationBind = registrationNo.startsWith("REG-") ? registrationNo : "";
    const nikBind = nik.length === 16 ? nik : "";

    if (!registrationNo && !nik) return badRequest("Nomor registrasi atau NIK wajib diisi.");
    if (q && /^\d+$/.test(q) && q.length !== 16) return badRequest("NIK wajib 16 digit.");
    if (!registrationBind && !nikBind) return badRequest("Masukkan nomor registrasi REG-... atau NIK 16 digit.");

    const rows = await execRows<any>(
      `
      SELECT
        T.REQUEST_ID,
        T.REGISTRATION_NO,
        T.APPLICANT_NAME,
        T.NIK,
        P.PRODUCT_NAME,
        L.LOCATION_NAME,
        TO_CHAR(T.CREATED_AT, 'DD-MM-YYYY') AS CREATED_DATE,
        T.STATUS
      FROM M_TRACKING_REQUEST T
      JOIN M_TRACKING_LOCATION L ON L.LOCATION_ID = T.LOCATION_ID
      JOIN M_TRACKING_PRODUCT P ON P.PRODUCT_ID = T.PRODUCT_ID
      WHERE T.IS_ACTIVE = 'Y'
        AND (
          (:b_registration_no IS NOT NULL AND UPPER(T.REGISTRATION_NO) = :b_registration_no)
          OR (:b_nik IS NOT NULL AND T.NIK = :b_nik)
        )
      ORDER BY T.CREATED_AT DESC, T.REQUEST_ID DESC
      `,
      {
        b_registration_no: registrationBind || null,
        b_nik: nikBind || null,
      },
      {},
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "tracking/search",
      at: "/api/tracking-pengajuan/search",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { count: rows.length },
    });

    return ok(
      {
        rows: rows.map((row) => ({
          trackingId: Number(row.REQUEST_ID),
          requestId: Number(row.REQUEST_ID),
          registrationNo: normalizeText(row.REGISTRATION_NO),
          name: normalizeText(row.APPLICANT_NAME),
          applicantName: normalizeText(row.APPLICANT_NAME),
          nik: normalizeText(row.NIK),
          productName: normalizeText(row.PRODUCT_NAME),
          locationName: normalizeText(row.LOCATION_NAME),
          date: normalizeText(row.CREATED_DATE),
          status: normalizeText(row.STATUS),
          statusLabel: statusLabel(row.STATUS),
        })),
      },
      "Hasil pencarian tracking berhasil dimuat"
    );
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "tracking/search_err",
      at: "/api/tracking-pengajuan/search",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal mencari tracking pengajuan");
  }
}

