import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { ok, err } from "@/lib/http";
import { Log } from "@/lib/log";
import { ensureSession } from "@/lib/espasi/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIDEO_EXT = new Set([".mp4", ".flv", ".mov"]);

function getJakartaWeekday() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}

async function readVideoNames(dirAbs: string) {
  try {
    const entries = await readdir(dirAbs, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => VIDEO_EXT.has(path.extname(name).toLowerCase()));
  } catch {
    return [] as string[];
  }
}

export async function GET(_req: NextRequest) {
  const started = Date.now();
  const auth = await ensureSession();
  if (auth.error) return auth.error;

  const weekday = getJakartaWeekday();
  const publicDir = path.join(process.cwd(), "public");

  try {
    const dayDirAbs = path.join(publicDir, "assets", "video", weekday);
    const baseDirAbs = path.join(publicDir, "assets", "video");

    const dayFiles = await readVideoNames(dayDirAbs);
    const baseFiles = await readVideoNames(baseDirAbs);

    const prefDay = dayFiles.map((name) => `/assets/video/${weekday}/${name}`);
    const prefBase = baseFiles.map((name) => `/assets/video/${name}`);
    const items = [...new Set([...prefDay, ...prefBase])];

    await Log.info({
      scope: "API",
      msg: "espasi/video",
      at: "/api/espasi/video",
      user: auth.session?.S_USER_ID,
      tookMs: Date.now() - started,
      extra: {
        weekday,
        total: items.length,
      },
    });

    return ok(items);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "espasi/video/error",
      at: "/api/espasi/video",
      user: auth.session?.S_USER_ID,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat daftar video", 500);
  }
}
