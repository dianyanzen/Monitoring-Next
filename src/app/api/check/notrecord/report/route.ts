// FILE: src/app/api/check/notrecord/report/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { ok, err, badRequest } from "@/lib/http";
import { execDml } from "@/lib/db";
import { readServerSession } from "@/lib/session";

const ORACLE_ALIAS = process.env.DB_ALIAS_NOTRECORD ?? "DB";

export async function POST(req: NextRequest) {
  try {
    const s = await readServerSession();
    if (!s?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const body = await req.json().catch(() => ({}));
    const nik = String(body?.nik ?? "").trim();
    const nama = String(body?.nama ?? "").trim();
    const alasan = Number(body?.alasan ?? 0);
    const alasan_keterangan = String(body?.alasan_keterangan ?? "").trim();
    const user_id = String(s.S_USER_ID);

    if (!nik || nik.length !== 16) return badRequest("NIK 16 digit wajib.");
    if (!alasan || !alasan_keterangan || alasan_keterangan.length < 10) {
      return badRequest("Alasan & keterangan (>=10 char) wajib.");
    }

    const SQL = `
      INSERT INTO YZ_NOTRECORD_EXCUSE
        (ID, NIK, NAMA, ALASAN, KETERANGAN, USER_ID, CREATED_AT)
      VALUES
        (YZ_NOTREC_EXCUSE_SEQ.NEXTVAL, :b_nik, :b_nama, :b_alasan, :b_ket, :b_user, SYSTIMESTAMP)
    `;
    await execDml(
      SQL,
      {
        b_nik: nik,
        b_nama: nama,
        b_alasan: alasan,
        b_ket: alasan_keterangan,
        b_user: user_id,
      },
      { autoCommit: true },
      ORACLE_ALIAS,
    );

    return ok({ message_type: 1, message: "Data balikan tersimpan." });
  } catch (e: any) {
    return err("Gagal menyimpan data balikan", 500);
  }
}
