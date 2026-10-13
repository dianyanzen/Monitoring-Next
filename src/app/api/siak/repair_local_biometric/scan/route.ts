// FILE: src/app/api/siak/repair_local_biometric/scan/route.ts
import type { NextRequest } from "next/server";
import { ok, err, badRequest, unauthorized, forbidden } from "@/lib/http";
import { execRows, execOne } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import { spawn } from "child_process";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/siak/repair_local_biometric/scan";
const DB_REKAM = process.env.DB_ALIAS_REKAM ?? "DB5";
const DB_CETAK = process.env.DB_ALIAS_CETAK ?? "DB5CETAK";
const MAGICK_BIN = process.env.MAGICK_BIN ?? "magick";

// === Python WSQ converter (untuk sidik jari) ===
const PYTHON_BIN = process.env.PYTHON_BIN ?? "python";
const PY_SCRIPT = process.env.WSQ_PY ?? path.join(process.cwd(), "scripts", "wsq_to_png.py");

type Scope = "rekam" | "cetak";

// util kecil: mask NIK di log (******1234)
const maskNik = (n: string) => (n && n.length >= 4 ? `******${n.slice(-4)}` : "******");

/* ===== IRIS helpers ===== */
const JP2_CODES = new Set(["JPG2", "JP2", "JPEG2K", "JPEG2000", "JPX"]);
const isJp2 = (code: string | null | undefined) => JP2_CODES.has((code || "").trim().toUpperCase());

const toMime = (code: string | null | undefined) => {
  const c = (code || "").toLowerCase();
  if (!c) return "image/jpeg";
  if (c.includes("png")) return "image/png";
  if (c.includes("bmp")) return "image/bmp";
  if (c.includes("tif")) return "image/tiff";
  if (c.includes("jp2") || c.includes("jpg2")) return "image/jp2";
  return "image/jpeg";
};

function convertJp2ToPng(buf: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    // ImageMagick is installed on the host, outside the application bundle.
    const proc = spawn(/* turbopackIgnore: true */ MAGICK_BIN, ["jp2:-", "png:-"]);
    const out: Buffer[] = [];
    const errs: Buffer[] = [];

    proc.stdout.on("data", (chunk) => out.push(chunk as Buffer));
    proc.stderr.on("data", (chunk) => errs.push(chunk as Buffer));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(errs.length ? Buffer.concat(errs).toString() : `magick exit ${code}`));
    });

    proc.stdin.end(buf);
  });
}

type IrisSerialized = {
  data: string | null;
  mime: string | null;
  converted?: boolean;
  error?: string;
};

async function serializeIris(buf: Buffer | null, code: string | null): Promise<IrisSerialized> {
  if (!buf) return { data: null, mime: null };
  if (isJp2(code)) {
    try {
      const png = await convertJp2ToPng(Buffer.from(buf));
      return { data: png.toString("base64"), mime: "image/png", converted: true };
    } catch (e) {
      return { data: null, mime: "image/jp2", error: `Konversi JPG2 ke PNG gagal: ${(e as Error).message}` };
    }
  }
  return { data: Buffer.from(buf).toString("base64"), mime: toMime(code) };
}

/* ===== FINGERS helpers (WSQ → PNG via Python) ===== */
type FingerRow = {
  RIGHT_THUMB: Buffer | null; RIGHT_INDEX: Buffer | null; RIGHT_MIDDLE: Buffer | null; RIGHT_RING: Buffer | null; RIGHT_LITTLE: Buffer | null;
  LEFT_THUMB:  Buffer | null; LEFT_INDEX:  Buffer | null; LEFT_MIDDLE:  Buffer | null; LEFT_RING:  Buffer | null; LEFT_LITTLE:  Buffer | null;
  IMAGE_TYPE_CODE: string | null;
};
type FingerOut = { name: string; png: string | null; error?: string };

const ORDER: Array<keyof FingerRow> = [
  "RIGHT_THUMB","RIGHT_INDEX","RIGHT_MIDDLE","RIGHT_RING","RIGHT_LITTLE",
  "LEFT_THUMB","LEFT_INDEX","LEFT_MIDDLE","LEFT_RING","LEFT_LITTLE",
];

