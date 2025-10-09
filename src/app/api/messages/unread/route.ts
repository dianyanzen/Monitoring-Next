// app/api/messages/unread/route.ts
import { cookies } from "next/headers";
import { execOne } from "@/lib/db";
import { ok, badRequest, unauthorized, err } from "@/lib/http";

type CountRow = { JML?: number | string };

export async function GET() {
  try {
    // 1) Ambil cookie (sinkron, tanpa await)
    const sessionRaw = (await cookies()).get("session_user")?.value;
    if (!sessionRaw) return unauthorized("Unauthorized");

    // 2) Parse session
    let sessionData: any;
    try {
      sessionData = JSON.parse(sessionRaw);
    } catch {
      return badRequest("Invalid session format");
    }

    const nik = String(sessionData?.S_NIK ?? "");
    if (!nik || nik === "0") return unauthorized("Invalid session");

    // 3) Hitung jumlah PENGIRIM unik yang punya pesan unread ke NIK ini
    //    Catatan: Jika kolom TO_ID bertipe VARCHAR2, pakai TO_CHAR(:b_nik).
    //             Jika NUMBER, ganti ke: WHERE TO_ID = :b_nik
    const sql = `
      SELECT COUNT(DISTINCT FROM_ID) AS JML
      FROM MESSAGES
      WHERE TO_ID = TO_CHAR(:b_nik)
        AND READ = 0
    `;

    const row = await execOne<CountRow>(sql, { b_nik: nik }, {}, "DB");
    const count = Number(row?.JML ?? 0);

    return ok({ count });
  } catch (e: any) {
    console.error("🔥 /api/messages/unread error:", e);
    return err(e?.message || "Internal server error");
  }
}
