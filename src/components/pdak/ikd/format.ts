export function fmt(value: number | null | undefined, digits = 0) {
  return value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(
        value,
      );
}
export function signed(value: number | null | undefined, digits = 0) {
  return value === null || value === undefined
    ? "—"
    : (value > 0 ? "+" : "") + fmt(value, digits);
}
export function movement(value: number | null | undefined) {
  return value === null || value === undefined
    ? "N/A"
    : value > 0
      ? `↑ ${value} naik`
      : value < 0
        ? `↓ ${Math.abs(value)} turun`
        : "— Tetap";
}
