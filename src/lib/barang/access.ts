import { execRows } from "@/lib/db";
export { MENU_PATHS, allowed, type InventoryMode } from "./navigation";
export async function inventoryPermissions(level: number | undefined) {
  if (!level || !Number.isFinite(level)) return [];
  const rows = await execRows<{ URL: string }>(
    `SELECT DISTINCT LOWER(TRIM(BOTH '/' FROM TRIM(URL))) URL FROM VW_SIAK_MENU WHERE USER_LEVEL=:level_value AND ACTIVE_MENU=1 AND IS_NEXT=1 AND IS_ACTIVE=1 AND LOWER(URL) LIKE :path`,
    { level_value: level, path: "barang/%" },
    {},
    "DB",
  );
  return rows.map((r) => r.URL);
}
