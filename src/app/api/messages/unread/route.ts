// app/api/messages/unread/route.ts
import { NextResponse } from "next/server";
import { readServerSession } from "@/lib/session";
import { execOne } from "@/lib/db";
import { Log } from "@/lib/log";

type Row = { CNT?: number | string };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t0 = Date.now();

  const s = await readServerSession();
  if (!s) {
    await Log.warn({ scope: "SESSION", msg: "Unread: unauthenticated", at: "/api/messages/unread" });
    return NextResponse.json({ ok: false, message: "Unauthenticated" }, { status: 401 });
  }

  const nik = String(s.S_NIK);

  try {
    // ✳️ SQL ASLI — TIDAK DIUBAH
    const sql = `
      SELECT COUNT(DISTINCT FROM_ID) AS CNT
      FROM MESSAGES
      WHERE TO_ID = :b_nik
        AND READ = 0
    `;
    const row = await execOne<Row>(sql, { b_nik: nik }, {}, "DB");
    const count = Number(row?.CNT ?? 0);

    await Log.info({
      scope: "API",
      msg: "Unread messages counted",
      at: "/api/messages/unread",
      user: nik,
      tookMs: Date.now() - t0,
      extra: { count },
    });

    // opsional debug ?debug=1
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";
    return NextResponse.json(
      debug ? { ok: true, nik, count } : { ok: true, count },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "Unread messages count failed",
      at: "/api/messages/unread",
      user: nik,
      tookMs: Date.now() - t0,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e), stack: e?.stack },
    });
    return NextResponse.json(
      { ok: true, count: 0 },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
