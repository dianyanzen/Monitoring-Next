import type { NextRequest } from "next/server";
import { badRequest, err, forbidden, ok, unauthorized } from "@/lib/http";
import { readServerSession } from "@/lib/session";
import { hasPdakViewAccess } from "@/lib/pdak/access";
import { isDatasetType } from "@/lib/pdak/parser";
import { snapshotDate, readSnapshot } from "@/lib/pdak/snapshots";
import { withPdakConnection } from "@/lib/pdak/uploadRepository";
import { noStore } from "@/lib/pdak/request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const session = await readServerSession();
    if (!session) return noStore(unauthorized());
    if (!(await hasPdakViewAccess(session.S_USER_LEVEL)))
      return noStore(forbidden());
    const type = request.nextUrl.searchParams.get("dataset") || "KIA";
    if (!isDatasetType(type))
      return noStore(badRequest("Kategori PDAK tidak valid."));
    let date: string | null;
    try {
      date = snapshotDate(request.nextUrl.searchParams.get("date"));
    } catch {
      return noStore(
        badRequest("Tanggal harus valid dengan format YYYY-MM-DD."),
      );
    }
    return noStore(
      ok(await withPdakConnection((conn) => readSnapshot(conn, type, date))),
    );
  } catch {
    return noStore(
      err("Data PDAK belum dapat dimuat. Silakan coba kembali.", 503),
    );
  }
}
