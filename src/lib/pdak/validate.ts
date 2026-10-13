import type { ParsedRecord } from "./parser";
import { UploadValidationError } from "./parser";

export function validateHierarchy(
  rows: ParsedRecord[],
  master?: Map<string, string>,
) {
  const codes = new Set(rows.map((row) => String(row.KODE)));
  const counts = { city: 0, district: 0, village: 0 };
  for (const [index, row] of rows.entries()) {
    const code = String(row.KODE);
    const parts = code.split(".");
    if (parts.length === 2) counts.city++;
    else if (parts.length === 3) counts.district++;
    else if (parts.length === 4) counts.village++;
    if (parts.length > 2 && !codes.has(parts.slice(0, -1).join(".")))
      throw new UploadValidationError(
        `Baris ${index + 1}: parent KODE tidak ditemukan.`,
      );
    if (master && !master.has(code))
      throw new UploadValidationError(
        `Baris ${index + 1}: KODE tidak ditemukan dalam master wilayah.`,
      );
    if (
      master &&
      String(row.WILAYAH).replace(/\s+/g, "").toUpperCase() !==
        master.get(code)?.replace(/\s+/g, "").toUpperCase()
    )
      throw new UploadValidationError(
        `Baris ${index + 1}: WILAYAH tidak sesuai master KODE.`,
      );
  }
  if (
    codes.size !== 182 ||
    counts.city !== 1 ||
    counts.district !== 30 ||
    counts.village !== 151
  )
    throw new UploadValidationError(
      "Komposisi harus 182 kode unik: 1 kota, 30 kecamatan, 151 kelurahan.",
    );
  return counts;
}
