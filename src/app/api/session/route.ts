// File: app/api/session/route.ts
import { NextResponse } from "next/server";
import { readServerSession } from "@/lib/session"; // ✅ verifikasi HMAC + required fields

export async function GET() {
  const s = await readServerSession();
  if (!s) {
    return NextResponse.json(
      { ok: false, message: "Tidak ada sesi. Silakan login kembali." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Optional: redaksi data yang aman untuk client
  const safeUser = {
    S_USER_ID: s.S_USER_ID,
    S_SESSION_ID: s.S_SESSION_ID, // kalau mau sembunyikan, hapus field ini
    S_NIK: s.S_NIK,
    S_NAMA_LGKP: s.S_NAMA_LGKP ?? null,
    S_NAMA_KANTOR: s.S_NAMA_KANTOR ?? null,
    S_USER_LEVEL: s.S_USER_LEVEL ?? null,
    S_TELP: s.S_TELP ?? null,
    S_JENIS_KLMIN: s.S_JENIS_KLMIN ?? null,
    S_TGL_LHR: s.S_TGL_LHR ?? null,
  };

  return NextResponse.json(
    { ok: true, user: safeUser },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
