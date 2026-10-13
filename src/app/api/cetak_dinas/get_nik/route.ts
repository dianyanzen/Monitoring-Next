import type { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_CETAK_DINAS ?? process.env.DB_ALIAS_PRR ?? "DB222";

function sanitizeNik(raw: unknown) {
  return String(raw ?? "")
    .trim()
    .replace(/[^\d]/g, "");
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Sesi tidak valid.");

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const nik = sanitizeNik(body.nik);
    if (nik.length !== 16) return badRequest("NIK wajib 16 digit.");

    const countSql = "SELECT COUNT(1) AS JML FROM DEMOGRAPHICS_ALL@DB5CETAK WHERE NIK = :nik";
    const countRows = await execRows<{ JML?: number }>(countSql, { nik }, {}, ORACLE_ALIAS);
    const exists = Number(countRows?.[0]?.JML ?? 0) > 0;

    let data: any = { isExists: exists, nama: "", noKec: "0", namaKec: "LUAR DOMISILI" };
    if (exists) {
      const detailSql = `
        SELECT
          A.NAMA_LGKP,
          A.NO_KEC,
          F5_GET_NAMA_KECAMATAN(A.NO_PROP, A.NO_KAB, A.NO_KEC)NAMA_KEC
        FROM DEMOGRAPHICS_ALL@DB5CETAK A
        WHERE A.NIK = :nik
      `;
      const rows = await execRows<any>(detailSql, { nik }, {}, ORACLE_ALIAS);
      const r = rows?.[0];
      data = {
        isExists: true,
        nama: String(r?.NAMA_LGKP ?? "").trim(),
        noKec: String(r?.NO_KEC ?? "").trim() || "0",
        namaKec: String(r?.NAMA_KEC ?? "").trim(),
      };
    }

    await Log.info({
      scope: "API",
      msg: "cetak_dinas/get_nik",
      at: "/api/cetak_dinas/get_nik",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { nik, exists },
    });

    return ok(data, exists ? "Data ditemukan" : "Data tidak ditemukan di domisili.");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "cetak_dinas/get_nik_err",
      at: "/api/cetak_dinas/get_nik",
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal mengambil data NIK.", 500);
  }
}
