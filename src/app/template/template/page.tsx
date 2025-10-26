// FILE: src/app/template/template/page.tsx
"use client";
import { RefreshCcw } from "lucide-react";
import { useSession } from "@/contexts/session";

export default function TemplatePage() {
  const { user } = useSession();
  const total = 0;
  return (
    <div className="relative mt-5 space-y-8 px-4 pb-10 pt-6 text-gray-100 sm:px-6 md:px-8 md:pt-8">
      {/* glow kecil */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-[-15%] h-[1100px] w-[1100px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[18%] bottom-[-20%] h-[1000px] w-[1000px] rounded-full bg-fuchsia-600/12 blur-[190px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl overflow-hidden">
        {/* header lebih ringkas */}
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
            <h1 className="text-base font-semibold tracking-wide text-cyan-200">Monitoring — Template Untuk Menu Baru</h1>
            <div className="ml-auto flex items-center gap-2">
              {total > 0 ? (
                <span className="ml-auto text-xs text-cyan-200/80">
                  Total: <span className="font-semibold text-cyan-100">{total}</span> data
                </span>
              ) : null}
              <div className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
                User: {(user as any)?.S_NAMA_LGKP ?? (user as any)?.S_USER_ID ?? "-"}
              </div>
              <button
                type="button"
                onClick={()=>window.location.reload()}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {/* ======= CONTENT AREA (ISI DI SINI) ======= */}
        <div className="p-5">
          <div className="min-h-40 rounded-xl border border-dashed border-cyan-500/30 bg-white/5 grid place-items-center">
            <p className="text-sm text-cyan-200/80">
              Konten <span className="font-semibold">Template</span> ditaruh di sini…
            </p>
          </div>
        </div>
        {/* ======= /CONTENT AREA ======= */}
      </section>
    </div>
  );
}
