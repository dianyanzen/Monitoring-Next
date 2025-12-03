// FILE: src/app/api/report/absensi/sync/route.ts
import { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { ok, badRequest, unauthorized, err } from "@/lib/http";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MachineKey = "mim" | "fcl" | "dinas";

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();

    const { machine } = (await req.json()) as { machine?: MachineKey };
    if (!machine || !["mim", "fcl", "dinas"].includes(machine)) {
      return badRequest("Parameter mesin tidak valid");
    }

    // TODO: Ganti dengan integrasi ZKTeco/PLSQL yang sesungguhnya.
    await Log.info({
      scope: "API",
      msg: "ABSENSI_SYNC_MACHINE",
      at: "/api/report/absensi/sync",
      user: sess.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { machine },
    });

    return ok({
      message: `Background task sync mesin ${machine.toUpperCase()} (simulasi).`,
    });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "ABSENSI_SYNC_MACHINE",
      at: "/api/report/absensi/sync",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal menjalankan sync mesin");
  }
}
