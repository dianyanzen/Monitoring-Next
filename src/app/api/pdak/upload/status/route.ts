import { err, ok } from "@/lib/http";
import { authorize, noStore } from "@/lib/pdak/request";
import { getPdakEntryDate } from "@/lib/pdak/date";
import { uploadStatus } from "@/lib/pdak/uploadRepository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const auth = await authorize();
    if (auth.response) return noStore(auth.response);
    const date = getPdakEntryDate();
    return noStore(
      ok({
        date,
        timeZone: "Asia/Jakarta",
        serverTime: new Date().toISOString(),
        items: await uploadStatus(date),
      }),
    );
  } catch {
    return noStore(
      err(
        "Status tidak dapat dimuat. Periksa koneksi dan metadata PDAK pada database MONALISA.",
        503,
      ),
    );
  }
}
