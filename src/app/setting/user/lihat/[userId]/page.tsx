// FILE: src/app/setting/user/lihat/[userId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, UserCircle2, MapPin, Shield, RefreshCcw } from "lucide-react";
import { useSession } from "@/contexts/session";

/* ========= Types ========= */
type DetailResponse = {
  user_id: string;
  nama_lgkp: string;
  nama_dpn: string | null;
  nik: string;
  tmpt_lhr: string | null;
  tgl_lhr: string | null;
  jenis_klmin: number | null;
  gol_drh: number | null;
  nama_kantor: string | null;
  alamat_kantor: string | null;
  telp: string | null;
  alamat_rumah: string | null;
  user_level: string;
  level_name: string;
  group_name: string | null;
  wilayah: {
    no_prop: string | null;
    no_kab: string | null;
    no_kec: string | null;
    no_kel: string | null;
    no_rw: string | null;
    no_rt: string | null;
    nama_prop: string | null;
    nama_kab: string | null;
    nama_kec: string | null;
    nama_kel: string | null;
  };
  akun: {
    user_siak: string | null;
    user_bcard: string | null;
    user_benrol: string | null;
  };
  flags: {
    is_monitoring: boolean;
    is_gisa: boolean;
    is_absen: boolean;
    is_asn: boolean;
    absensi_checking: boolean;
    is_active: boolean;
    ipaddress_check: boolean;
    is_show: boolean;
  };
  supervisors: {
    pejabat_satu: string | null;
    pejabat_dua: string | null;
    nama_satu?: string | null;
    nama_dua?: string | null;
  };
};

/* ========= Helpers ========= */
const bloodLabelMap: Record<number, string> = {
  1: "A",
  2: "B",
  3: "AB",
  4: "O",
  5: "A+",
  6: "A-",
  7: "B+",
  8: "B-",
  9: "AB+",
  10: "AB-",
  11: "O+",
  12: "O-",
  13: "Tidak Tahu",
};

const formatGender = (code?: number | null) => {
  if (code === 1) return "Laki-laki";
  if (code === 2) return "Perempuan";
  return "-";
};

const formatBlood = (code?: number | null) => {
  if (code == null) return "-";
  return bloodLabelMap[code] ?? String(code);
};

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-cyan-900/40 bg-[#03050a]/60 p-3">
      <p className="text-[11px] uppercase tracking-wide text-cyan-200/60">{label}</p>
      <p className="text-sm font-semibold text-cyan-50">{value ?? "-"}</p>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
      {title ? (
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-cyan-200/90">
          {icon}
          <span>{title}</span>
        </div>
      ) : null}
      {children}
    </section>
  );
}

