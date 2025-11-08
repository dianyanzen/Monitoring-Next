// FILE: src/app/api/dummy/route.ts
import type { NextRequest } from "next/server";
import { ok, err } from "@/lib/http";
import { execOne } from "@/lib/db";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DB = process.env.DB_ALIAS_CETAK ?? "DB5CETAK";
const PYTHON_BIN = process.env.PYTHON_BIN ?? "python"; // atau "python3"
const PY_SCRIPT = process.env.WSQ_PY ?? path.join(process.cwd(), "scripts", "wsq_to_png.py");

type Row = {
  RIGHT_THUMB: Buffer | null; RIGHT_INDEX: Buffer | null; RIGHT_MIDDLE: Buffer | null; RIGHT_RING: Buffer | null; RIGHT_LITTLE: Buffer | null;
  LEFT_THUMB:  Buffer | null; LEFT_INDEX:  Buffer | null; LEFT_MIDDLE:  Buffer | null; LEFT_RING:  Buffer | null; LEFT_LITTLE:  Buffer | null;
  IMAGE_TYPE_CODE: string | null;
};
type FingerOut = { name: string; png: string | null; error?: string };

const ORDER: Array<keyof Row> = [
  "RIGHT_THUMB","RIGHT_INDEX","RIGHT_MIDDLE","RIGHT_RING","RIGHT_LITTLE",
  "LEFT_THUMB","LEFT_INDEX","LEFT_MIDDLE","LEFT_RING","LEFT_LITTLE",
];

function runPythonWSQtoPNG(buf: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn(PYTHON_BIN, [PY_SCRIPT], { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const errs: Buffer[] = [];
    p.stdout.on("data", (c) => out.push(c as Buffer));
    p.stderr.on("data", (c) => errs.push(c as Buffer));
    p.on("error", (e) => reject(e));
    p.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(Buffer.concat(errs).toString() || `python exit ${code}`));
    });
    p.stdin.end(buf);
  });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const nik = (url.searchParams.get("nik") || "").replace(/\D/g, "");

    const sql = nik
      ? `SELECT RIGHT_THUMB,RIGHT_INDEX,RIGHT_MIDDLE,RIGHT_RING,RIGHT_LITTLE,
                LEFT_THUMB,LEFT_INDEX,LEFT_MIDDLE,LEFT_RING,LEFT_LITTLE, IMAGE_TYPE_CODE
           FROM FINGERS WHERE NIK = :b_nik AND ROWNUM = 1`
      : `SELECT RIGHT_THUMB,RIGHT_INDEX,RIGHT_MIDDLE,RIGHT_RING,RIGHT_LITTLE,
                LEFT_THUMB,LEFT_INDEX,LEFT_MIDDLE,LEFT_RING,LEFT_LITTLE, IMAGE_TYPE_CODE
           FROM (SELECT * FROM FINGERS ORDER BY CREATED DESC NULLS LAST) WHERE ROWNUM = 1`;

    const row = await execOne<Row>(sql, nik ? { b_nik: nik } : {}, {}, DB);
    if (!row) return ok({ mime: "image/png", fingers: [] as FingerOut[] });

    const fingers: FingerOut[] = [];
    for (const key of ORDER) {
      const blob = row[key];
      const name = key.toLowerCase();
      if (!blob) { fingers.push({ name, png: null }); continue; }
      try {
        const png = await runPythonWSQtoPNG(Buffer.from(blob));
        fingers.push({ name, png: png.toString("base64") });
      } catch (e: any) {
        fingers.push({ name, png: null, error: e?.message || "convert error" });
      }
    }

    return ok({ mime: "image/png", fingers });
  } catch (e: any) {
    return err("Gagal mengambil/konversi FINGERS", 500, { error: e?.message });
  }
}
