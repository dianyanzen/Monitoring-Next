export class InventoryError extends Error {}
export function text(
  value: unknown,
  label: string,
  max: number,
  required = true,
) {
  const s = String(value ?? "").trim();
  if (
    (required && !s) ||
    new TextEncoder().encode(s).length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)
  )
    throw new InventoryError(
      `${label} ${required ? "wajib diisi dan " : ""}maksimal ${max} byte.`,
    );
  return s;
}
export function number(
  value: unknown,
  label: string,
  positive = true,
  integer = false,
) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    String(value).trim() === ""
  )
    throw new InventoryError(`${label} wajib diisi.`);
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    (positive ? n <= 0 : n < 0) ||
    (integer && !Number.isSafeInteger(n)) ||
    n > 999999999999
  )
    throw new InventoryError(
      `${label} harus berupa angka ${positive ? "positif" : "tidak negatif"}${integer ? " bulat" : ""}.`,
    );
  return n;
}
export function range(body: Record<string, unknown>) {
  let start = String(body.start ?? "").trim(),
    end = String(body.end ?? "").trim();
  if (!start && !end) {
    const raw = String(body.tanggal ?? body.range ?? "");
    const m = raw.match(
      /^\s*(\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2})\s+(?:-|–|s\/d)\s+(\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2})\s*$/,
    );
    if (m) {
      start = m[1];
      end = m[2];
    }
  }
  const iso = (s: string) => {
    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
      const [d, m, y] = s.split("-");
      s = `${y}-${m}-${d}`;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s.startsWith("0000"))
      throw new InventoryError(
        "Tanggal harus valid (YYYY-MM-DD atau DD-MM-YYYY).",
      );
    const d = new Date(s + "T00:00:00Z");
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== s)
      throw new InventoryError("Tanggal tidak valid.");
    return s;
  };
  start = iso(start);
  end = iso(end);
  if (start > end)
    throw new InventoryError(
      "Tanggal awal harus sebelum atau sama dengan tanggal akhir.",
    );
  return { start, end };
}
export function stockDelta(
  kind: "masuk" | "keluar",
  action: string,
  oldAmount: number,
  newAmount: number,
) {
  const sign = kind === "masuk" ? 1 : -1;
  return (
    sign *
    (action === "delete"
      ? -oldAmount
      : action === "update"
        ? newAmount - oldAmount
        : newAmount)
  );
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