function runPythonWSQtoPNG(buf: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Python is host-provided; the bundled default script is traced explicitly.
    const p = spawn(/* turbopackIgnore: true */ PYTHON_BIN, [PY_SCRIPT], { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const errs: Buffer[] = [];
    p.stdout.on("data", (c) => out.push(c as Buffer));
    p.stderr.on("data", (c) => errs.push(c as Buffer));
    p.on("error", (e) => reject(e));
    p.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(Buffer.concat(errs).toString() || `python exit ${code}`));
    });
    p.stdin.end(buf);
  });
}

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const session = await readServerSession();
  if (!session?.S_USER_ID) return unauthorized("Unauthorized");

  // ✅ RBAC sederhana
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
    // --- person utama ---
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

    // --- ringkas biometric (faces/signatures) ---
    const cFaces = await execOne(`SELECT COUNT(1) AS JML FROM FACES WHERE NIK = :b_nik`, { b_nik: nik } as any, {}, alias);
    const cSigns = await execOne(`SELECT COUNT(1) AS JML FROM SIGNATURES WHERE NIK = :b_nik`, { b_nik: nik } as any, {}, alias);

    const faces = await execRows(
      `SELECT FACE FROM FACES WHERE NIK = :b_nik FETCH FIRST 1 ROWS ONLY`,
      { b_nik: nik } as any, {}, alias
    );
    const signatures = await execRows(
      `SELECT SIGNATURE FROM SIGNATURES WHERE NIK = :b_nik FETCH FIRST 1 ROWS ONLY`,
      { b_nik: nik } as any, {}, alias
    );

    const facesB64 = (faces ?? []).map((r: any) => ({
      FACE: Buffer.isBuffer(r.FACE) ? (r.FACE as Buffer).toString("base64") : (r.FACE ? Buffer.from(r.FACE).toString("base64") : "")
    }));
    const signsB64 = (signatures ?? []).map((r: any) => ({
      SIGNATURE: Buffer.isBuffer(r.SIGNATURE) ? (r.SIGNATURE as Buffer).toString("base64") : (r.SIGNATURE ? Buffer.from(r.SIGNATURE).toString("base64") : "")
    }));

    // --- IRIS (selalu dari DB_CETAK sebagai sumber cetak) ---
    const irisRow = await execOne<{
      IMAGE_TYPE_CODE: string | null;
      LEFT_IRIS: Buffer | null;
      RIGHT_IRIS: Buffer | null;
    }>(
      `SELECT IMAGE_TYPE_CODE, LEFT_IRIS, RIGHT_IRIS
         FROM IRIS
        WHERE NIK = :b_nik
          AND ROWNUM = 1`,
      { b_nik: nik } as Record<string, unknown>, {}, alias
    );

    let irisMime: string | null = null;
    let irisLeft: string | null = null;
    let irisRight: string | null = null;
    let irisConverted = false;
    const irisErrors: string[] = [];
    let irisSourceCode: string | null = null;

    if (irisRow) {
      const [leftInfo, rightInfo] = await Promise.all([
        serializeIris(irisRow.LEFT_IRIS, irisRow.IMAGE_TYPE_CODE),
        serializeIris(irisRow.RIGHT_IRIS, irisRow.IMAGE_TYPE_CODE),
      ]);
      irisMime = leftInfo.mime || rightInfo.mime || toMime(irisRow.IMAGE_TYPE_CODE);
      irisLeft = leftInfo.data;
      irisRight = rightInfo.data;
      irisConverted = Boolean(leftInfo.converted || rightInfo.converted);
      irisSourceCode = irisRow.IMAGE_TYPE_CODE ?? null;
      if (leftInfo.error) irisErrors.push(leftInfo.error);
      if (rightInfo.error) irisErrors.push(rightInfo.error);
    }

    // --- FINGERS (WSQ → PNG) dari DB_CETAK (sumber cetak) ---
    const fRow = await execOne<FingerRow>(
      `SELECT RIGHT_THUMB,RIGHT_INDEX,RIGHT_MIDDLE,RIGHT_RING,RIGHT_LITTLE,
              LEFT_THUMB,LEFT_INDEX,LEFT_MIDDLE,LEFT_RING,LEFT_LITTLE, IMAGE_TYPE_CODE
         FROM FINGERS
        WHERE NIK = :b_nik AND ROWNUM = 1`,
      { b_nik: nik } as any, {}, alias
    );

    let fingersMime: string | null = null;
    let fingers: FingerOut[] = [];
    if (fRow) {
      fingersMime = "image/png"; // hasil konversi
      for (const key of ORDER) {
        const blob = fRow[key];
        const name = key.toLowerCase();
        if (!blob) { fingers.push({ name, png: null }); continue; }
        try {
          const png = await runPythonWSQtoPNG(Buffer.from(blob));
          fingers.push({ name, png: png.toString("base64") });
        } catch (e: any) {
          fingers.push({ name, png: null, error: e?.message || "convert error" });
        }
      }
    }

    await Log.info({
      scope: "API",
      msg: "REPAIR_LOCAL_BIOMETRIC_SCAN",
      at: AT,
      user: session.S_USER_ID,
      tookMs: Date.now() - t0,
      extra: {
        nik: maskNik(nik),
        scope,
        personSource,
        fCount: Number(cFaces?.JML ?? 0),
        sCount: Number(cSigns?.JML ?? 0),
        irisConverted: irisConverted ? true : false,
        fingersFound: Boolean(fRow),
      },
    });

    return ok({
      scope, nik,
      personSource,
      person: personList,
      biometric: {
        counts: { faces: Number(cFaces?.JML ?? 0), signatures: Number(cSigns?.JML ?? 0) },
        faces: facesB64, signatures: signsB64,
      },
      iris: {
        mime: irisMime,
        left: irisLeft,
        right: irisRight,
        meta: {
          converted: irisConverted,
          sourceCode: irisSourceCode,
          errors: irisErrors.length ? irisErrors : null,
        }
      },
      fingers: fRow ? { mime: fingersMime, items: fingers } : null,
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
