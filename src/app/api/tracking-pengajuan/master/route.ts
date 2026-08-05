// FILE: src/app/api/tracking-pengajuan/master/route.ts
import type { NextRequest } from "next/server";
import { err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { getClientInfo, readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import { normalizeText } from "@/lib/tracking/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_TRACKING ?? "DB";

type LocationRow = {
  LOCATION_ID: number;
  LOCATION_CODE: string;
  LOCATION_NAME: string;
  LOCATION_GROUP: string;
  IS_ACTIVE: string;
};

type ProductRow = {
  PRODUCT_ID: number;
  PRODUCT_CODE: string;
  PRODUCT_NAME: string;
  IS_ACTIVE: string;
};

type RelationRow = {
  LOCATION_ID: number;
  PRODUCT_ID: number;
};

export async function GET(_req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const [locations, products, relations] = await Promise.all([
      execRows<LocationRow>(
        `
        SELECT LOCATION_ID, LOCATION_CODE, LOCATION_NAME, LOCATION_GROUP, IS_ACTIVE
        FROM M_TRACKING_LOCATION
        WHERE IS_ACTIVE = 'Y'
        ORDER BY LOCATION_ID
        `,
        {},
        {},
        ORACLE_ALIAS
      ),
      execRows<ProductRow>(
        `
        SELECT PRODUCT_ID, PRODUCT_CODE, PRODUCT_NAME, IS_ACTIVE
        FROM M_TRACKING_PRODUCT
        WHERE IS_ACTIVE = 'Y'
        ORDER BY PRODUCT_NAME
        `,
        {},
        {},
        ORACLE_ALIAS
      ),
      execRows<RelationRow>(
        `
        SELECT LOCATION_ID, PRODUCT_ID
        FROM M_TRACKING_LOCATION_PRODUCT
        WHERE IS_ACTIVE = 'Y'
        `,
        {},
        {},
        ORACLE_ALIAS
      ),
    ]);

    await Log.info({
      scope: "API",
      msg: "tracking/master",
      at: "/api/tracking-pengajuan/master",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { locations: locations.length, products: products.length, relations: relations.length },
    });

    return ok(
      {
        locations: locations.map((row) => ({
          locationId: Number(row.LOCATION_ID),
          code: normalizeText(row.LOCATION_CODE),
          name: normalizeText(row.LOCATION_NAME),
          type: normalizeText(row.LOCATION_GROUP),
          group: normalizeText(row.LOCATION_GROUP),
        })),
        products: products.map((row) => ({
          productId: Number(row.PRODUCT_ID),
          code: normalizeText(row.PRODUCT_CODE),
          name: normalizeText(row.PRODUCT_NAME),
        })),
        relations: relations.map((row) => ({
          locationId: Number(row.LOCATION_ID),
          productId: Number(row.PRODUCT_ID),
        })),
      },
      "Master tracking berhasil dimuat"
    );
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "tracking/master_err",
      at: "/api/tracking-pengajuan/master",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat master tracking");
  }
}
