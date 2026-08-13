import type { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execOne } from "@/lib/db";
import { getClientInfo, readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_CETAK ?? process.env.DB_ALIAS_PRR ?? "DB5CETAK";
const FALLBACK_ALIAS = process.env.DB_ALIAS_RESTORE ?? process.env.DB_ALIAS_TRACKING ?? "DB";

type RawLookupRow = Partial<Record<"NIK" | "NAMA_LGKP" | "NO_PROP" | "NO_KAB" | "NO_KEC" | "NO_KEL" | "ALAMAT" | "NO_RW" | "NO_RT", string>>;

type LookupResult = {
  nik: string;
  name: string;
  noProp: string;
  noKab: string;
  noKec: string;
  noKel: string;
  alamat: string;
  rw: string;
  rt: string;
};

function sanitizeNik(raw: unknown) {
  return String(raw ?? "").replace(/\D/g, "").trim();
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();

  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const body = (await req.json().catch(() => ({} as any))) as Record<string, unknown>;
    const nik = sanitizeNik(body.nik);
    if (nik.length !== 16) return badRequest("NIK wajib 16 digit.");

    const propKab = `${String(session.S_NO_PROP ?? "").trim()}${String(session.S_NO_KAB ?? "").trim()}`;
    const propKabFilter = propKab ? "AND A.NO_PROP||A.NO_KAB = :b_prop_kab" : "";
    const binds: Record<string, unknown> = { b_nik: nik };
    if (propKab) binds.b_prop_kab = propKab;

    const sqlDemographics = `
      SELECT NIK, NAMA_LGKP, NO_PROP, NO_KAB, NO_KEC, NO_KEL, ALAMAT, NO_RW, NO_RT
      FROM DEMOGRAPHICS_ALL A
      WHERE A.NIK = :b_nik
      ${propKabFilter}
      FETCH FIRST 1 ROWS ONLY
    `;

    const demographics = await execOne<RawLookupRow>(sqlDemographics, binds, {}, ORACLE_ALIAS);
    let source = "DEMOGRAPHICS_ALL";
    let record = demographics;
    let found = Boolean(record?.NIK);

    if (!found) {
      const sqlBiodata = `
        SELECT NIK, NAMA_LGKP, NO_PROP, NO_KAB, NO_KEC, NO_KEL, ALAMAT, NO_RW, NO_RT
        FROM YZ_BIODATA_WNI_MASTER A
        WHERE A.NIK = :b_nik
        ${propKabFilter}
        FETCH FIRST 1 ROWS ONLY
      `;
      record = await execOne<RawLookupRow>(sqlBiodata, binds, {}, FALLBACK_ALIAS);
      source = "YZ_BIODATA_WNI_MASTER";
      found = Boolean(record?.NIK);
    }

    const data = found
      ? {
          found: true,
          source,
          nik: String(record?.NIK ?? "").trim(),
          name: String(record?.NAMA_LGKP ?? "").trim(),
          noProp: String(record?.NO_PROP ?? "").trim(),
          noKab: String(record?.NO_KAB ?? "").trim(),
          noKec: String(record?.NO_KEC ?? "").trim() || "0",
          noKel: String(record?.NO_KEL ?? "").trim() || "0",
          alamat: String(record?.ALAMAT ?? "").trim(),
          rw: String(record?.NO_RW ?? "").trim(),
          rt: String(record?.NO_RT ?? "").trim(),
        }
      : { found: false };

    await Log.info({
      scope: "API",
      msg: "tracking-pengajuan/lookup-nik",
      at: "/api/tracking-pengajuan/lookup-nik",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { nik, found, source },
    });

    return ok(data, found ? "Data NIK ditemukan" : "Data NIK tidak ditemukan");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "tracking-pengajuan/lookup-nik_err",
      at: "/api/tracking-pengajuan/lookup-nik",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal mencari data NIK", 500);
  }
}
