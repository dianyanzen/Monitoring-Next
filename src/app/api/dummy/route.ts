export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
};

export async function GET() {
  return new Response("ok", { headers });
}

export async function POST() {
  return new Response("ok", { headers });
}