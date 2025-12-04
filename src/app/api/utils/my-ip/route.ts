// FILE: src/app/api/utils/my-ip/route.ts
import { NextResponse, type NextRequest } from "next/server";

const normalizeIp = (ip?: string | null) => {
  if (!ip) return "";
  const trimmed = ip.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^::ffff:/i, "");
};

export async function GET(request: NextRequest) {
  const xff = request.headers.get("x-forwarded-for");
  const forwarded = xff?.split(",").map((v) => v.trim()).filter(Boolean) ?? [];

  // Next.js runtime may expose `request.ip` (edge) or keep it undefined (node)
  const candidate =
    forwarded[0] ||
    request.headers.get("x-real-ip") ||
    // @ts-expect-error runtime might inject
    request.ip ||
    "";

  const ip = normalizeIp(candidate);

  return NextResponse.json({
    success: true,
    data: {
      ip: ip || "-",
      source: forwarded.length > 0 ? "x-forwarded-for" : "direct",
    },
  });
}

export const runtime = "nodejs";
