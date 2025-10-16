// FILE: src/app/template/page.tsx
"use client";

export default function TemplatePage() {
  return (
    <div className="relative px-8 pb-8 pt-6 md:pt-8 text-gray-200 space-y-8 mt-5">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-15%] left-[15%] w-[1100px] h-[1100px] bg-cyan-500/15 blur-[220px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[18%] w-[1000px] h-[1000px] bg-fuchsia-600/12 blur-[190px] rounded-full" />
      </div>

      <section className="rounded-2xl border border-cyan-800/40 bg-[#0b0b1a]/80 backdrop-blur-xl shadow-[0_0_34px_#00ffff22] overflow-hidden">
        <header className="px-5 py-4 border-b border-cyan-900/50">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
            <h1 className="text-base font-semibold tracking-wide text-cyan-200">
              Template
            </h1>
            <div className="ml-auto h-[2px] w-48 bg-gradient-to-r from-cyan-400 via-pink-400 to-transparent opacity-70" />
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
