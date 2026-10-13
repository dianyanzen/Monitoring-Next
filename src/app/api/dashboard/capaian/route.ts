import { ok, err, badRequest, unauthorized } from "@/lib/http";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import { snapshotDate } from "@/lib/pdak/snapshots";
import { readCapaian } from "@/lib/dashboard/capaianRepository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const user = await readServerSession();
    if (!user?.S_USER_ID) return unauthorized();
    let date: string | null;
    try {
      date = snapshotDate(new URL(req.url).searchParams.get("date"));
    } catch {
      return badRequest("Tanggal tidak valid.");
    }
    const data = await readCapaian(date);
    await Log.info({
      scope: "API",
      msg: "dashboard/capaian PDAK",
      user: user.S_USER_ID,
      extra: { date },
    });
    const response = ok(data);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (e) {
    await Log.error({
      scope: "API",
      msg: "dashboard/capaian error",
      err: {
        name: e instanceof Error ? e.name : "Error",
        message: e instanceof Error ? e.message : "Unknown",
      },
    });
    return err("Gagal mengambil data capaian. Silakan coba lagi.");
  }
}
