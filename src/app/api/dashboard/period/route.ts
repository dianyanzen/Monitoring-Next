// FILE: /app/api/dashboard/period/route.ts
import { execOneText } from "@/lib/db";
import { ok, err } from "@/lib/http";

function fmtID(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export async function GET() {
  try {
    // Ambil tanggal cutoff dari master
    const cutoffTxt = (await execOneText(
      `
        SELECT SYSTEM_VALUE_TXT AS VAL
        FROM SIAK_MASTER
        WHERE SYSTEM_CODE = 'DKB_CUTOFF'
      `
    )) || "01/01/2025"; // fallback aman

    // Parsing string dd/mm/yyyy ke Date UTC
    const [dd, mm, yyyy] = cutoffTxt.split("/");
    const cutoff = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
    const today = new Date();

    // Format output "Periode 1 Januari 2025 - 8 Oktober 2025"
    const periode = `Periode ${fmtID(cutoff)} - ${fmtID(today)}`;

    return ok({ periode });
  } catch (e) {
    console.error("❌ /api/dashboard/period error:", e);
    return err("DB error period");
  }
}
