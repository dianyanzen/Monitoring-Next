export const TRACKING_STATUSES = [
  "BERKAS_MASUK",
  "SELESAI",
  "DIAMBIL",
  "BATAL",
] as const;

export type TrackingStatus = (typeof TRACKING_STATUSES)[number];

export const FINAL_TRACKING_STATUSES: TrackingStatus[] = ["DIAMBIL", "BATAL"];

export const TRACKING_STATUS_LABELS: Record<TrackingStatus, string> = {
  BERKAS_MASUK: "BERKAS MASUK",
  SELESAI: "SELESAI",
  DIAMBIL: "DIAMBIL",
  BATAL: "BATAL",
};

export const LOCATION_TYPES = ["KECAMATAN", "GEULIS", "MEPELING", "DINAS"] as const;

export type TrackingLocationType = (typeof LOCATION_TYPES)[number];

export function isTrackingStatus(value: unknown): value is TrackingStatus {
  return TRACKING_STATUSES.includes(String(value || "").toUpperCase() as TrackingStatus);
}

export function nextAllowedStatuses(current: TrackingStatus) {
  if (current === "BERKAS_MASUK") return ["SELESAI", "BATAL"] as TrackingStatus[];
  if (current === "SELESAI") return ["DIAMBIL"] as TrackingStatus[];
  return [] as TrackingStatus[];
}

export function normalizeText(value: unknown) {
  return value == null ? "" : String(value).trim();
}

export function normalizeUpper(value: unknown) {
  return normalizeText(value).toUpperCase();
}

export function normalizeDigits(value: unknown, maxLength?: number) {
  const digits = normalizeText(value).replace(/\D/g, "");
  return typeof maxLength === "number" ? digits.slice(0, maxLength) : digits;
}

export function toIsoDate(value: Date) {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function ddmmyyyyToIso(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function isoToDdmmyyyy(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function isIsoDate(value: unknown) {
  const text = normalizeText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00`);
  return !Number.isNaN(d.getTime()) && toIsoDate(d) === text;
}
