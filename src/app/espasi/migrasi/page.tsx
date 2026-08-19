import Link from "next/link";
import { ArrowRight, CheckCircle2, Info } from "lucide-react";

const ROUTES = [
  { oldPath: "/dashboard", newPath: "/espasi/dashboard", label: "Dashboard Utama", status: "Sudah dipindah" },
  { oldPath: "/dashboard-fcl", newPath: "/espasi/dashboard-fcl", label: "Dashboard FCL", status: "Sudah dipindah" },
  { oldPath: "/dashboard-btc", newPath: "/espasi/dashboard-btc", label: "Dashboard BTC", status: "Sudah dipindah" },
  { oldPath: "/dashboard-mim", newPath: "/espasi/dashboard-mim", label: "Dashboard MIM", status: "Sudah dipindah" },
  { oldPath: "/dashboard-dprd", newPath: "/espasi/dashboard-dprd", label: "Dashboard DPRD", status: "Sudah dipindah" },
  { oldPath: "/loket", newPath: "/espasi/loket", label: "Pemanggilan Loket", status: "Sudah dipindah" },
  { oldPath: "/loket-terlewat", newPath: "/espasi/loket-terlewat", label: "Loket Terlewat", status: "Sudah dipindah" },
  { oldPath: "/sms-antrian", newPath: "/espasi/sms-antrian", label: "SMS Antrian", status: "Sudah dipindah" },
  { oldPath: "/sms-antrian-log", newPath: "/espasi/sms-antrian-log", label: "Log SMS Antrian", status: "Sudah dipindah" },
  { oldPath: "/sms-antrian-masuk", newPath: "/espasi/sms-antrian-masuk", label: "Kotak Masuk", status: "Sudah dipindah" },
  { oldPath: "/sms-antrian-keluar", newPath: "/espasi/sms-antrian-keluar", label: "Kotak Keluar", status: "Sudah dipindah" },
  { oldPath: "/telepon", newPath: "/espasi/telepon", label: "Status Telepon", status: "Sudah dipindah" },
  { oldPath: "/cass", newPath: "/espasi/cass", label: "Capil Cass", status: "Sudah dipindah" },
  { oldPath: "/konfigurasi", newPath: "/espasi/konfigurasi", label: "Konfigurasi Antrian", status: "Sudah dipindah" },
  { oldPath: "/user", newPath: "/espasi/user", label: "Pengguna", status: "Sudah dipindah" },
  { oldPath: "/roles", newPath: "/espasi/roles", label: "Roles", status: "Sudah dipindah" },
  { oldPath: "/permissions", newPath: "/espasi/permissions", label: "Permissions", status: "Sudah dipindah" },
  { oldPath: "/dashboard-sms", newPath: "/espasi/dashboard-sms", label: "Dashboard SMS Antrian", status: "Sudah dipindah" },
];

export default function EspasiMigrationPage() {
  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[10%] top-[-15%] h-[900px] w-[900px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[10%] bottom-[-20%] h-[900px] w-[900px] rounded-full bg-fuchsia-600/12 blur-[200px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              <Info className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-base font-semibold tracking-wide text-cyan-200">Peta Migrasi e-SPASI</h1>
              <p className="text-xs text-cyan-200/70">
                Halaman ini menunjukkan alamat lama e-SPASI dan tujuan barunya di Next.js.
              </p>
            </div>
            <Link
              href="/espasi"
              className="ml-auto inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
            >
              Kembali ke menu Espasi
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <div className="space-y-4 px-5 py-6">
          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5 text-sm leading-6 text-cyan-100/75">
            Intinya sederhana: alamat lama masih bisa dipakai, tetapi isinya sudah diarahkan ke halaman Next.js yang baru. Jadi user tidak perlu pindah kebiasaan sekaligus.
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ROUTES.map((item) => (
              <div key={item.oldPath} className="rounded-2xl border border-cyan-800/40 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-400/70">{item.status}</div>
                <h3 className="mt-2 text-lg font-semibold text-cyan-50">{item.label}</h3>
                <div className="mt-3 space-y-2 text-sm text-cyan-100/75">
                  <div>
                    <span className="font-semibold text-cyan-200">Alamat lama:</span> {item.oldPath}
                  </div>
                  <div>
                    <span className="font-semibold text-cyan-200">Tujuan baru:</span>{" "}
                    <Link href={item.newPath} className="text-cyan-300 hover:text-cyan-200">
                      {item.newPath}
                    </Link>
                  </div>
                </div>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Bisa dibuka di Next.js
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
