// FILE: src/app/api/tracking-pengajuan/search/route.ts
import type { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { getClientInfo, readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import { syncAutoCompletedTracking } from "@/lib/tracking/auto-complete";
import { normalizeDigits, normalizeText, normalizeUpper, TRACKING_STATUS_LABELS } from "@/lib/tracking/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_TRACKING ?? "DB";

function parseSearchTerms(raw: string) {
  const chunks = raw
    .split(",")
    .map((item) => normalizeText(item))
    .filter(Boolean);

  const registrationNos = new Set<string>();
  const niks = new Set<string>();
  const invalidTerms: string[] = [];

  for (const chunk of chunks) {
    const reg = normalizeUpper(chunk);
    const nik = normalizeDigits(chunk, 16);
    const numericOnly = /^\d+$/.test(chunk);

    if (reg.startsWith("REG-")) {
      registrationNos.add(reg);
      continue;
    }
    if (nik.length === 16) {
      niks.add(nik);
      continue;
    }
    if (numericOnly || reg) {
      invalidTerms.push(chunk);
    }
  }

  return {
    registrationNos: Array.from(registrationNos),
    niks: Array.from(niks),
    invalidTerms,
  };
}

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

    const syncResult = await syncAutoCompletedTracking();

    const q = normalizeText(req.nextUrl.searchParams.get("q"));
    const registrationNoParam = normalizeText(req.nextUrl.searchParams.get("registrationNo"));
    const nikParam = normalizeText(req.nextUrl.searchParams.get("nik"));

    const mergedRaw = [q, registrationNoParam, nikParam].filter(Boolean).join(",");
    if (!mergedRaw) return badRequest("Nomor registrasi atau NIK wajib diisi.");

    const parsed = parseSearchTerms(mergedRaw);
    if (parsed.invalidTerms.length) {
      return badRequest(
        `Format pencarian tidak valid: ${parsed.invalidTerms.join(", ")}. Gunakan nomor registrasi REG-... atau NIK 16 digit.`
      );
    }
    if (!parsed.registrationNos.length && !parsed.niks.length) {
      return badRequest("Masukkan nomor registrasi REG-... atau NIK 16 digit.");
    }

    const binds: Record<string, string | null> = {};
    const clauses: string[] = [];

    if (parsed.registrationNos.length) {
      const regPlaceholders = parsed.registrationNos.map((value, idx) => {
        const key = `b_reg_${idx}`;
        binds[key] = value;
        return `:${key}`;
      });
      clauses.push(`UPPER(T.REGISTRATION_NO) IN (${regPlaceholders.join(",")})`);
    }

    if (parsed.niks.length) {
      const nikPlaceholders = parsed.niks.map((value, idx) => {
        const key = `b_nik_${idx}`;
        binds[key] = value;
        return `:${key}`;
      });
      clauses.push(`T.NIK IN (${nikPlaceholders.join(",")})`);
    }

    const rows = await execRows<any>(
      `
      SELECT
        T.REQUEST_ID,
        T.REGISTRATION_NO,
        T.APPLICANT_NAME,
        T.NIK,
        T.EXTRA_NOTE,
        T.NOTES,
        T.CREATED_BY,
        P.PRODUCT_NAME,
        L.LOCATION_NAME,
        TO_CHAR(T.CREATED_AT, 'DD-MM-YYYY') AS CREATED_DATE,
        T.STATUS
      FROM M_TRACKING_REQUEST T
      JOIN M_TRACKING_LOCATION L ON L.LOCATION_ID = T.LOCATION_ID
      JOIN M_TRACKING_PRODUCT P ON P.PRODUCT_ID = T.PRODUCT_ID
      WHERE T.IS_ACTIVE = 'Y'
        AND (${clauses.join(" OR ")})
      ORDER BY T.CREATED_AT DESC, T.REQUEST_ID DESC
      `,
      binds,
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
      extra: { count: rows.length, autoCompleted: syncResult.updatedCount },
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
          extraNote: normalizeText(row.EXTRA_NOTE),
          createdBy: normalizeText(row.CREATED_BY),
          notes: normalizeText(row.NOTES),
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
    return err("Gagal mencari tracking pengajuan");
  }
}

