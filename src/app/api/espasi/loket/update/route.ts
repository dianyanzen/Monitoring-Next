import type { NextRequest } from "next/server";
import { ok, err, badRequest } from "@/lib/http";
import { execDml } from "@/lib/db";
import { Log } from "@/lib/log";
import { ESPASI_DB_ALIAS, ensureSession } from "@/lib/espasi/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  lokasi?: string;
  urutan?: string;
  nik?: string;
  status?: string;
};

const ALLOWED_STATUS = new Set(["SUDAH", "LEWAT"]);

export async function POST(req: NextRequest) {
  const started = Date.now();
  const auth = await ensureSession();
  if (auth.error) return auth.error;

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest("Body JSON tidak valid");
  }

  const lokasi = String(body?.lokasi || "").trim().toUpperCase();
  const urutan = String(body?.urutan || "").trim().toUpperCase();
  const status = String(body?.status || "").trim().toUpperCase();
  const nik = String(body?.nik || "").trim();

  if (!lokasi) return badRequest("lokasi wajib diisi");
  if (!urutan) return badRequest("urutan wajib diisi");
  if (!ALLOWED_STATUS.has(status)) {
    return badRequest("status tidak valid. Gunakan SUDAH atau LEWAT");
  }

  try {
    const rowsAffected = await execDml(
      `
      UPDATE SMSDISDUK.ANTRIAN@SMSDISDUK
         SET STATUS_PELAYANAN = :b_status
       WHERE UPPER(LOKASI) = :b_lokasi
         AND UPPER(URUTAN) = :b_urutan
         AND UPPER(STATUS_PELAYANAN) = 'BELUM'
         AND (:b_nik IS NULL OR NIK = :b_nik)
      `,
      {
        b_status: status,
        b_lokasi: lokasi,
        b_urutan: urutan,
        b_nik: nik || null,
      },
      {},
      ESPASI_DB_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "espasi/loket/update",
      at: "/api/espasi/loket/update",
      user: auth.session?.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { lokasi, urutan, status, rowsAffected },
    });

    if (!rowsAffected) {
      return ok({ updated: 0, message: "Data tidak ditemukan atau sudah diproses" });
    }

    return ok({ updated: rowsAffected, status, lokasi, urutan });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "espasi/loket/update/error",
      at: "/api/espasi/loket/update",
      user: auth.session?.S_USER_ID,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memperbarui status antrian loket", 500);
  }
}
