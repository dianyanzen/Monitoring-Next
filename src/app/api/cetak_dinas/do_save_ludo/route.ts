import type { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execDml, execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_CETAK_DINAS ?? process.env.DB_ALIAS_PRR ?? "DB222";

function parseJumlah(raw: unknown) {
  const num = Number(String(raw ?? "").trim().replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : NaN;
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Sesi tidak valid.");

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const jml = parseJumlah(body.jml ?? body.jumlah ?? body.qty);
    if (!Number.isFinite(jml) || jml < 0) return badRequest("Jumlah tidak valid.");

    const countSql = `
      SELECT COUNT(1) AS CNT
      FROM SIAK_MONEV_BLANGKO_LUDO
      WHERE TRUNC(TANGGAL) = TRUNC(SYSDATE)
    `;
    const cntRows = await execRows<{ CNT?: number }>(countSql, {}, {}, ORACLE_ALIAS);
    const exists = Number(cntRows?.[0]?.CNT ?? 0) > 0;

    let affected = 0;
    if (exists) {
      const updateSql = `
        UPDATE SIAK_MONEV_BLANGKO_LUDO
        SET AMBIL = :jml
        WHERE TRUNC(TANGGAL) = TRUNC(SYSDATE)
      `;
      affected = await execDml(updateSql, { jml }, {}, ORACLE_ALIAS);
    } else {
      const insertSql = `
        INSERT INTO SIAK_MONEV_BLANGKO_LUDO (AMBIL, RUSAK, PENGEMBALIAN, TANGGAL)
        VALUES (:jml, 0, 0, SYSDATE)
      `;
      affected = await execDml(insertSql, { jml }, {}, ORACLE_ALIAS);
    }

    await Log.info({
      scope: "API",
      msg: "cetak_dinas/do_save_ludo",
      at: "/api/cetak_dinas/do_save_ludo",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { exists, affected, jml },
    });

    return ok({ affected, mode: exists ? "update" : "insert" }, "Data Berhasil Di Simpan");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "cetak_dinas/do_save_ludo_err",
      at: "/api/cetak_dinas/do_save_ludo",
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal menyimpan ludo.", 500);
  }
}
