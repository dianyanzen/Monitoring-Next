import { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { readServerSession } from "@/lib/session";
import { execDml } from "@/lib/db";
import { Log } from "@/lib/log";
import {
  getDemog221Alias,
  getSearchAlias,
  PUSHABLE_STATUS,
  PUSH_TARGET_STATUS,
  sanitizeNumberList,
} from "../utils";

type PushRequest = {
  nik?: string;
  niks?: string[] | string;
};

function buildPlaceholders(values: string[], prefix: string) {
  const placeholders: string[] = [];
  const binds: Record<string, string> = {};
  values.forEach((value, index) => {
    const key = `${prefix}${index}`;
    placeholders.push(`:${key}`);
    binds[key] = value;
  });
  return { placeholders, binds };
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const session = await readServerSession().catch(() => null);
  if (!session) return unauthorized("Sesi tidak ditemukan");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  const ua = req.headers.get("user-agent") || undefined;

  let payload: PushRequest | null = null;
  try {
    payload = (await req.json()) as PushRequest;
  } catch {
    return badRequest("Payload tidak valid (harus JSON)");
  }
  if (!payload) return badRequest("Payload tidak boleh kosong");

  const nikSet = new Set<string>();
  if (payload.nik) {
    sanitizeNumberList(payload.nik).forEach((value) => nikSet.add(value));
  }
  if (Array.isArray(payload.niks)) {
    sanitizeNumberList(payload.niks.join(",")).forEach((value) => nikSet.add(value));
  } else if (typeof payload.niks === "string") {
    sanitizeNumberList(payload.niks).forEach((value) => nikSet.add(value));
  }

  const nikList = Array.from(nikSet);
  if (!nikList.length) {
    return badRequest("NIK wajib diisi");
  }
  if (nikList.length > 50) {
    return badRequest("Maksimal 50 NIK per permintaan");
  }

  const statusParts = buildPlaceholders(PUSHABLE_STATUS, "status");
  const nikParts = buildPlaceholders(nikList, "nik");

  const baseBinds = {
    target: PUSH_TARGET_STATUS,
    ...statusParts.binds,
    ...nikParts.binds,
  };

  const statusClause = statusParts.placeholders.join(", ");
  const nikClause = nikParts.placeholders.join(", ");

  const sqlDemog = `
    UPDATE DEMOGRAPHICS
    SET CURRENT_STATUS_CODE = :target
    WHERE CURRENT_STATUS_CODE IN (${statusClause})
      AND NIK IN (${nikClause})
  `;

  const sqlDemogAll = `
    UPDATE DEMOGRAPHICS_ALL
    SET CURRENT_STATUS_CODE = :target
    WHERE CURRENT_STATUS_CODE IN (${statusClause})
      AND NIK IN (${nikClause})
  `;

  const aliasDemog221 = getDemog221Alias();
  const aliasSearch = getSearchAlias();

  try {
    const [aff221, affDemog, affDemogAll] = await Promise.all([
      execDml(sqlDemog, { ...baseBinds }, {}, aliasDemog221),
      execDml(sqlDemog, { ...baseBinds }, {}, aliasSearch),
      execDml(sqlDemogAll, { ...baseBinds }, {}, aliasSearch),
    ]);

    const totalAffected = (aff221 || 0) + (affDemog || 0) + (affDemogAll || 0);
    const message =
      totalAffected > 0
        ? `Berhasil memperbarui status ${nikList.length === 1 ? "NIK" : "beberapa NIK"} menjadi ${PUSH_TARGET_STATUS}`
        : "Tidak ada data yang diperbarui. Status kemungkinan sudah sesuai atau tidak memenuhi kriteria Re-Push.";

    await Log.info({
      scope: "API",
      msg: "KTP-el push status",
      at: "/api/check/ktpel/push",
      tookMs: Date.now() - startedAt,
      user: session.S_USER_ID,
      ip,
      ua,
      extra: {
        nikCount: nikList.length,
        totalAffected,
        affected: {
          demog221: aff221,
          demog: affDemog,
          demogAll: affDemogAll,
        },
      },
    });

    return ok({
      message,
      nik: nikList,
      affected: {
        demog221: aff221,
        demog: affDemog,
        demogAll: affDemogAll,
        total: totalAffected,
      },
      targetStatus: PUSH_TARGET_STATUS,
    });
  } catch (error: any) {
    await Log.error({
      scope: "API",
      msg: "KTP-el push status failed",
      at: "/api/check/ktpel/push",
      tookMs: Date.now() - startedAt,
      user: session.S_USER_ID,
      ip,
      ua,
      err: {
        name: error?.name || "Error",
        message: error?.message || String(error),
        stack: error?.stack,
      },
      extra: {
        nikCount: nikList.length,
      },
    });
    return err("Gagal memproses Re-Push KTP-el", 500);
  }
}
