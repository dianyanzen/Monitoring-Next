// Reuse the GET handler while declaring runtime/dynamic locally so Next.js can detect them.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { GET } from "../status/route";
