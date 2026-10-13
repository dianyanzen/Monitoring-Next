// FILE: src/app/api/report/rekap-absensi/route.ts
import { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";
const AT = "/api/report/rekap-absensi";

type AbsensiRow = {
  USER_ID: string;
  NAMA: string;
  TANGGAL_ISO: string;
  TANGGAL_DMY: string;
  JAM_MASUK: string;
  JAM_KELUAR: string;
  IP_ADDRESS: string;
  CI_FROM: string;
  KETERANGAN: string;
  RN: number;
};

const toStr = (v: unknown) => (v == null ? "" : String(v).trim());

function normalizeDate(raw: unknown) {
  const value = toStr(raw);
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value; // ISO
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split("-");
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

const isoToDMY = (iso?: string) => {
  if (!iso || iso.split("-").length !== 3) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

export async function POST(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();

  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const startIso = normalizeDate(body.start || body.start_date || body.startDate) || isoMonthStart();
    const endIso = normalizeDate(body.end || body.end_date || body.endDate) || isoToday();
    const userId = toStr(body.userId) || toStr(session.S_USER_ID);

    if (startIso && endIso) {
      const start = new Date(startIso);
      const end = new Date(endIso);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        return badRequest("Rentang tanggal tidak valid");
      }
    }

    const binds: Record<string, string> = { b_user_id: userId };
    const filters: string[] = ["A.USER_ID = :b_user_id"];

    if (startIso) {
      binds.b_start = startIso;
      filters.push("A.TANGGAL >= TO_DATE(:b_start, 'YYYY-MM-DD')");
    }
    if (endIso) {
      binds.b_end = endIso;
      filters.push("A.TANGGAL < TO_DATE(:b_end, 'YYYY-MM-DD') + 1");
    }

    const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const rows = await execRows<AbsensiRow>(
      `
      SELECT
        ROW_NUMBER() OVER (ORDER BY A.TANGGAL DESC, NVL(A.JAM_MASUK, '00:00') DESC) AS RN,
        A.USER_ID,
        NVL(A.NAMA, '-') AS NAMA,
        TO_CHAR(A.TANGGAL, 'YYYY-MM-DD') AS TANGGAL_ISO,
        TO_CHAR(A.TANGGAL, 'DD-MM-YYYY') AS TANGGAL_DMY,
        NVL(A.JAM_MASUK, '-') AS JAM_MASUK,
        NVL(A.JAM_KELUAR, '-') AS JAM_KELUAR,
        NVL(A.IP_ADDRESS, '-') AS IP_ADDRESS,
        NVL(A.CI_FROM, 'MONITORING') AS CI_FROM,
        NVL(A.KETERANGAN, '-') AS KETERANGAN
      FROM SIAK_ABSENSI A
      ${whereSql}
      ORDER BY A.TANGGAL DESC, NVL(A.JAM_MASUK, '00:00') DESC
      `,
      binds,
      {},
      ORACLE_ALIAS
    );

    const items = rows.map((row) => {
      const tanggalIso = toStr(row.TANGGAL_ISO);
      return {
        id: Number(row.RN ?? 0),
        userId: toStr(row.USER_ID),
        nama: toStr(row.NAMA),
        tanggal: tanggalIso,
        tanggalLabel: toStr(row.TANGGAL_DMY) || isoToDMY(tanggalIso),
        jamMasuk: toStr(row.JAM_MASUK) || "-",
        jamKeluar: toStr(row.JAM_KELUAR) || "-",
        ip: toStr(row.IP_ADDRESS) || "-",
        sumber: toStr(row.CI_FROM) || "Monitoring",
        keterangan: toStr(row.KETERANGAN) || "-",
      };
    });

    await Log.info({
      scope: "API",
      msg: "rekap-absensi/list",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { startIso, endIso, count: items.length },
    });

    return ok({
      items,
      recordsTotal: items.length,
      recordsFiltered: items.length,
    });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "rekap-absensi/list_err",
      at: AT,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal memuat rekap absensi");
  }
}
