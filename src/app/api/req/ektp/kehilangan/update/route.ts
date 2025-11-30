import type { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { getClientInfo, readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import { updateNoKehilangan } from "../utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Sesi tidak valid");

    const body = (await req.json().catch(() => ({}))) as { nik?: string; noKehilangan?: string; no_kehilangan?: string };
    const nik = (body.nik ?? "").replace(/[^\d]/g, "").slice(0, 16);
    const noKehilangan = (body.noKehilangan ?? body.no_kehilangan ?? "").toString().trim().toUpperCase();

    if (nik.length !== 16) return badRequest("NIK wajib 16 digit");
    if (!noKehilangan) return badRequest("No kehilangan wajib diisi");
    if (noKehilangan.length < 6) return badRequest("No kehilangan terlalu pendek");

    const affected = await updateNoKehilangan(nik, noKehilangan);

    await Log.info({
      scope: "API",
      msg: "req_ktp_hilang/update",
      at: "/api/req/ektp/kehilangan/update",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { nik, affected },
    });

    return ok({ affected }, affected > 0 ? "No kehilangan berhasil disimpan" : "Tidak ada data yang diperbarui");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "req_ktp_hilang/update_err",
      at: "/api/req/ektp/kehilangan/update",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal menyimpan no kehilangan");
  }
}
