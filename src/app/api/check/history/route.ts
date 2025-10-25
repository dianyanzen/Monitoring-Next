// FILE: src/app/api/check/history/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { ok, err, badRequest } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import { readServerSession } from "@/lib/session";

const ORACLE_IN_LIMIT = 999;
const ORACLE_ALIAS = process.env.DB_ALIAS_HISTORY ?? "DB5CETAK";

/** keep only primitive for response safety */
function toPlain(obj: any) {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map((x) => toPlain(x));
  if (typeof obj === "object") {
    const p: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) p[k] = v;
      else if (["string", "number", "boolean"].includes(typeof v)) p[k] = v;
    }
    return p;
  }
  return obj;
}

function parseNikList(raw: unknown, limit = 100) {
  const s = String(raw ?? "")
    .replace(/^[,\s]+/, "")
    .replace(/[^\d,]/g, "")
    .replace(/,+/g, ",")
    .replace(/(^,|,$)/g, "");
  const arr = s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => v.replace(/[^\d]/g, "").slice(0, 16));
  const uniq = Array.from(new Set(arr)).filter(Boolean);
  if (!uniq.length) throw new Error("NIK wajib diisi.");
  if (uniq.length > limit) throw new Error(`Maksimal ${limit} NIK per permintaan.`);
  return uniq;
}

function buildInClause(values: string[]) {
  const names: string[] = [];
  const binds: Record<string, any> = {};
  values.forEach((v, i) => {
    const k = `nik${i}`;
    names.push(`:${k}`);
    binds[k] = v;
  });
  return { clause: names.join(","), binds };
}

function historySql(clause: string) {
  return `
    SELECT A.NIK, A.NO_KK, A.NAMA_LGKP, B.CHIP_ID,
           TO_CHAR(B.PERSONALIZED_DATE,'DD-MM-YYYY') AS KTP_DT,
           B.CREATED_USERNAME AS KTP_BY,
           CASE WHEN TO_CHAR(B.LAST_UPDATE,'DD-MM-YYYY') IS NULL THEN '-' ELSE TO_CHAR(B.LAST_UPDATE,'DD-MM-YYYY') END AS UPDATED_DT,
           CASE WHEN B.LAST_UPDATED_USERNAME IS NULL THEN NULL ELSE B.LAST_UPDATED_USERNAME END AS UPDATED_BY,
           A.NAMA_KEC, A.NAMA_KEL
    FROM DEMOGRAPHICS_ALL A
    INNER JOIN CARD_MANAGEMENT B ON A.NIK = B.NIK
    WHERE (
            A.TGL_LHR <= ADD_MONTHS(SYSDATE, -12*17)
            OR NVL(A.STAT_KWN,'BELUM KAWIN') <> 'BELUM KAWIN'
          )
      AND (:no_kec = 0 OR A.NO_KEC = :no_kec)
      AND A.NIK IN (${clause})
    ORDER BY B.PERSONALIZED_DATE DESC NULLS LAST
  `;
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const s = await readServerSession();
    if (!s?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const body = await req.json().catch(() => null);
    const nikList = parseNikList(body?.nik);
    const no_kec = Number(s.S_NO_KEC ?? 0) || 0;

    // pecah sesuai limit IN Oracle (999)
    const chunks: string[][] = [];
    for (let i = 0; i < nikList.length; i += ORACLE_IN_LIMIT) {
      chunks.push(nikList.slice(i, i + ORACLE_IN_LIMIT));
    }

    const allRows: any[] = [];
    for (const group of chunks) {
      const { clause, binds: nikBinds } = buildInClause(group);
      const sql = historySql(clause);
      const binds = { no_kec, ...nikBinds };
      const raw = await execRows(sql, binds, {}, ORACLE_ALIAS);
      const rows = Array.isArray(raw) ? toPlain(raw) : [];
      allRows.push(...rows);
    }

    await Log.info({
      scope: "API",
      msg: "history served",
      at: "/api/check/history",
      tookMs: Date.now() - t0,
      extra: { total: allRows.length, no_kec, nikCount: nikList.length, chunkCount: chunks.length },
    });

    // kalau mau cache tipis: ok({ rows: allRows, total: allRows.length }, 15)
    return ok({ rows: allRows, total: allRows.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "history error",
      at: "/api/check/history",
      tookMs: Date.now() - t0,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    const m = e?.message || "Gagal memuat data";
    if (/wajib|Maksimal/i.test(m)) return badRequest(m);
    return err(m, 500);
  }
}
