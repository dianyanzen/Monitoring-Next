// FILE: src/app/api/siak/repair_local_biometric/scan/route.ts
import type { NextRequest } from "next/server";
import { ok, err, badRequest, unauthorized, forbidden } from "@/lib/http";
import { execRows, execOne } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/siak/repair_local_biometric/scan";
const DB_REKAM = process.env.DB_ALIAS_REKAM ?? "DB5";
const DB_CETAK = process.env.DB_ALIAS_CETAK ?? "DB5CETAK";
type Scope = "rekam" | "cetak";

// util kecil: mask NIK di log (******1234)
const maskNik = (n: string) => (n && n.length >= 4 ? `******${n.slice(-4)}` : "******");

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const session = await readServerSession();
  if (!session?.S_USER_ID) return unauthorized("Unauthorized");

  // ✅ RBAC sederhana (silakan sesuaikan daftar level admin)
  const allowed = new Set<number | string>([1, 2, 3, 4, 5, "1", "2", "3", "4", "5"]);
  if (session.S_USER_LEVEL != null && !allowed.has(session.S_USER_LEVEL as any)) {
    return forbidden?.("Akses ditolak") ?? unauthorized("Unauthorized");
  }

  const { searchParams } = new URL(req.url);
  const nik = (searchParams.get("nik") || "").replace(/\D/g, "");
  const scope = ((searchParams.get("scope") || "rekam") as Scope);

  if (!/^\d{16}$/.test(nik)) return badRequest("NIK harus 16 digit angka.");
  if (scope !== "rekam" && scope !== "cetak") return badRequest("Scope tidak valid (rekam|cetak).");

  const alias = scope === "rekam" ? DB_REKAM : DB_CETAK;

  try {
    const person = await execOne(
      `SELECT 
         TO_CHAR(NIK) AS NIK, TO_CHAR(NO_KK) AS NO_KK, NAMA_LGKP, TMPT_LHR,
         TO_CHAR(TGL_LHR,'DD-MM-YYYY') AS TGL_LHR, JENIS_KLMIN, CURRENT_STATUS_CODE
       FROM DEMOGRAPHICS
       WHERE NIK = :b_nik`,
      { b_nik: nik } as Record<string, unknown>, {}, alias
    );

    let personSource: "DEMOGRAPHICS" | "DEMOGRAPHICS_ALL" | "NONE" = "NONE";
    let personList: any[] = [];
    if (person) {
      personSource = "DEMOGRAPHICS";
      personList = [person];
    } else if (scope === "cetak") {
      const p2 = await execOne(
        `SELECT 
           TO_CHAR(NIK) AS NIK, TO_CHAR(NO_KK) AS NO_KK, NAMA_LGKP, TMPT_LHR,
           TO_CHAR(TGL_LHR,'DD-MM-YYYY') AS TGL_LHR, JENIS_KLMIN, CURRENT_STATUS_CODE
         FROM DEMOGRAPHICS_ALL
         WHERE NIK = :b_nik`,
        { b_nik: nik } as Record<string, unknown>, {}, DB_CETAK
      );
      if (p2) { personSource = "DEMOGRAPHICS_ALL"; personList = [p2]; }
    }

    const cFaces = await execOne(`SELECT COUNT(1) AS JML FROM FACES WHERE NIK = :b_nik`, { b_nik: nik } as any, {}, alias);
    const cSigns = await execOne(`SELECT COUNT(1) AS JML FROM SIGNATURES WHERE NIK = :b_nik`, { b_nik: nik } as any, {}, alias);

    const faces = await execRows(`SELECT FACE FROM FACES WHERE NIK = :b_nik FETCH FIRST 1 ROWS ONLY`, { b_nik: nik } as any, {}, alias);
    const signatures = await execRows(`SELECT SIGNATURE FROM SIGNATURES WHERE NIK = :b_nik FETCH FIRST 1 ROWS ONLY`, { b_nik: nik } as any, {}, alias);

    const facesB64 = (faces ?? []).map((r: any) => ({ FACE: Buffer.isBuffer(r.FACE) ? (r.FACE as Buffer).toString("base64") : (r.FACE ? Buffer.from(r.FACE).toString("base64") : "") }));
    const signsB64 = (signatures ?? []).map((r: any) => ({ SIGNATURE: Buffer.isBuffer(r.SIGNATURE) ? (r.SIGNATURE as Buffer).toString("base64") : (r.SIGNATURE ? Buffer.from(r.SIGNATURE).toString("base64") : "") }));

    await Log.info({
      scope: "API",
      msg: "REPAIR_LOCAL_BIOMETRIC_SCAN",
      at: AT,
      user: session.S_USER_ID,
      tookMs: Date.now() - t0,
      // ⬇️ jangan log NIK full
      extra: { nik: maskNik(nik), scope, personSource, fCount: Number(cFaces?.JML ?? 0), sCount: Number(cSigns?.JML ?? 0) },
    });

    return ok({
      scope, nik,
      personSource,
      person: personList,
      biometric: {
        counts: { faces: Number(cFaces?.JML ?? 0), signatures: Number(cSigns?.JML ?? 0) },
        faces: facesB64, signatures: signsB64,
      },
    });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "REPAIR_LOCAL_BIOMETRIC_SCAN_FAILED",
      at: AT, user: session.S_USER_ID, tookMs: Date.now() - t0,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
      extra: { nik: maskNik(nik), scope, alias },
    });
    return err("Gagal memindai data.");
  }
}
