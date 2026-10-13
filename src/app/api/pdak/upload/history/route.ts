import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { authorize, noStore } from "@/lib/pdak/request";
import { uploadHistory } from "@/lib/pdak/uploadRepository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize();
    if (auth.response) return noStore(auth.response);
    const l = request.nextUrl.searchParams.get("limit") || "20",
      o = request.nextUrl.searchParams.get("offset") || "0";
    if (!/^\d+$/.test(l) || !/^\d+$/.test(o))
      return noStore(badRequest("Pagination tidak valid."));
    const limit = Number(l),
      offset = Number(o);
    if (
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger(offset) ||
      offset > 1000000
    )
      return noStore(badRequest("Pagination di luar batas."));
    const items = await uploadHistory(limit, offset);
    return noStore(
      ok({ items, limit, offset, hasMore: items.length === limit }),
    );
  } catch {
    return noStore(err("Riwayat tidak dapat dimuat.", 503));
  }
}
