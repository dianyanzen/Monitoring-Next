import type { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { getClientInfo, readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import { fetchList, parseRange } from "../utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Sesi tidak valid");

    const body = (await req.json().catch(() => ({}))) as { range?: string; start?: string; end?: string };
    const { start, end } = body.start && body.end ? { start: body.start, end: body.end } : parseRange(body.range);
    if (!start || !end) return badRequest("Rentang tanggal tidak valid");

    const noKec = Number(session.S_NO_KEC ?? 0) || 0;
    const items = await fetchList(start, end, noKec);

    await Log.info({
      scope: "API",
      msg: "req_ktp_hilang/list",
      at: "/api/req/ektp/kehilangan/list",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { count: items.length, noKec },
    });

    return ok({ items, count: items.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "req_ktp_hilang/list_err",
      at: "/api/req/ektp/kehilangan/list",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal memuat daftar pengajuan hilang");
  }
}
