// FILE: src/app/setting/user/delete/[code]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/contexts/session";
import { AlertTriangle, ArrowLeft, Loader2, Trash2, RefreshCcw, Users } from "lucide-react";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";

type HeadInfo = { user_level: string; level_name: string; group_name: string };

function pickData<T = unknown>(json: any): T | null {
  if (!json) return null;
  if (Array.isArray(json?.data)) return json.data as T;
  if (json?.data && typeof json.data === "object" && "data" in json.data) return json.data.data as T;
  if (json?.data && typeof json.data === "object") return json.data as T;
  return null;
}

export default function UserLevelDeletePage() {
  const { code: raw } = useParams<{ code: string }>();
  const code = decodeURIComponent(raw);
  const router = useRouter();
  const { user } = useSession();

  const [head, setHead] = useState<HeadInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [modal, setModal] = useState<{ open: boolean; kind: ModalKind; title: string; message: string }>({
    open: false, kind: "confirm", title: "Konfirmasi Hapus Level", message: "Tindakan ini akan menghapus Level beserta hak aksesnya."
  });

  useEffect(() => {
    let off = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/setting/userlevel/head?code=${encodeURIComponent(code)}`, { credentials: "include", cache: "no-store" });
        const json = await res.json();
        const h = pickData<HeadInfo>(json);
        if (!off && h) setHead(h);
      } finally { if (!off) setLoading(false); }
    })();
    return () => { off = true; };
  }, [code]);

  async function doDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/setting/userlevel/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_level: code }),
      });
      const json = await res.json();
      const success = !!json?.success;
      const msg =
        (json?.data && typeof json.data === "object" && (json.data as any).message) ||
        json?.message ||
        "Level & hak akses berhasil dihapus.";

      if (success) {
        setModal({ open: true, kind: "success", title: "Berhasil", message: msg });
      } else {
        setModal({ open: true, kind: "error", title: "Tidak Bisa Dihapus", message: msg });
      }
    } catch (e: any) {
      setModal({ open: true, kind: "error", title: "Gagal", message: e?.message || "Terjadi kesalahan." });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
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
              Settings — Delete User Level
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

          {/* Body */}
          <div className="space-y-6 p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-cyan-800/40 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wide text-cyan-200/70">Code</div>
                <div className="mt-1 font-mono text-lg font-semibold text-cyan-50">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> : (head?.user_level ?? code)}
                </div>
              </div>
              <div className="rounded-xl border border-cyan-800/40 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wide text-cyan-200/70">Group Name</div>
                <div className="mt-1 text-lg font-semibold text-cyan-50">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> : (head?.level_name ?? "-")}
                </div>
              </div>
              <div className="rounded-xl border border-cyan-800/40 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wide text-cyan-200/70">Group Level</div>
                <div className="mt-1 text-lg font-semibold text-cyan-50">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> : (head?.group_name ?? "-")}
                </div>
              </div>
            </div>

            {/* Warning Box */}
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-100">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5" />
                <div>
                  <div className="font-semibold">Peringatan</div>
                  <p className="mt-1 text-sm">
                    Menghapus level akan menghapus seluruh hak akses terkait. Level hanya bisa dihapus bila <b>tidak ada user</b> yang masih menggunakan level ini.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setModal({
                  open: true,
                  kind: "confirm",
                  title: "Hapus Level?",
                  message: "Tindakan ini tidak dapat dibatalkan. Lanjutkan?",
                })}
                className="btn op del inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-60"
                title="Hapus level ini"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting…" : "Delete Level"}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Modal */}
      <NeonModal
        open={modal.open}
        kind={modal.kind}
        title={modal.title}
        message={modal.message}
        confirmText={modal.kind === "confirm" ? (deleting ? "Processing…" : "Delete") : "OK"}
        loading={deleting}
        onConfirm={() => {
          if (modal.kind === "confirm") doDelete();
        }}
        onClose={() => {
          // sukses → kembali ke list; selain itu tutup saja
          if (modal.kind === "success") router.push("/setting/userlevel");
          setModal(m => ({ ...m, open: false }));
        }}
      />
    </>
  );
}
