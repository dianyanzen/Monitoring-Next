import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { execDml, execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_BLANGKO ?? process.env.DB_ALIAS_PRR ?? "DB222";

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const noKec = Number(body.no_kec ?? 0) || 0;
    const tanggal = String(body.tanggal ?? "").trim(); // DD-MM-YYYY
    const pengambilan = Number(body.pengambilan ?? 0);
    const rusak = Number(body.rusak ?? 0);
    const pengembalian = Number(body.pengembalian ?? 0);
    if (!/^\d{2}-\d{2}-\d{4}$/.test(tanggal)) return badRequest("Tanggal tidak valid (DD-MM-YYYY).");
    if (pengambilan < 0 || rusak < 0 || pengembalian < 0) return badRequest("Nilai tidak boleh negatif.");
    if (pengambilan === 0) return badRequest("Pengambilan tidak boleh 0.");
    if (pengembalian + rusak > pengambilan) return badRequest("Pengembalian + rusak tidak boleh melebihi pengambilan.");

    const countSql = `
      SELECT COUNT(1) AS CNT
      FROM SIAK_MONEV_BLANGKO
      WHERE NO_KEC = :no_kec AND TO_CHAR(TANGGAL,'DD-MM-YYYY') = :tgl
    `;
    const existsRow = await execRows(countSql, { no_kec: noKec, tgl: tanggal }, {}, ORACLE_ALIAS);
    const exists = Number(existsRow?.[0]?.CNT ?? 0) > 0;

    let affected = 0;
    if (exists) {
      const updateSql = `
        UPDATE SIAK_MONEV_BLANGKO
        SET AMBIL = :pengambilan,
            RUSAK = :rusak,
            PENGEMBALIAN = :pengembalian,
            TANGGAL = TO_DATE(:tgl,'DD-MM-YYYY')
        WHERE NO_KEC = :no_kec
          AND TO_CHAR(TANGGAL,'DD-MM-YYYY') = :tgl
      `;
      affected = await execDml(
        updateSql,
        { pengambilan, rusak, pengembalian, no_kec: noKec, tgl: tanggal },
        {},
        ORACLE_ALIAS
      );
    } else {
      const insertSql = `
        INSERT INTO SIAK_MONEV_BLANGKO (NO_KEC, AMBIL, RUSAK, PENGEMBALIAN, TANGGAL, BLANGKO_ID)
        VALUES (:no_kec, :pengambilan, :rusak, :pengembalian, TO_DATE(:tgl,'DD-MM-YYYY'), BLANGKO_ID.NEXTVAL)
      `;
      affected = await execDml(
        insertSql,
        { no_kec: noKec, pengambilan, rusak, pengembalian, tgl: tanggal },
        {},
        ORACLE_ALIAS
      );
    }

    await Log.info({
      scope: "API",
      msg: "blangko/do_save",
      at: "/api/blangko/do_save",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { exists, affected, tanggal, pengambilan, rusak, pengembalian },
    });

    return ok({ affected, mode: exists ? "update" : "insert" }, exists ? "Data berhasil diperbarui" : "Data berhasil disimpan");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "blangko/do_save_err",
      at: "/api/blangko/do_save",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal menyimpan blangko", 500);
  }
}
