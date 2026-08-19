import type { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { ESPASI_DB_ALIAS, ensureSession } from "@/lib/espasi/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const auth = await ensureSession();
  if (auth.error) return auth.error;

  return ok({
    source: "LOCAL_DB_SMSDISDUK",
    dbAlias: ESPASI_DB_ALIAS,
    endpoints: [
      "/api/espasi/video",
      "/api/espasi/config",
      "/api/espasi/dashboard",
      "/api/espasi/disduk-sms-antrian/{1|2|3|4}",
      "/api/espasi/loket?mode=aktif|terlewat|sudah",
      "/api/espasi/loket/update",
      "/api/espasi/antrian?mode=aktif|log|masuk|keluar|telepon",
      "/api/espasi/cass",
      "/api/espasi/pengaturan/loket",
      "/api/espasi/[legacy routes]",
      "/api/espasi/antrian-loket",
      "/api/espasi/antrian-loket-terlewat",
      "/api/espasi/antrian-loket-sudah",
      "/api/espasi/antrian-loket-menunggu",
      "/api/espasi/antrian-loket-update",
      "/api/espasi/antrian-loket-update2",
      "/api/espasi/sms-antrian",
      "/api/espasi/sms-antrian/{nik}",
      "/api/espasi/sms-antrian-log",
      "/api/espasi/hist-antrian",
      "/api/espasi/sms-antrian-masuk",
      "/api/espasi/sms-antrian-keluar",
      "/api/espasi/telepon",
      "/api/espasi/telepon/{telepon}",
      "/api/espasi/cass-lahir",
      "/api/espasi/kode-loket",
      "/api/espasi/setting-loket",
      "/api/espasi/data-loket",
      "/api/espasi/hitungDetik",
      "/api/espasi/data-kuota-antrian",
      "/api/espasi/inbox",
      "/api/espasi/cek-pesan/{modem}",
      "/api/espasi/sms-antrian-1",
      "/api/espasi/sms-antrian-2",
      "/api/espasi/sms-antrian-3",
      "/api/espasi/sms-antrian-4",
      "/api/espasi/e-spasi",
      "/api/espasi/e-spasi2",
      "/api/espasi/e-spasi-all-in-one",
      "/api/espasi/salaman-e-spasi",
      "/api/espasi/dev-e-spasi",
    ],
  });
}
