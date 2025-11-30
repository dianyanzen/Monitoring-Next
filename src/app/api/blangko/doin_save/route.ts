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
    const jumlah = Number(body.blangko_masuk ?? 0);
    const tanggal = String(body.tanggal ?? "").trim(); // DD-MM-YYYY
    const keterangan = String(body.keterangan ?? "").trim();
    const userName = session.S_USER_ID || "SYSTEM";

    if (!tanggal || !/^\d{2}-\d{2}-\d{4}$/.test(tanggal)) return badRequest("Tanggal tidak valid (DD-MM-YYYY).");
    if (!Number.isFinite(jumlah) || jumlah <= 0) return badRequest("Jumlah blangko harus lebih dari 0.");

    // cek apakah sudah ada
    const countSql = `SELECT COUNT(1) AS CNT FROM SIAK_BLANGKO WHERE TO_CHAR(TANGGAL_MASUK,'DD-MM-YYYY') = :tgl`;
    const rows = await execRows(countSql, { tgl: tanggal }, {}, ORACLE_ALIAS);
    const exists = Number(rows?.[0]?.CNT ?? 0) > 0;

    let affected = 0;
    if (exists) {
      const updateSql = `
        UPDATE SIAK_BLANGKO
        SET JUMLAH = :jumlah,
            CREATED_BY = :user_name,
            KET = :keterangan
        WHERE TO_CHAR(TANGGAL_MASUK,'DD-MM-YYYY') = :tgl
      `;
      affected = await execDml(updateSql, { jumlah, user_name: userName, keterangan, tgl: tanggal }, {}, ORACLE_ALIAS);
    } else {
      const insertSql = `
        INSERT INTO SIAK_BLANGKO (JUMLAH, TANGGAL_MASUK, CREATED_BY, KET)
        VALUES (:jumlah, TO_DATE(:tgl,'DD-MM-YYYY'), :user_name, :keterangan)
      `;
      affected = await execDml(insertSql, { jumlah, tgl: tanggal, user_name: userName, keterangan }, {}, ORACLE_ALIAS);
    }

    await Log.info({
      scope: "API",
      msg: "blangko/doin_save",
      at: "/api/blangko/doin_save",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { exists, affected, tanggal, jumlah },
    });

    return ok({ affected, mode: exists ? "update" : "insert" }, exists ? "Data berhasil diperbarui" : "Data berhasil disimpan");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "blangko/doin_save_err",
      at: "/api/blangko/doin_save",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal menyimpan blangko", 500);
  }
}
