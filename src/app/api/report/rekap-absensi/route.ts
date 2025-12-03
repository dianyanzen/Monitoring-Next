// FILE: src/app/api/report/rekap-absensi/route.ts
import { NextResponse } from "next/server";

type RekapAbsensiItem = {
  id: number;
  userId: string;
  tanggal: string; // YYYY-MM-DD
  jamMasuk: string;
  jamKeluar: string;
  ip: string;
  sumber: string;
  keterangan: string;
};

// Contoh data sementara (gantikan dengan query DB/endpoint baru)
const sample: RekapAbsensiItem[] = [
  {
    id: 101,
    userId: "assist_yz",
    tanggal: "2025-12-03",
    jamMasuk: "07:25",
    jamKeluar: "16:45",
    ip: "172.16.16.213",
    sumber: "Monitoring",
    keterangan: "Tepat Waktu",
  },
  {
    id: 102,
    userId: "assist_yz",
    tanggal: "2025-12-02",
    jamMasuk: "08:02",
    jamKeluar: "17:05",
    ip: "172.16.16.213",
    sumber: "Monitoring",
    keterangan: "Terlambat",
  },
  {
    id: 103,
    userId: "dian_septian",
    tanggal: "2025-12-03",
    jamMasuk: "07:15",
    jamKeluar: "16:05",
    ip: "172.16.16.25",
    sumber: "Attendance Machine",
    keterangan: "Tepat Waktu",
  },
];

function inRange(dateStr: string, start?: string, end?: string) {
  if (!start && !end) return true;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return false;
  if (start && t < new Date(start).getTime()) return false;
  if (end && t > new Date(end).getTime()) return false;
  return true;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { start, end, userId } = body || {};

  const filtered = sample.filter(
    (row) => inRange(row.tanggal, start, end) && (!userId || row.userId === userId)
  );

  return NextResponse.json({
    data: filtered,
    recordsTotal: sample.length,
    recordsFiltered: filtered.length,
  });
}
