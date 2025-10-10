// src/app/api/user/route.ts
import { NextResponse } from "next/server";
import { getUserById } from "@/lib/user";
import { readServerSession } from "@/lib/session";

// selalu hit server (tanpa cache)
export const dynamic = "force-dynamic"; // atau: export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Ambil dari query (?user_id=...) atau dari session (S_USER_ID)
    const fromQuery = searchParams.get("user_id")?.trim() || "";
    const sess = await readServerSession();
    const userId = (fromQuery || sess?.S_USER_ID || "").trim();

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await getUserById(userId);
    if (!data) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    // opsional: log error di sini
    return NextResponse.json(
      { message: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
