// FILE: src/app/api/chat/send/route.ts
import { ok, err, badRequest } from "@/lib/http";
import { execOne, execDml } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const t0 = Date.now();
  try {
    const s = await readServerSession();
    const myNik = String(s?.S_NIK ?? "").trim();
    if (!/^\d{10,20}$/.test(myNik)) return badRequest("Sesi tidak valid: S_NIK tidak ditemukan.");

    const body = await req.json().catch(() => ({}));
    const toId = String(body?.toId ?? "").trim();
    const text = String(body?.text ?? "").trim();

    if (!/^\d{10,20}$/.test(toId)) return badRequest("Penerima tidak valid.");
    if (!text) return badRequest("Teks pesan wajib diisi.");

    // ambil ID dari sequence
    const seq = await execOne<{ ID: number }>(
      "SELECT MESSAGES_SEQ.NEXTVAL AS ID FROM DUAL",
      {},
      {},
      "DB"
    );
    const newId = seq?.ID;
    if (!newId) return err("Gagal mengambil sequence.", 500);

    await execDml(
      `INSERT INTO MESSAGES (ID, FROM_ID, TO_ID, TEXT, IMG, CREATED_AT, READ, OPR_READ)
       VALUES (:b_id, :b_from, :b_to, :b_text, NULL, SYSTIMESTAMP, '0', 'N')`,
      { b_id: newId, b_from: myNik, b_to: toId, b_text: text },
      { autoCommit: true },
      "DB"
    );

    await Log.info({
      scope: "API",
      msg: "chat/send ok",
      at: "/api/chat/send",
      tookMs: Date.now() - t0,
      binds: { b_from: myNik, b_to: toId },
      extra: { id: newId },
    });

    return ok({ ok: true, id: newId });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "chat/send error",
      at: "/api/chat/send",
      tookMs: Date.now() - t0,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal mengirim pesan", 500);
  }
}
