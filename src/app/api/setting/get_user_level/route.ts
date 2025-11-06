// FILE: src/app/api/setting/get_user_level/route.ts
import { NextResponse } from "next/server";
import { readServerSession } from "@/lib/session";
import { execRows } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const rawGroupId = (body?.group_id ?? "").toString().trim();
    if (!rawGroupId) {
      return NextResponse.json({ message: "Parameter 'group_id' wajib diisi" }, { status: 200 });
    }

    const rows = await execRows<{
      USER_LEVEL: string | number;
      LEVEL_NAME: string;
      GROUP_NAME: string;
      LEVEL_CODE: string | number;
    }>(
      `SELECT
         A.USER_LEVEL,
         A.LEVEL_NAME,
         B.LEVEL_NAME AS GROUP_NAME,
         B.LEVEL_CODE
       FROM SIAK_USER_LEVEL A
       INNER JOIN SIAK_USER_GROUP B ON A.GROUP_LEVEL = B.LEVEL_CODE
       WHERE A.GROUP_LEVEL = :b_group_id
       ORDER BY A.USER_LEVEL`,
      { b_group_id: rawGroupId },
      {},
      "DB"
    );

    const data = rows.map(r => ({
      user_level: String(r.USER_LEVEL ?? "").trim(),
      level_name: String(r.LEVEL_NAME ?? "").trim(),
      group_name: String(r.GROUP_NAME ?? "").trim(),
      level_code: String(r.LEVEL_CODE ?? "").trim(),
    }));

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
