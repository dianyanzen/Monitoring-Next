export type EspasiLokasiKey = "DISDUK" | "KIWARI" | "BTC" | "MIM" | "DPRD";

const LOCATION_EVENT: Record<EspasiLokasiKey, string> = {
  DISDUK: "panggil_disduk",
  KIWARI: "panggil_KIWARI",
  BTC: "panggil_btc",
  MIM: "panggil_mim",
  DPRD: "panggil_dprd",
};

const FALLBACK_EVENT = "panggil_disduk";

export function getLoketSocketEventByLokasi(lokasi: string) {
  const key = String(lokasi || "").trim().toUpperCase() as EspasiLokasiKey;
  return LOCATION_EVENT[key] ?? FALLBACK_EVENT;
}
