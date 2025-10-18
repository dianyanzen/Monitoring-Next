// FILE: src/app/api/chat/messages/route.ts
import { ok, err } from "@/lib/http";
import { execRows, execDml } from "@/lib/db";
import { Log } from "@/lib/log";
import { readServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RowDB = {
  ID: number;
  FROM_ID: string | number | null;
  TO_ID: string | number | null;
  TEXT_SNIP: string | null;
  IMG: string | null;
  CREATED_AT_ISO: string | null;
};

export async function GET(req: Request) {
  const t0 = Date.now();
  try {
    const url = new URL(req.url);
    const s = await readServerSession();
    const myNik = String(s?.S_NIK ?? "").trim();
    const otherNik = String(url.searchParams.get("with") ?? "").trim();

    if (!/^\d{10,20}$/.test(myNik) || !/^\d{10,20}$/.test(otherNik)) {
      return err("Parameter 'with' atau sesi NIK invalid", 400);
    }

    // 🔹 1️⃣ Ambil semua pesan antar dua user
    const sql = `
      SELECT
        ID,
        FROM_ID,
        TO_ID,
        DBMS_LOB.SUBSTR(TEXT, 4000, 1) AS TEXT_SNIP,
        IMG,
        TO_CHAR(CREATED_AT,'YYYY-MM-DD"T"HH24:MI:SS') AS CREATED_AT_ISO
      FROM MESSAGES
      WHERE (
        (FROM_ID = :b_me AND TO_ID = :b_other) OR
        (FROM_ID = :b_other AND TO_ID = :b_me)
      )
      AND NVL(DELETED_FROM,0) = 0
      AND NVL(DELETED_TO,0)   = 0
      ORDER BY ID
    `;

    const binds = { b_me: myNik, b_other: otherNik };
    const rows = await execRows<RowDB>(sql, binds, {}, "DB");

    // 🔹 2️⃣ Setelah pesan dibaca → update kolom READ = 1
    // hanya pesan dari lawan ke saya (FROM_ID = other, TO_ID = me)
    await execDml(
      `UPDATE MESSAGES
       SET READ = 1
       WHERE TO_ID = :b_me AND FROM_ID = :b_other AND NVL(READ,0) <> 1`,
      binds,
      { autoCommit: true },
      "DB"
    );

    // 🔹 3️⃣ Bentuk hasil
    const items = rows.map((r) => ({
      id: r.ID,
      fromId: String(r.FROM_ID ?? ""),
      toId: String(r.TO_ID ?? ""),
      text: r.TEXT_SNIP ?? "",
      img: r.IMG ?? null,
      createdAt: r.CREATED_AT_ISO ?? "",
    }));

    await Log.info({
      scope: "API",
      msg: "chat/messages ok",
      at: "/api/chat/messages",
      tookMs: Date.now() - t0,
      binds,
      extra: { count: items.length, markRead: true },
    });

    return ok(items);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "chat/messages error",
      at: "/api/chat/messages",
      tookMs: Date.now() - t0,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal memuat pesan", 500);
  }
}