/* ========= Page ========= */
export default function SettingUserDetailPage() {
  const router = useRouter();
  const { user } = useSession();
  const params = useParams<{ userId: string }>();
  const userId = params?.userId ?? "";

  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchDetail() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/setting/users/${encodeURIComponent(userId)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat detail user");
      setData(json?.data ?? null);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat detail user");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userId) {
      void fetchDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
     <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[8%] top-[-25%] h-[900px] w-[900px] rounded-full bg-cyan-500/20 blur-[220px]" />
        <div className="absolute right-[12%] bottom-[-30%] h-[900px] w-[900px] rounded-full bg-fuchsia-600/15 blur-[220px]" />
      </div>

      {/* Card utama + header konsisten */}
      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/85 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-cyan-900/50 px-5 py-4">
          <button
            type="button"
            data-overlay-on-click
            onClick={() => router.push("/setting/user")}
            className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/40 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-400/80">
              Setting — User
            </p>
            <h1 className="text-base font-semibold text-cyan-100">Detail User {userId || ""}</h1>
            <p className="text-xs text-cyan-100/80">
              Ringkasan lengkap identitas, wilayah, akun aplikasi, status, dan pejabat pembina untuk user terpilih.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-200/80">
            <span className="rounded-full border border-cyan-500/30 bg-[#020617]/70 px-3 py-1">
              Viewer: {(user as any)?.S_NAMA_LGKP ?? (user as any)?.S_USER_ID ?? "-"}
            </span>
            <button
              type="button"
              onClick={() => void fetchDetail()}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </header>

        <div className="space-y-6 px-5 py-6">
          {loading ? (
            <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 px-6 py-12 text-center text-cyan-200/80">
              <div className="inline-flex items-center gap-2 text-sm">
                <Loader2 className="h-5 w-5 animate-spin" />
                Memuat detail user...
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/5 px-6 py-8 text-center text-sm text-rose-100">
              {error}
            </div>
          ) : !data ? (
            <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 px-6 py-10 text-center text-sm text-cyan-200/80">
              Data user tidak ditemukan.
            </div>
          ) : (
            <>
              {/* Identitas + Level & Group */}
              <SectionCard>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-3">
                      <UserCircle2 className="h-8 w-8 text-cyan-200" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.4em] text-cyan-400/60">
                        Detail User Data
                      </p>
                      <h2 className="text-lg font-semibold text-cyan-50">{data.nama_lgkp}</h2>
                      <p className="text-sm text-cyan-200/80">ID: {data.user_id}</p>
                    </div>
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                      Level User: {data.user_level} — {data.level_name}
                    </span>
                    {data.group_name ? (
                      <span className="rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold text-fuchsia-100">
                        Group User: {data.group_name}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <InfoField label="Nama Lengkap" value={data.nama_lgkp} />
                  <InfoField label="Nama Depan" value={data.nama_dpn} />
                  <InfoField label="NIK" value={data.nik} />
                  <InfoField label="Tempat Lahir" value={data.tmpt_lhr} />
                  <InfoField label="Tanggal Lahir" value={data.tgl_lhr} />
                  <InfoField label="Jenis Kelamin" value={formatGender(data.jenis_klmin)} />
                  <InfoField label="Golongan Darah" value={formatBlood(data.gol_drh)} />
                </div>
              </SectionCard>

              {/* Wilayah + Informasi Kantor */}
              <div className="grid gap-5 lg:grid-cols-2">
                <SectionCard title="Informasi Kantor & Kontak" icon={<Shield className="h-4 w-4" />}>
                  <div className="grid gap-3">
                    <InfoField label="Nama Kantor" value={data.nama_kantor} />
                    <InfoField label="Alamat Kantor" value={data.alamat_kantor} />
                    <InfoField label="Nomor Telepon" value={data.telp} />
                    <InfoField label="Alamat Rumah" value={data.alamat_rumah} />
                  </div>
                </SectionCard>

                <SectionCard title="Wilayah User" icon={<MapPin className="h-4 w-4" />}>
                  <div className="grid gap-3">
                    <InfoField
                      label="Provinsi"
                      value={
                        data.wilayah.no_prop || data.wilayah.nama_prop
                          ? `(${data.wilayah.no_prop ?? "-"}) ${data.wilayah.nama_prop ?? "-"}`
                          : "-"
                      }
                    />
                    <InfoField
                      label="Kabupaten/Kota"
                      value={
                        data.wilayah.no_kab || data.wilayah.nama_kab
                          ? `(${data.wilayah.no_kab ?? "-"}) ${data.wilayah.nama_kab ?? "-"}`
                          : "-"
                      }
                    />
                    <InfoField
                      label="Kecamatan"
                      value={
                        data.wilayah.no_kec || data.wilayah.nama_kec
                          ? `(${data.wilayah.no_kec ?? "-"}) ${data.wilayah.nama_kec ?? "-"}`
                          : "-"
                      }
                    />
                    <InfoField
                      label="Kelurahan"
                      value={
                        data.wilayah.no_kel || data.wilayah.nama_kel
                          ? `(${data.wilayah.no_kel ?? "-"}) ${data.wilayah.nama_kel ?? "-"}`
                          : "-"
                      }
                    />
                    <InfoField
                      label="RW / RT"
                      value={`${data.wilayah.no_rw ?? "-"} / ${data.wilayah.no_rt ?? "-"}`}
                    />
                  </div>
                </SectionCard>
              </div>

              {/* Akun aplikasi */}
              <SectionCard title="Akun User" icon={<Shield className="h-4 w-4" />}>
                <div className="grid gap-4 md:grid-cols-3">
                  <InfoField label="Akun SIAK" value={data.akun.user_siak} />
                  <InfoField label="Akun Biomorf Card Management" value={data.akun.user_bcard} />
                  <InfoField label="Akun Biomorf Enrolment" value={data.akun.user_benrol} />
                </div>
              </SectionCard>

              {/* Status & flag */}
              <SectionCard title="Akun Setting & Status" icon={<Shield className="h-4 w-4" />}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Object.entries(data.flags).map(([key, value]) => (
                    <div
                      key={key}
                      className={`rounded-xl border px-4 py-3 text-xs font-semibold ${
                        value
                          ? "border-emerald-400/40 bg-emerald-500/5 text-emerald-100"
                          : "border-rose-400/40 bg-rose-500/5 text-rose-100"
                      }`}
                    >
                      {key.replace(/_/g, " ").toUpperCase()}: {value ? "YA" : "TIDAK"}
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Atasan */}
              <SectionCard title="Atasan Setting" icon={<Shield className="h-4 w-4" />}>
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoField
                    label="Atasan Satu"
                    value={data.supervisors.nama_satu ?? data.supervisors.pejabat_satu ?? "-"}
                  />
                  <InfoField
                    label="Atasan Dua"
                    value={data.supervisors.nama_dua ?? data.supervisors.pejabat_dua ?? "-"}
                  />
                </div>
              </SectionCard>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
