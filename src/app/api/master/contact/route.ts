import { ok, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import { readServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SQL = `
  SELECT
    NIK,
    NAMA_LGKP,
    NAMA_KANTOR,
    TO_CHAR(TGL_LHR, 'DD-MM-YYYY') AS TGL_LHR,
    TMPT_LHR,
    TELP,
    ALAMAT_RUMAH
  FROM SIAK_USER_PLUS
  ORDER BY USER_LEVEL, TO_NUMBER(NO_KEC), NAMA_LGKP
`;

export async function GET(req: Request) {
  const startedAt = Date.now();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined;
  const ua = req.headers.get("user-agent") || undefined;

  const session = await readServerSession().catch(() => null);
  const user = session?.S_USER_ID || session?.NIK || undefined;

  try {
    const rows = await execRows<{
      NIK: string;
      NAMA_LGKP: string;
      NAMA_KANTOR: string;
      TGL_LHR: string | null;
      TMPT_LHR: string | null;
      TELP: string | null;
      ALAMAT_RUMAH: string | null;
    }>(SQL);

    const data = rows.map((row) => ({
      nik: row.NIK?.trim() ?? "",
      nama_lgkp: row.NAMA_LGKP?.trim() ?? "",
      nama_kantor: row.NAMA_KANTOR?.trim() ?? "",
      tgl_lhr: row.TGL_LHR?.trim() ?? null,
      tmpt_lhr: row.TMPT_LHR?.trim() ?? null,
      telp: row.TELP?.trim() ?? null,
      alamat_rumah: row.ALAMAT_RUMAH?.trim() ?? null,
    }));

    await Log.info({
      scope: "API",
      msg: "Master contact served",
      at: "/api/master/contact",
      tookMs: Date.now() - startedAt,
      user,
      ip,
      ua,
      extra: { rowCount: data.length },
    });

    const response = ok(data);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "Failed to load master contact",
      at: "/api/master/contact",
      tookMs: Date.now() - startedAt,
      user,
      ip,
      ua,
      err: {
        name: e?.name || "Error",
        message: e?.message || String(e),
        stack: e?.stack,
      },
    });

    return err("Tidak dapat memuat master contact", 500);
  }
}
