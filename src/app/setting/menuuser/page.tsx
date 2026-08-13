"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Pencil, RefreshCcw, Shield, Layers3 } from "lucide-react";
import NeonModal from "@/components/ui/NeonModal";
import TypeableSelect from "@/components/ui/TypeableSelect";

type Row = {
  menu_id: number;
  parent_id: number | null;
  parent_title: string;
  title: string;
  menu_level: number;
  level_head: number;
  level_sub: number;
};

export default function SettingMenuUserPage() {
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState("0");
  const [modal, setModal] = useState<{ open: boolean; title: string; message: string; kind: any } | null>(
    null
  );

  useEffect(() => {
    void fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchRows(targetLevel?: string) {
    try {
      setLoading(true);
      setError(null);
      const level = targetLevel ?? filterLevel;
      const qs = level && level !== "0" ? `?group_id=${encodeURIComponent(level)}` : "";
      const res = await fetch(`/api/setting/menuuser${qs}`, { cache: "no-store", credentials: "include" });
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(text || "Gagal memuat menu (respon tidak valid)");
      }
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat menu");
      const list: Row[] = Array.isArray(json?.data?.rows) ? json.data.rows : [];
      setRows(list);
    } catch (e: any) {
      setRows([]);
      setError(e?.message || "Gagal memuat menu user");
    } finally {
      setLoading(false);
    }
  }

  const bodyState = useMemo(() => {
    if (loading) {
      return (
        <tr>
          <td colSpan={8} className="px-4 py-8 text-center text-cyan-100/70">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            <p className="mt-2 text-xs">Memuat menu...</p>
          </td>
        </tr>
      );
    }
    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={8} className="px-4 py-6 text-center text-cyan-100/70">
            {error ?? "Belum ada menu ditemukan untuk filter ini."}
          </td>
        </tr>
      );
    }
    return rows.map((row, idx) => (
      <tr key={row.menu_id} className="hover:bg-cyan-500/5">
        <td className="px-4 py-3 text-sm text-cyan-100/80">{idx + 1}</td>
        <td className="px-4 py-3 text-cyan-50">{row.menu_id}</td>
        <td className="px-4 py-3 text-cyan-100/80">{row.parent_title}</td>
        <td className="px-4 py-3 text-cyan-50">{row.title}</td>
        <td className="px-4 py-3 text-cyan-100/80 text-center">{row.menu_level}</td>
        <td className="px-4 py-3 text-cyan-100/80 text-center">{row.level_head}</td>
        <td className="px-4 py-3 text-cyan-100/80 text-center">{row.level_sub}</td>
        <td className="px-4 py-3 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/40 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-400/15 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              onClick={() => router.push(`/setting/menuuser/lihat/${row.menu_id}`)}
            >
              <Eye className="h-3.5 w-3.5" />
              Lihat
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-500/15 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              onClick={() => router.push(`/setting/menuuser/edit/${row.menu_id}`)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          </div>
        </td>
      </tr>
    ));
  }, [error, loading, rows, router]);

  const filtersDirty = filterLevel !== "0";

  function handleReset() {
    if (!filtersDirty) return;
    setFilterLevel("0");
    void fetchRows("0");
  }

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[8%] top-[-25%] h-[900px] w-[900px] rounded-full bg-cyan-500/20 blur-[220px]" />
        <div className="absolute right-[12%] bottom-[-30%] h-[900px] w-[900px] rounded-full bg-fuchsia-600/15 blur-[220px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              <div>
                <h1 className="text-base font-semibold tracking-wide text-cyan-200">
                  Setting User Menu
                </h1>
                <p className="text-xs text-cyan-200/70">Mengelola struktur menu berdasarkan level user.</p>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="hidden sm:inline-flex items-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
                <Layers3 className="mr-1 h-3.5 w-3.5" />
                Level {filterLevel === "0" ? "Semua" : filterLevel}
              </div>
              <button
                type="button"
                onClick={() => void fetchRows()}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                Refresh
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-6 px-5 py-6">
          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
            <div className="flex flex-wrap items-start gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.4em] text-cyan-400/60">
                  Filter
                </p>
                <h2 className="text-sm font-semibold text-cyan-100">Filter Menu</h2>
                <p className="text-xs text-cyan-200/70">Pilih level menu untuk memperkecil hasil.</p>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={!filtersDirty || loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-800/60 bg-white/5 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => void fetchRows()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                  Terapkan
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,2fr)] md:items-end">
              <label className="flex flex-col text-sm text-cyan-100/90">
                <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200/80">
                  Level Menu
                </span>
                <TypeableSelect
                  value={filterLevel}
                  onChange={(e) => {
                    setFilterLevel(e.target.value);
                    void fetchRows(e.target.value);
                  }}
                  className="field-input mt-1"
                  disabled={loading}
                >
                  <option value="0">-- Semua Level --</option>
                  <option value="1">Level 1</option>
                  <option value="2">Level 2</option>
                  <option value="3">Level 3</option>
                </TypeableSelect>
              </label>
            </div>

            {error ? <p className="mt-3 text-sm text-rose-300/90">{error}</p> : null}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-cyan-900/40 bg-[#04060b]/60">
            <table className="min-w-full divide-y divide-cyan-900/50 text-sm">
              <thead className="bg-cyan-950/40 text-xs uppercase tracking-wide text-cyan-200/60">
                <tr>
                  <th className="px-4 py-3 text-left">No</th>
                  <th className="px-4 py-3 text-left">Menu ID</th>
                  <th className="px-4 py-3 text-left">Parent</th>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-center">Level</th>
                  <th className="px-4 py-3 text-center">Head</th>
                  <th className="px-4 py-3 text-center">Sub</th>
                  <th className="px-4 py-3 text-center">Operasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-900/30">{bodyState}</tbody>
            </table>
          </div>
        </div>
      </section>

      {modal && (
        <NeonModal
          open={modal.open}
          kind={modal.kind}
          title={modal.title}
          message={modal.message}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

