// FILE: src/app/api/setting/get_group/route.ts
import { NextResponse } from "next/server";
import { readServerSession } from "@/lib/session";
import { execRows } from "@/lib/db";

export const dynamic = "force-dynamic";

async function handler() {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const rows = await execRows<{ LEVEL_CODE: string | number; LEVEL_NAME: string }>(
      `SELECT LEVEL_CODE, LEVEL_NAME
         FROM SIAK_USER_GROUP
        ORDER BY LEVEL_CODE`,
      {},
      {},
      "DB"
    );

    const data = rows.map((r) => ({
      level_code: String(r.LEVEL_CODE ?? "").trim(),
      level_name: String(r.LEVEL_NAME ?? "").trim(),
    }));

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET()  { return handler(); }
export async function POST() { return handler(); }
