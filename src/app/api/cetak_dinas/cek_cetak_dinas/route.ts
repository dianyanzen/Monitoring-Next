import type { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import { buildInClause, sanitizeNikList } from "@/app/api/req/ektp/perubahan/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_CETAK_DINAS ?? process.env.DB_ALIAS_PRR ?? "DB222";

function sanitizeNama(raw: unknown) {
  const t = String(raw ?? "").trim().toUpperCase();
  if (!t) return "";
  return t.replace(/[%_]/g, "").trim();
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Sesi tidak valid.");

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const nikList = sanitizeNikList(body.nik ?? body.niks ?? body.nikList);
    const namaTerm = sanitizeNama(body.nama);

    const binds: Record<string, any> = {};
    const where: string[] = [];

    if (nikList.length) {
      const { clause, binds: nikBinds } = buildInClause(nikList, "nik");
      where.push(`NIK IN (${clause})`);
      Object.assign(binds, nikBinds);
    }

    if (namaTerm) {
      where.push("UPPER(NAMA_LGKP) LIKE :nama");
      binds.nama = `%${namaTerm}%`;
    }

    const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";

    const sql = `
      SELECT
        NO,
        NVL(NAMA_LGKP, '-') AS NAMA_LGKP,
        NIK,
        NO_KEC,
        NAMA_KEC,
        TO_CHAR(TGL_CETAK,'DD-MM-YYYY') AS TGL_CETAK,
        REQ_BY,
        RECEIVE_BY
      FROM SIAK_CETAK_DINAS
      ${whereClause}
      ORDER BY NO DESC
    `;

    const rows = await execRows(sql, binds, {}, ORACLE_ALIAS);
    const items = (rows ?? []).map((r: any) => ({
      no: r.NO,
      nama: (r.NAMA_LGKP ?? "").trim(),
      nik: (r.NIK ?? "").toString().trim(),
      noKec: (r.NO_KEC ?? "").toString().trim(),
      namaKec: (r.NAMA_KEC ?? "").trim(),
      tglCetak: (r.TGL_CETAK ?? "").trim(),
      reqBy: (r.REQ_BY ?? "").trim(),
      receiveBy: (r.RECEIVE_BY ?? "").trim(),
    }));

    await Log.info({
      scope: "API",
      msg: "cetak_dinas/cek_cetak_dinas",
      at: "/api/cetak_dinas/cek_cetak_dinas",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { nikCount: nikList.length, nama: !!namaTerm, result: items.length },
    });

    return ok({ items, count: items.length }, items.length ? "Data ditemukan" : "Tidak ada data");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "cetak_dinas/cek_cetak_dinas_err",
      at: "/api/cetak_dinas/cek_cetak_dinas",
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal mengambil data cetak dinas.", 500);
  }
}
