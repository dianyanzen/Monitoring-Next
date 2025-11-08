// FILE: src/app/dummy/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

type FingerOut = { name: string; png: string | null; error?: string };
type Payload = { mime: string; fingers: FingerOut[] };
type ApiEnvelope<T> = { success: boolean; message: string; data: T };

export default function DummyFingersPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [nik, setNik] = useState("");

  const load = useCallback(async (n?: string) => {
    setLoading(true);
    setErrMsg(null);
    try {
      const qs = n ? `?nik=${encodeURIComponent(n)}` : "";
      const res = await fetch(`/api/dummy${qs}`, { cache: "no-store" });
      const json: ApiEnvelope<Payload> = await res.json();
      setData(json?.data ?? null);
      if (!json?.success) setErrMsg(json?.message || "Gagal memuat data");
    } catch (e: any) {
      setErrMsg(e?.message || "Gagal memuat data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const mime = data?.mime || "image/png";

  return (
    <main className="p-6 md:p-10">
      <header className="mb-5 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-bold">Dummy — 10 Fingers (WSQ → PNG)</h1>
          <p className="text-sm opacity-70">Menarik 10 sidik jari dari baris terbaru atau NIK tertentu.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={nik}
            onChange={(e) => setNik(e.target.value.replace(/\D/g, "").slice(0, 16))}
            placeholder="NIK (opsional)"
            className="w-48 rounded-lg border border-gray-400/40 bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <button
            onClick={() => load(nik || undefined)}
            disabled={loading}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
          >
            {loading ? "Memuat…" : "Muat ulang"}
          </button>
        </div>
      </header>

      {errMsg && (
        <div className="mb-4 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {errMsg}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {(data?.fingers ?? []).map((f) => (
            <figure
              key={f.name}
              className="overflow-hidden rounded-xl border border-white/10 bg-black/30"
            >
              <figcaption className="border-b border-white/10 px-3 py-2 text-center text-xs font-semibold text-white/70 uppercase">
                {f.name.replaceAll("_", " ")}
              </figcaption>

              {/* kotak gambar dengan rasio lebih tinggi (≈ 3 : 4.35) */}
              <div className="relative w-full pb-[145%]"> 
                <div className="absolute inset-0 p-3">
                  {f.png ? (
                    <img
                      alt={f.name}
                      src={`data:${mime};base64,${f.png}`}
                      className="h-full w-full rounded-md object-contain bg-white"
                      draggable={false}
                    />
                  ) : f.error ? (
                    <span className="flex h-full items-center justify-center px-2 text-center text-[11px] text-amber-200">
                      No data / {f.error}
                    </span>
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs text-white/50">
                      Tidak ada data
                    </span>
                  )}
                </div>
              </div>
            </figure>
        ))}
      </div>
    </main>
  );
}
