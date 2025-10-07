import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return NextResponse.json({ user: null });

  const match = cookieHeader.match(/session_user=([^;]+)/);
  if (!match) return NextResponse.json({ user: null });

  try {
    const data = JSON.parse(decodeURIComponent(match[1]));
    return NextResponse.json({ user: data });
  } catch {
    return NextResponse.json({ user: null });
  }
}
