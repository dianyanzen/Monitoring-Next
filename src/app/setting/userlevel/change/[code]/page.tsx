// FILE: src/app/setting/user/change/[code]/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Save,RefreshCcw, Users } from "lucide-react";
import { useSession } from "@/contexts/session";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";

type HeadInfo = { user_level: string; level_name: string; group_name: string };

function pickData<T = unknown>(json: any): T | null {
  if (!json) return null;
  if (Array.isArray(json?.data)) return json.data as T;
  if (json?.data && typeof json.data === "object" && "data" in json.data) return json.data.data as T;
  if (json?.data && typeof json.data === "object") return json.data as T;
  return null;
}

export default function UserLevelChangePage() {
  const { code: raw } = useParams<{ code: string }>();
  const code = decodeURIComponent(raw);
  const router = useRouter();
  const { user } = useSession();

  const [head, setHead] = useState<HeadInfo | null>(null);
  const [levelName, setLevelName] = useState(""); // selalu tersimpan UPPERCASE
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<ModalKind>("info");
  const [modalTitle, setModalTitle] = useState("Notification");
  const [modalMsg, setModalMsg] = useState("");
  const [modalGoBackOnClose, setModalGoBackOnClose] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/setting/userlevel/head?code=${encodeURIComponent(code)}`, {
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json();
        const data = pickData<HeadInfo>(json);
        if (!off && res.ok && data) {
          setHead(data);
          setLevelName((data.level_name ?? "").toUpperCase()); // seed as UPPER
        }
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => { off = true; };
  }, [code]);

  const dirty = useMemo(
    () => (head ? levelName.trim() !== (head.level_name ?? "").toUpperCase().trim() : false),
    [head, levelName]
  );

  const handleSave = useCallback(async () => {
    if (!dirty || !head || saving) return;
    setSaving(true);
    try {
      const payloadName = levelName.trim().toUpperCase(); // enforce upper on submit
      const res = await fetch("/api/setting/userlevel/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: head.user_level, levelName: payloadName }),
      });
      const json = await res.json();
      const ok = res.ok && json?.success !== false;
      const msg = json?.data?.message || json?.message || (ok ? "Level name berhasil diperbarui." : "Gagal menyimpan.");

      setModalTitle(ok ? "Berhasil" : "Gagal");
      setModalKind(ok ? "success" : "error");
      setModalMsg(msg);
      setModalGoBackOnClose(ok);
      setModalOpen(true);
    } catch (e: any) {
      setModalTitle("Kesalahan");
      setModalKind("error");
      setModalMsg(e?.message || "Terjadi kesalahan saat menyimpan.");
      setModalGoBackOnClose(false);
      setModalOpen(true);
    } finally { setSaving(false); }
  }, [dirty, head, levelName, saving]);

  // Enter = Save
  const onKeyDownEnterSave = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      {/* glow bg */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-[-15%] h-[1100px] w-[1100px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[18%] bottom-[-20%] h-[1000px] w-[1000px] rounded-full bg-fuchsia-600/12 blur-[190px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-cyan-900/50 bg-[#0b0b1a]/90 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
            <h1 className="text-base font-semibold tracking-wide text-cyan-200">
              Settings — Change User Level Name
            </h1>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden sm:inline-flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
                <Users className="h-3.5 w-3.5" />
                User: {(user as any)?.S_NAMA_LGKP ?? (user as any)?.S_USER_ID ?? "-"}
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <RefreshCcw className="h-3.5 w-3.5" /> Refresh
              </button>
              <button
                type="button"
                onClick={() => router.push("/setting/userlevel")}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-6 p-6" onKeyDown={onKeyDownEnterSave}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-cyan-800/40 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-wide text-cyan-200/70">Level Code</div>
              <div className="mt-1 text-lg font-semibold text-cyan-50">
                {head?.user_level ?? code}
              </div>
            </div>

            <div className="rounded-xl border border-cyan-800/40 bg-black/20 p-4 sm:col-span-2">
              <label className="text-xs uppercase tracking-wide text-cyan-200/70">
                Level Name <span className="ml-1 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] text-cyan-200">WAJIB CAPSLOCK</span>
              </label>
              <input
                value={levelName}
                onChange={(e) => setLevelName(e.target.value.toUpperCase())}
                onKeyDown={onKeyDownEnterSave}
                className="mt-2 w-full rounded-lg border border-cyan-800/50 bg-[#061019] px-3 py-2 text-cyan-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 uppercase"
                placeholder="MASUKKAN NAMA LEVEL"
                autoFocus
              />
              <div className="mt-2 text-[11px] text-cyan-200/60">
                Tekan <b>Enter</b> untuk menyimpan.
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-[12px] font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>
        </div>
      </section>

      <NeonModal
        open={modalOpen}
        kind={modalKind}
        title={modalTitle}
        message={modalMsg}
        onClose={() => {
          setModalOpen(false);
          if (modalGoBackOnClose) router.push("/setting/userlevel");
        }}
      />
    </div>
  );
}
