import type { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";
import { fetchDemogByNik, fetchPengajuanByNik, sanitizeNik } from "../utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Sesi tidak valid");

    const nikParam = new URL(req.url).searchParams.get("nik") || "";
    const nik = sanitizeNik(nikParam);
    if (nik.length !== 16) return badRequest("NIK wajib 16 digit");

    const pengajuan = await fetchPengajuanByNik(nik);
    const demog = pengajuan ? null : await fetchDemogByNik(nik);

    const payload = (() => {
      if (pengajuan) {
        return {
          status: "pengajuan" as const,
          nik: pengajuan.nik,
          nama: pengajuan.nama,
          noKec: pengajuan.noKec,
          namaKec: pengajuan.namaKec,
          reqDate: pengajuan.reqDate ?? null,
        };
      }
      if (demog) {
        return {
          status: "demog" as const,
          nik: demog.nik,
          nama: demog.nama,
          noKec: demog.noKec,
          namaKec: demog.namaKec,
          reqDate: null,
        };
      }
      return {
        status: "not_found" as const,
        nik,
        nama: "",
        noKec: "",
        namaKec: "",
        reqDate: null,
      };
    })();

    await Log.info({
      scope: "API",
      msg: "req_ktp_ld/detail",
      at: "/api/req/ektp/pindahan/detail",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { status: payload.status },
    });

    return ok(payload, "OK");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "req_ktp_ld/detail_err",
      at: "/api/req/ektp/pindahan/detail",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal memuat data NIK pindahan");
  }
}
