import type { NextRequest } from "next/server";
import { err, ok, unauthorized } from "@/lib/http";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";
import { fetchAksesKecamatan, fetchKecamatanOptions, resolveDefaultNoKec } from "../utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Sesi tidak valid");

    const [aksesKec, kecamatan] = await Promise.all([fetchAksesKecamatan(), fetchKecamatanOptions()]);
    const defaultNoKec = resolveDefaultNoKec(session);

    const payload = {
      akses: { aksesKecamatan: aksesKec },
      defaults: { noKec: defaultNoKec },
      wilayah: { kecamatan },
    };

    await Log.info({
      scope: "API",
      msg: "req_ktp_ld/meta",
      at: "/api/req/ektp/pindahan/meta",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { kecCount: kecamatan.length, aksesKecamatan: aksesKec },
    });

    return ok(payload, "OK", 60);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "req_ktp_ld/meta_err",
      at: "/api/req/ektp/pindahan/meta",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat metadata pengajuan pindahan");
  }
}
