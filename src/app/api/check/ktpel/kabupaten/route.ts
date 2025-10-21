import { NextRequest, NextResponse } from "next/server";
import { badRequest, err, unauthorized } from "@/lib/http";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import { fetchKabupaten, resolveWilayahDefaults } from "../utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const session = await readServerSession().catch(() => null);
  if (!session) return unauthorized("Sesi tidak ditemukan");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  const ua = req.headers.get("user-agent") || undefined;

  try {
    const defaults = resolveWilayahDefaults(session);
    const params = req.nextUrl.searchParams;
    const noProp = params.get("no_prop")?.trim() || defaults.noProp;

    if (!noProp) {
      return badRequest("Parameter no_prop wajib diisi");
    }

    const kabupaten = await fetchKabupaten(noProp);

    await Log.info({
      scope: "API",
      msg: "KTP-el kabupaten",
      at: "/api/check/ktpel/kabupaten",
      tookMs: Date.now() - startedAt,
      user: session.S_USER_ID,
      ip,
      ua,
      extra: { noProp, count: kabupaten.length },
    });

    const payload = { kabupaten };
    return NextResponse.json(
      { success: true, data: payload, ...payload },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=180",
        },
      }
    );
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "KTP-el kabupaten failed",
      at: "/api/check/ktpel/kabupaten",
      tookMs: Date.now() - startedAt,
      user: session.S_USER_ID,
      ip,
      ua,
      err: { name: e?.name || "Error", message: e?.message || String(e), stack: e?.stack },
    });
    return err(e?.message || "Gagal memuat data kabupaten", 500);
  }
}
