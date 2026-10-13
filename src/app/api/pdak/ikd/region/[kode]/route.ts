import type { NextRequest } from "next/server";
import { ikdRead } from "@/lib/pdak/ikd/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ kode: string }> },
) {
  const { kode } = await context.params;
  return ikdRead(request, "region", kode);
}
