import type { NextRequest } from "next/server";
import { handleUpload } from "@/lib/pdak/uploadService";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  return handleUpload(request, true);
}
