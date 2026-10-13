import type { NextRequest } from "next/server";
import { ikdRead } from "@/lib/pdak/ikd/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return ikdRead(request, "snapshots");
}
