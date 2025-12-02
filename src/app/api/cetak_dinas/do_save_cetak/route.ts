import type { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { withTransaction } from "@/lib/db";
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

function toUpperSafe(raw: unknown) {
  return String(raw ?? "").trim().toUpperCase();
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Sesi tidak valid.");

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const nik = sanitizeNik(body.nik);
    const nama = String(body.nama ?? "").trim();
    const noKec = Number(body.no_kec ?? body.noKec ?? 0) || 0;
    const namaKec = String(body.nama_kec ?? body.namaKec ?? "").trim();
    const requestBy = toUpperSafe(body.request_by ?? body.requestBy);
    const receiveBy = toUpperSafe(body.receive ?? body.receive_by ?? body.receiveBy);
    const tanggal = String(body.tanggal ?? "").trim(); // DD-MM-YYYY

    if (nik.length !== 16) return badRequest("NIK wajib 16 digit.");
    if (!nama) return badRequest("Nama wajib diisi.");
    if (!requestBy) return badRequest("Request By wajib diisi.");
    if (!receiveBy) return badRequest("Receive By wajib diisi.");

    const useTanggal = /^\d{2}-\d{2}-\d{4}$/.test(tanggal);
    const createdBy = session.S_USER_ID;

    const insertSql = `
      INSERT INTO SIAK_CETAK_DINAS (
        NO, NIK, NAMA_LGKP, NO_KEC, NAMA_KEC, REQ_BY, TGL_CETAK, RECEIVE_BY, CREATED_BY
      )
      VALUES (
        CETAK_DINAS_NO.NEXTVAL,
        :nik,
        :nama,
        :no_kec,
        :nama_kec,
        :req_by,
        ${useTanggal ? "TO_DATE(:tanggal,'DD-MM-YYYY')" : "SYSDATE"},
        :receive_by,
        :created_by
      )
    `;

    const updateReqSql = `
      UPDATE SIAK_REQ_CETAK_KTP
      SET DIS_DT = SYSDATE, DIS_STAT = 'Y', DIS_BY = :req_by
      WHERE NIK = :nik
    `;

    const updateReqLdSql = `
      UPDATE SIAK_REQ_CETAK_KTPLD
      SET DIS_DT = SYSDATE, DIS_STAT = 'Y', DIS_BY = :req_by
      WHERE NIK = :nik
    `;

    let inserted = 0;
    let updated = 0;

    await withTransaction(
      async (conn) => {
        const ins = await conn.execute(insertSql, { nik, nama, no_kec: noKec, nama_kec: namaKec || null, req_by: requestBy, receive_by: receiveBy, tanggal, created_by: createdBy }, { autoCommit: false });
        inserted = ins.rowsAffected ?? 0;

        const up1 = await conn.execute(updateReqSql, { nik, req_by: requestBy }, { autoCommit: false });
        const up2 = await conn.execute(updateReqLdSql, { nik, req_by: requestBy }, { autoCommit: false });
        updated = (up1.rowsAffected ?? 0) + (up2.rowsAffected ?? 0);
      },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "cetak_dinas/do_save_cetak",
      at: "/api/cetak_dinas/do_save_cetak",
      user: createdBy,
      tookMs: Date.now() - started,
      extra: { nik, inserted, updated, noKec, useTanggal },
    });

    return ok({ inserted, updated }, "Data berhasil disimpan.");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "cetak_dinas/do_save_cetak_err",
      at: "/api/cetak_dinas/do_save_cetak",
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal menyimpan data cetak dinas.", 500);
  }
}
