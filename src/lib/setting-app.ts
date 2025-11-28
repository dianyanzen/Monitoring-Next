// FILE: src/lib/setting-app.ts
export type CutoffNormalization = {
  display: string;
  db: string;
};

/**
 * Normalisasi input cutoff DKB agar konsisten:
 * - menerima format DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD
 * - mengembalikan pasangan display (DD-MM-YYYY) dan db (DD/MM/YYYY)
 */
export function normalizeCutoffInput(raw: string): CutoffNormalization | null {
  const value = (raw || "").trim();
  if (!value) return null;

  const normalized = value.replace(/[\s.]+/g, "/").replace(/-+/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length !== 3) return null;

  let dayPart = "";
  let monthPart = "";
  let yearPart = "";

  const [p1, p2, p3] = parts;

  if (p1.length === 4 && p2.length <= 2 && p3.length <= 2) {
    yearPart = p1;
    monthPart = p2;
    dayPart = p3;
  } else if (p3.length === 4) {
    dayPart = p1;
    monthPart = p2;
    yearPart = p3;
  } else if (p1.length === 4) {
    yearPart = p1;
    monthPart = p2;
    dayPart = p3;
  } else {
    dayPart = p1;
    monthPart = p2;
    yearPart = p3;
  }

  if (!/^\d{1,2}$/.test(dayPart) || !/^\d{1,2}$/.test(monthPart)) {
    return null;
  }
  if (!/^\d{4}$/.test(yearPart)) {
    return null;
  }

  const day = Number(dayPart);
  const month = Number(monthPart);
  const year = Number(yearPart);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const yyyy = String(year).padStart(4, "0");

  return { display: `${dd}-${mm}-${yyyy}`, db: `${dd}/${mm}/${yyyy}` };
}

export function formatCutoffForDisplay(raw?: string | null) {
  const value = (raw || "").trim();
  if (!value) return "";
  const normalized = normalizeCutoffInput(value);
  if (normalized) return normalized.display;
  return value.replace(/\//g, "-");
}
