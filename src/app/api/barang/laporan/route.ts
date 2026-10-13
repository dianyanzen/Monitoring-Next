import { inventoryApi } from "@/lib/barang/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  return inventoryApi(req, "laporan");
}
export function POST(req: Request) {
  return inventoryApi(req, "laporan");
}
