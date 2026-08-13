"use client";

import TypeableSelect from "@/components/ui/TypeableSelect";
// FILE: src/app/setting/userlevel/page.tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Eye, Pencil, Trash2, Users, RefreshCcw, KeyRound  } from "lucide-react";
import { useSession } from "@/contexts/session";

type GroupItem = { level_code: string; level_name: string };
type UserLevelRow = {
  user_level: string;   // kode level sebenarnya (USER_LEVEL)
  level_name: string;
  group_name: string;
  level_code: string;   // kode grup (LEVEL_CODE)
};

export default function UserLevelPage() {
  const router = useRouter();
  const { user } = useSession();

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [groupId, setGroupId] = useState<string>("0");

  const [rows, setRows] = useState<UserLevelRow[]>([]);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [loadingTable, setLoadingTable] = useState(false);
  const [errGroup, setErrGroup] = useState<string | null>(null);
  const [errTable, setErrTable] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingGroup(true);
      setErrGroup(null);
      try {
        const res = await fetch("/api/setting/get_group", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
        const list: GroupItem[] = json?.data ?? [];
        if (!cancelled) {
          setGroups(list);
          setGroupId("0");
        }
      } catch (e: any) {
        if (!cancelled) setErrGroup(e?.message || "Gagal memuat group");
      } finally {
        if (!cancelled) setLoadingGroup(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (groupId === "0") {
      setRows([]);
      return;
    }
    (async () => {
      setLoadingTable(true);
      setErrTable(null);
      try {
        const res = await fetch("/api/setting/get_user_level", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group_id: groupId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
        const list: UserLevelRow[] = json?.data ?? [];
        if (!cancelled) setRows(list);
      } catch (e: any) {
        if (!cancelled) {
          setRows([]);
          setErrTable(e?.message || "Gagal memuat daftar level");
        }
      } finally {
        if (!cancelled) setLoadingTable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const currentGroupName = useMemo(() => {
    if (groupId === "0") return "";
    const f = groups.find((g) => g.level_code === groupId);
    return f?.level_name ?? "";
  }, [groupId, groups]);

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      {/* ambient glow seperti halaman KTP-el */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-[-15%] h-[1100px] w-[1100px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[18%] bottom-[-20%] h-[1000px] w-[1000px] rounded-full bg-fuchsia-600/12 blur-[190px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        {/* HEADER — diseragamkan dengan style KTP-el */}
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
                <h1 className="text-base font-semibold tracking-wide text-cyan-200">Manajemen User Level</h1>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden sm:inline-block rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
                User: {(user as any)?.S_NAMA_LGKP ?? (user as any)?.S_USER_ID ?? "-"}
              </div>
              {currentGroupName ? (
                <div className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
                  Group: <b>{currentGroupName}</b>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => router.push("/setting/userlevel/add")}
                className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-3 py-1.5 text-[11px] font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </div>
        </header>

        {/* FILTER BAR (Group selector) */}
        <div className="border-b border-cyan-900/40 px-5 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="w-full md:max-w-md">
              <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70">
                Group
              </label>
              <div className="relative">
                <TypeableSelect
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  disabled={loadingGroup}
                  className="w-full appearance-none rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 pr-8 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  aria-label="Pilih group user level"
                >
                  <option value="0">-- Select Group --</option>
                  {groups.map((g) => (
                    <option key={g.level_code} value={g.level_code}>
                      {g.level_name}
                    </option>
                  ))}
                </TypeableSelect>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-cyan-300/70">
                  ▾
                </span>
              </div>
              {loadingGroup ? (
                <div className="mt-1 flex items-center gap-2 text-xs text-cyan-200/70">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" />
                  Memuat daftar group…
                </div>
              ) : errGroup ? (
                <div className="mt-1 text-xs text-red-300">{errGroup}</div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-100/80">
                List User Level{currentGroupName ? <> — <b>{currentGroupName}</b></> : null}
              </span>
              {rows.length > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-100/80">
                  Total: {rows.length}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="p-5">
          <div className="overflow-hidden rounded-xl border border-cyan-800/40 bg-black/30">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-cyan-800/60 text-sm text-cyan-100/90">
                <thead className="bg-cyan-500/10 text-xs uppercase tracking-wide text-cyan-200">
                  <tr>
                    <th className="px-3 py-3 text-center w-16">No</th>
                    <th className="px-3 py-3 text-center w-24">Code</th>
                    <th className="px-3 py-3 text-left">Group Name</th>
                    <th className="px-3 py-3 text-left">Level</th>
                    <th className="px-3 py-3 text-center w-60">Operation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-900/60">
                  {loadingTable ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-cyan-100/80">
                        <div className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                          Mengambil data user level…
                        </div>
                      </td>
                    </tr>
                  ) : errTable ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-red-200">
                        {errTable}
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-cyan-100/70">
                        {groupId === "0"
                          ? "Silakan pilih Group terlebih dahulu."
                          : "Tidak ada data untuk group yang dipilih."}
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, idx) => (
                      <tr key={`${r.user_level}-${idx}`} className="transition hover:bg-cyan-500/10">
                        <td className="px-3 py-3 text-center text-xs font-medium text-cyan-100/70">
                          {idx + 1}
                        </td>
                        {/* Kolom Code menampilkan USER_LEVEL (fix) */}
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
                            {r.user_level}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-cyan-50">{r.group_name || "-"}</div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2.5 py-1 text-xs font-bold text-fuchsia-100">
                            {r.level_name || "-"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="flex flex-nowrap items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/setting/userlevel/lihat/${encodeURIComponent(r.user_level)}`)}
                            className="btn op see inline-flex shrink-0 items-center gap-2 rounded-lg border border-cyan-800/50 bg-white/5 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-white/10"
                            title="Lihat"
                          >
                            <Eye className="h-4 w-4" />
                            Lihat
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/setting/userlevel/change/${encodeURIComponent(r.user_level)}`)}
                            className="btn op edit inline-flex shrink-0 items-center gap-2 rounded-lg border border-cyan-800/50 bg-white/5 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-white/10"
                            title="Ubah"
                          >
                            <Pencil className="h-4 w-4" />
                            Ubah
                          </button>
                           <button
                            type="button"
                            onClick={() => router.push(`/setting/userlevel/edit/${encodeURIComponent(r.user_level)}`)}
                            className="btn op priv inline-flex shrink-0 items-center gap-2 rounded-lg border border-cyan-800/50 bg-white/5 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-white/10"
                            title="Privilege Access"
                          >
                            <KeyRound className="h-4 w-4" />
                            Privilege
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/setting/userlevel/delete/${encodeURIComponent(r.user_level)}`)}
                            className="btn op del inline-flex shrink-0 items-center gap-2 rounded-lg border border-cyan-800/50 bg-white/5 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-white/10"
                            title="Hapus"
                          >
                            <Trash2 className="h-4 w-4" />
                            Hapus
                          </button>
                        </div>
                      </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="border-t border-cyan-900/50 px-5 py-3 text-sm text-cyan-200/70">
          {groupId !== "0" && rows.length > 0 ? (
            <div>
              Menampilkan <b>{rows.length}</b> level pada group <b>{currentGroupName}</b>.
            </div>
          ) : (
            <div>Pilih group untuk menampilkan daftar level.</div>
          )}
        </footer>
      </section>
    </div>
  );
}

