import type { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_CETAK_DINAS ?? process.env.DB_ALIAS_PRR ?? "DB222";

function sanitizeDate(raw: unknown) {
  const s = String(raw ?? "").trim();
  return /^\d{2}-\d{2}-\d{4}$/.test(s) ? s : "";
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Sesi tidak valid.");

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const tgl = String(body.tanggal ?? body.tgl ?? "").trim();
    let tglStart = sanitizeDate(body.tgl_start ?? body.start ?? "");
    let tglEnd = sanitizeDate(body.tgl_end ?? body.end ?? "");

    // format "DD-MM-YYYY - DD-MM-YYYY"
    const rangeMatch = tgl.match(/(\d{2}-\d{2}-\d{4})\s*-\s*(\d{2}-\d{2}-\d{4})/);
    if (rangeMatch) {
      const left = sanitizeDate(rangeMatch[1]);
      const right = sanitizeDate(rangeMatch[2]);
      if (left) tglStart = left;
      if (right) tglEnd = right;
    }

    if (!tglStart || !tglEnd) return badRequest("Tanggal mulai dan akhir wajib (DD-MM-YYYY).");

    const sql = `
      SELECT
        NO,
        NVL(NAMA_LGKP, '-') AS NAMA_LGKP,
        NIK,
        NO_KEC,
        NAMA_KEC,
        TO_CHAR(TGL_CETAK,'DD-MM-YYYY') AS TGL_CETAK,
        REQ_BY,
        RECEIVE_BY,
        CREATED_BY
      FROM SIAK_CETAK_DINAS
      WHERE TGL_CETAK >= TO_DATE(:b_start,'DD-MM-YYYY')
        AND TGL_CETAK < TO_DATE(:b_end,'DD-MM-YYYY') + 1
      ORDER BY NO DESC
    `;

    const rows = await execRows(sql, { b_start: tglStart, b_end: tglEnd }, {}, ORACLE_ALIAS);
    const items = (rows ?? []).map((r: any) => ({
      no: r.NO,
      nama: (r.NAMA_LGKP ?? "").trim(),
      nik: (r.NIK ?? "").toString().trim(),
      noKec: (r.NO_KEC ?? "").toString().trim(),
      namaKec: (r.NAMA_KEC ?? "").trim(),
      tglCetak: (r.TGL_CETAK ?? "").trim(),
      reqBy: (r.REQ_BY ?? "").trim(),
      receiveBy: (r.RECEIVE_BY ?? "").trim(),
      createdBy: (r.CREATED_BY ?? "").trim(),
    }));

    await Log.info({
      scope: "API",
      msg: "cetak_dinas/rekap_cetak_dinas",
      at: "/api/cetak_dinas/rekap_cetak_dinas",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { start: tglStart, end: tglEnd, result: items.length },
    });

    return ok({ items, count: items.length }, items.length ? "Data ditemukan" : "Tidak ada data");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "cetak_dinas/rekap_cetak_dinas_err",
      at: "/api/cetak_dinas/rekap_cetak_dinas",
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal mengambil rekap cetak dinas.", 500);
  }
}
