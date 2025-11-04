// FILE: src/app/api/siak/repair_local_biometric/delete/route.ts
import type { NextRequest } from "next/server";
import { ok, err, badRequest, unauthorized, forbidden } from "@/lib/http";
import { execDml /* , withTransaction */ } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/siak/repair_local_biometric/delete";
const DB_REKAM = process.env.DB_ALIAS_REKAM ?? "DB5";
const DB_CETAK = process.env.DB_ALIAS_CETAK ?? "DB5CETAK";
const DB_AUDIT = process.env.DB_ALIAS_AUDIT ?? "DB";

type Scope = "rekam" | "cetak";
const TABLES_BIOMETRIC = [
  "FACES","FINGERS","IRIS","SIGNATURES",
  "FACE_TEMPLATES","FINGER_TEMPLATES","IRIS_TEMPLATES","SIGNATURE_TEMPLATES",
  "BIOMETRICS_LOSSLESS","BIOMETRIC_EXCEPTIONS","BIOMETRIC_DIAGNOSTICS",
  "AUDITS","DUPLICATE_RESULTS","CARD_ISSUANCE_EVIDENCE",
  "MIDDLEWARE_DIAGNOSTICS","REPROCESS_FAILED_NIKS","MANUAL_DEDUP_DIAGNOSTICS",
] as const;

// helper: deteksi ORA-00942 (table/view does not exist)
function isOra942(e: unknown) {
  const msg = (e as any)?.message as string | undefined;
  return !!msg && msg.includes("ORA-00942");
}

async function purgeOnAlias(
  nik: string,
  alias: string,
  opts?: { includeDemographicsAll?: boolean }
) {
  const out: { table: string; rows: number }[] = [];
  const binds = { b_nik: nik } as Record<string, unknown>;

  // (opsional) withTransaction(alias, async () => { ... })

  // hapus semua tabel biometrik yang ada
  for (const t of TABLES_BIOMETRIC) {
    try {
      const rows = await execDml(`DELETE FROM ${t} WHERE NIK = :b_nik`, binds, {}, alias);
      out.push({ table: t, rows: Number(rows ?? 0) });
    } catch (e) {
      if (isOra942(e)) {
        // tabel memang tidak ada pada alias ini → lanjut
        out.push({ table: t, rows: 0 });
      } else {
        throw e;
      }
    }
  }

  // DEMOGRAPHICS (umumnya ada di keduanya)
  try {
    const dem = await execDml(`DELETE FROM DEMOGRAPHICS WHERE NIK = :b_nik`, binds, {}, alias);
    out.push({ table: "DEMOGRAPHICS", rows: Number(dem ?? 0) });
  } catch (e) {
    if (isOra942(e)) out.push({ table: "DEMOGRAPHICS", rows: 0 });
    else throw e;
  }

  // DEMOGRAPHICS_ALL (hanya di DB5CETAK)
  if (opts?.includeDemographicsAll) {
    try {
      const demAll = await execDml(`DELETE FROM DEMOGRAPHICS_ALL WHERE NIK = :b_nik`, binds, {}, alias);
      out.push({ table: "DEMOGRAPHICS_ALL", rows: Number(demAll ?? 0) });
    } catch (e) {
      if (isOra942(e)) out.push({ table: "DEMOGRAPHICS_ALL", rows: 0 });
      else throw e;
    }
  }

  return out;
}

// kecil: catat audit seperti legacy do_hist_delete
async function insertAudit(nik: string, userId: string, ip: string, option: string) {
  const id = `${nik}-DELBIO-${Date.now()}`;
  await execDml(
    `INSERT INTO SIAK_HIST_DEL_BIOMETRIC (ID, NIK, DELETE_DT, DELETE_BY, IP_ADDRESS, OPTION_DELETE)
     VALUES (:b_id, :b_nik, SYSDATE, :b_user, :b_ip, :b_opt)`,
    { b_id: id, b_nik: nik, b_user: userId, b_ip: ip, b_opt: option } as Record<string, unknown>,
    {},
    DB_AUDIT
  );
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const session = await readServerSession();
  if (!session?.S_USER_ID) return unauthorized("Unauthorized");

  // ✅ RBAC sederhana
  const allowed = new Set<number | string>([1,2,3,4,5,"1","2","3","4","5"]);
  if (session.S_USER_LEVEL != null && !allowed.has(session.S_USER_LEVEL as any)) {
    return forbidden?.("Akses ditolak") ?? unauthorized("Unauthorized");
  }

  let body: { nik?: string; scope?: Scope };
  try { body = await req.json(); } catch { return badRequest("Payload tidak valid."); }

  const nik = (body?.nik || "").replace(/\D/g, "");
  const scope = (body?.scope || "rekam") as Scope;

  if (!/^\d{16}$/.test(nik)) return badRequest("NIK harus 16 digit angka.");
  if (scope !== "rekam" && scope !== "cetak") return badRequest("Scope tidak valid (rekam|cetak).");

  try {
    if (scope === "rekam") {
      // DB perekaman: TANPA DEMOGRAPHICS_ALL (memang tidak ada)
      const rRekam = await purgeOnAlias(nik, DB_REKAM, { includeDemographicsAll: false });

      // DB pencetakan: TERMASUK DEMOGRAPHICS_ALL
      const rCetak = await purgeOnAlias(nik, DB_CETAK, { includeDemographicsAll: true });

      await insertAudit(nik, String(session.S_USER_ID), (req.headers.get("x-forwarded-for") ?? "") as string, "BIOMETRIC REKAM");

      await Log.info({
        scope: "API",
        msg: "REPAIR_LOCAL_BIOMETRIC_DELETE_REKAM",
        at: AT,
        user: session.S_USER_ID,
        tookMs: Date.now() - t0,
        // ⬇️ NIK tidak disensor sesuai permintaan
        extra: { nik, DB_REKAM_rows: rRekam, DB_CETAK_rows: rCetak },
      });

      return ok({
        nik,
        scope,
        message:
          "Berhasil hapus data di DATABASE PEREKAMAN KTP-EL (DB5) dan DATABASE PENCETAKAN KTP-EL (DB5CETAK). DEMOGRAPHICS_ALL hanya dihapus pada DB5CETAK.",
        deleted: { [DB_REKAM]: rRekam, [DB_CETAK]: rCetak },
      });
    } else {
      const rCetak = await purgeOnAlias(nik, DB_CETAK, { includeDemographicsAll: false });
      await insertAudit(nik, String(session.S_USER_ID), (req.headers.get("x-forwarded-for") ?? "") as string, "BIOMETRIC CETAK");

      await Log.info({
        scope: "API",
        msg: "REPAIR_LOCAL_BIOMETRIC_DELETE_CETAK",
        at: AT,
        user: session.S_USER_ID,
        tookMs: Date.now() - t0,
        extra: { nik, DB_CETAK_rows: rCetak },
      });

      return ok({
        nik,
        scope,
        message: "Berhasil hapus data di DATABASE PENCETAKAN KTP-EL (DB5CETAK). DEMOGRAPHICS_ALL tidak dihapus.",
        deleted: { [DB_CETAK]: rCetak },
      });
    }
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "REPAIR_LOCAL_BIOMETRIC_DELETE_FAILED",
      at: AT,
      user: session.S_USER_ID,
      tookMs: Date.now() - t0,
      // ⬇️ NIK tidak disensor
      extra: { nik, scope },
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal menghapus data.");
  }
}
