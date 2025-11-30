import type { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";
import {
  deletePengajuanLd,
  insertPengajuanLd,
  sanitizeNik,
  sanitizeNoKec,
  updatePengajuanLd,
} from "../utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "create" | "update" | "delete";
type Body = {
  nik?: string;
  nama?: string;
  noKec?: string;
  no_kec?: string;
  action?: Action;
  state?: number;
};

function resolveAction(body: Body): Action {
  if (body.action === "update" || body.state === 2) return "update";
  if (body.action === "delete" || body.state === 3) return "delete";
  return "create";
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Sesi tidak valid");

    const body = (await req.json().catch(() => ({}))) as Body;
    const nik = sanitizeNik(body.nik);
    if (nik.length !== 16) return badRequest("NIK wajib 16 digit");

    const action = resolveAction(body);
    const nama = (body.nama || "").toString().trim().toUpperCase();
    const noKec = sanitizeNoKec(body.noKec ?? body.no_kec);
    const userId = session.S_USER_ID;

    if (action === "create") {
      if (!nama) return badRequest("Nama wajib diisi untuk pengajuan baru");
      const targetKec = noKec || sanitizeNoKec(session.S_NO_KEC as any);
      if (!targetKec) return badRequest("Nomor kecamatan wajib diisi");
      const inserted = await insertPengajuanLd(nik, nama, targetKec, userId);
      const message = inserted > 0 ? "Data berhasil diajukan" : "Data sudah pernah diajukan";
      await Log.info({
        scope: "API",
        msg: "req_ktp_ld/ajukan",
        at: "/api/req/ektp/pindahan/ajukan",
        user: userId,
        ip,
        ua,
        tookMs: Date.now() - started,
        extra: { action, affected: inserted },
      });
      return ok({ affected: inserted }, message);
    }

    if (action === "update") {
      const updated = await updatePengajuanLd(nik, userId, nama || undefined, noKec || undefined);
      const message = updated > 0 ? "Pengajuan berhasil diperbarui" : "Tidak ada data yang diperbarui";
      await Log.info({
        scope: "API",
        msg: "req_ktp_ld/ajukan",
        at: "/api/req/ektp/pindahan/ajukan",
        user: userId,
        ip,
        ua,
        tookMs: Date.now() - started,
        extra: { action, affected: updated },
      });
      return ok({ affected: updated }, message);
    }

    // delete
    const deleted = await deletePengajuanLd(nik);
    const message = deleted > 0 ? "Pengajuan berhasil dihapus" : "Tidak ada data yang dihapus";
    await Log.info({
      scope: "API",
      msg: "req_ktp_ld/ajukan",
      at: "/api/req/ektp/pindahan/ajukan",
      user: userId,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { action, affected: deleted },
    });
    return ok({ affected: deleted }, message);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "req_ktp_ld/ajukan_err",
      at: "/api/req/ektp/pindahan/ajukan",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memproses pengajuan KTP pindahan");
  }
}
