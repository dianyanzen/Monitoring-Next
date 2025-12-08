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

    const baseUrl =
      process.env.ABSENSI_MACHINE_BASE?.replace(/\/$/, "") ||
      "http://10.32.73.7:8080/monitoring";

    const pathMap: Record<MachineKey, string> = {
      mim: "/api/Report/sync_mim",
      fcl: "/api/Report/sync_fcl",
      dinas: "/api/Report/sync_dns",
    };

    const target = `${baseUrl}${pathMap[machine]}`;

    const res = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // Body dikirim kosong sesuai endpoint Laravel yang ada.
    });

    if (!res.ok) {
      const text = await res.text();
      await Log.error({
        scope: "API",
        msg: "ABSENSI_SYNC_MACHINE_FAIL",
        at: "/api/report/absensi/sync",
        user: sess.S_USER_ID,
        tookMs: Date.now() - started,
        extra: { machine, target, status: res.status, text },
      });
      return err(`Sync mesin ${machine.toUpperCase()} gagal (${res.status}).`);
    }

    let payload: any = {};
    try {
      payload = await res.json();
    } catch {
      payload = { message: await res.text() };
    }

    await Log.info({
      scope: "API",
      msg: "ABSENSI_SYNC_MACHINE",
      at: "/api/report/absensi/sync",
      user: sess.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { machine, target, backendMessage: payload?.message },
    });

    return ok({
      message:
        payload?.message ||
        `Background task sync mesin ${machine.toUpperCase()} dieksekusi.`,
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
