import type { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import {
  ESPASI_APP_HOST_URL,
  ESPASI_APP_SOCKET_WA,
  ensureSession,
} from "@/lib/espasi/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const auth = await ensureSession();
  if (auth.error) return auth.error;

  return ok({
    hostUrl: ESPASI_APP_HOST_URL,
    socketWaUrl: ESPASI_APP_SOCKET_WA,
  });
}
