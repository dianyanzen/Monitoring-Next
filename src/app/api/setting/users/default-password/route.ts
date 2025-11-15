// FILE: src/app/api/setting/users/default-password/route.ts
import { readServerSession } from "@/lib/session";
import { ok, unauthorized } from "@/lib/http";

export const runtime = "edge";
export const dynamic = "force-static";

export async function GET() {
  const sess = await readServerSession();
  if (!sess?.S_USER_ID) return unauthorized();

  const fallback = process.env.SETTING_USER_DEFAULT_PASS ?? "123456";
  const masked = process.env.NODE_ENV === "production" ? "********" : fallback;

  return ok({
    default_password: fallback,
    masked,
  });
}

