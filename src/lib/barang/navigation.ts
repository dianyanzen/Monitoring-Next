export const MENU_PATHS = {
  master: ["barang/masterbarang"],
  inputaset: ["barang/inputaset"],
  masuk: ["barang/inputmasuk"],
  keluar: ["barang/inputkeluar"],
  status: ["barang/cekbarang"],
  cekaset: ["barang/cekaset"],
  aset: ["barang/masteraset"],
  laporan: ["barang/laporan"],
  laporanaset: ["barang/laporanaset"],
} as const;
export type InventoryMode = keyof typeof MENU_PATHS;
export function allowed(paths: string[], mode: InventoryMode) {
  return (MENU_PATHS[mode] ?? []).some((p) => paths.includes(p));
}
