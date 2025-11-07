// FILE: src/app/setting/user/lihat/[code]/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/contexts/session";
import {
  ArrowLeft, Loader2, RefreshCcw, Users, ShieldPlus, Save,
  ChevronDown, ChevronRight,
} from "lucide-react";

/* ========= Types ========= */
type HeadInfo = { user_level: string; level_name: string; group_name: string };
type TreeNode = { id: string; text: string; checked?: boolean; children?: TreeNode[] };
type UserCard = {
  user_id: string;
  nama_lgkp: string;
  nik: string;
  tmpt_lhr: string | null;
  tgl_lhr: string | null;
  telp: string | null;
  alamat_rumah: string | null;
  nama_kantor?: string | null;
};

/* ========= Utils ========= */
const flattenChecked = (nodes: TreeNode[], out: string[] = []) => {
  for (const n of nodes) { if (n.checked) out.push(n.id); if (n.children) flattenChecked(n.children, out); }
  return out;
};

// Resolusi payload fleksibel: {data: X} atau {data: {data: X}}
function pickData<T = unknown>(json: any): T | null {
  if (!json) return null;
  if (Array.isArray(json?.data)) return json.data as T;
  if (json?.data && typeof json.data === "object" && "data" in json.data) return json.data.data as T;
  if (json?.data && typeof json.data === "object") return json.data as T;
  return null;
}

const ImgProfile = ({ nik, alt }: { nik: string; alt: string }) => {
  const [err, setErr] = useState(false);
  return (
    <img
      src={err ? "/assets/plugins/images/calming-cat.gif" : `/assets/upload/pp/${nik}.jpg`}
      onError={() => setErr(true)}
      alt={alt}
      className="h-16 w-16 rounded-full object-cover ring-1 ring-cyan-900/40"
    />
  );
};

/* ===== Tree components (React murni, cascade check) ===== */
  function TreeItem({
    node,
    onToggle,
    readOnly = false,
  }: {
    node: TreeNode;
    onToggle: (id: string, checked: boolean) => void;
    readOnly?: boolean;
  }) {
    const [open, setOpen] = useState(true);
    const hasKids = !!node.children?.length;

    return (
      <div className="pl-2">
        <div className="flex items-center gap-2 py-1">
          {hasKids ? (
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              className="inline-flex h-5 w-5 items-center justify-center rounded text-cyan-200/80 hover:bg-cyan-500/10"
              aria-label={open ? "Collapse" : "Expand"}
            >
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : <span className="inline-block h-5 w-5" />}

          {/* ⬇️ label & checkbox: readOnly = biru, tapi tak bisa diubah */}
          <label
            className={`inline-flex select-none items-center gap-2 ${
              readOnly ? "cursor-default" : "cursor-pointer"
            }`}
            onMouseDown={readOnly ? (e) => e.preventDefault() : undefined}   // blok toggle via label
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-cyan-400"
              checked={!!node.checked}
              aria-readonly={readOnly || undefined}
              // kunci interaksi tanpa 'disabled' supaya warna tetap biru
              onClick={readOnly ? (e) => e.preventDefault() : undefined}
              onChange={(e) => !readOnly && onToggle(node.id, e.target.checked)}
              tabIndex={readOnly ? -1 : 0}
            />
            <span className="text-sm text-cyan-100">{node.text}</span>
          </label>
        </div>

        {hasKids && open ? (
          <div className="border-l border-cyan-900/40 pl-3">
            {node.children!.map(c => (
              <TreeItem key={c.id} node={c} onToggle={onToggle} readOnly={readOnly} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function CheckTree({
    data,
    onChange,
    readOnly = false,
  }: {
    data: TreeNode[];
    onChange: (next: TreeNode[]) => void;
    readOnly?: boolean;
  }) {
    const onToggle = useCallback((id: string, checked: boolean) => {
      if (readOnly) return; // extra guard
      const clone = structuredClone(data) as TreeNode[];
      const dfs = (arr: TreeNode[]) => {
        for (const n of arr) {
          if (n.id === id) {
            n.checked = checked;
            const setChild = (kids?: TreeNode[]) => {
              if (!kids) return;
              for (const k of kids) { k.checked = checked; setChild(k.children); }
            };
            setChild(n.children);
            return true;
          }
          if (n.children && dfs(n.children)) return true;
        }
        return false;
      };
      dfs(clone);
      onChange(clone);
    }, [data, onChange, readOnly]);

    return (
      <div className={`rounded-xl border border-cyan-800/40 p-3 min-h-[160px] ${readOnly ? "bg-black/10" : "bg-black/20"}`}>
        {data.length ? data.map(n => (
          <TreeItem key={n.id} node={n} onToggle={onToggle} readOnly={readOnly} />
        )) : (
          <div className="flex items-center gap-2 text-sm text-cyan-200/70">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> Memuat hak akses…
          </div>
        )}
      </div>
    );
  }

/* ===== Page ===== */
export default function UserLevelLihatPage() {
  const router = useRouter();
  const { code: raw } = useParams<{ code: string }>();
  const code = decodeURIComponent(raw);
  const { user } = useSession();

  const [head, setHead] = useState<HeadInfo | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [users, setUsers] = useState<UserCard[]>([]);
  const [loadingHead, setLoadingHead] = useState(true);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Head
  useEffect(() => {
    let off = false;
    (async () => {
      setLoadingHead(true);
      try {
        const res = await fetch(`/api/setting/userlevel/head?code=${encodeURIComponent(code)}`, { cache: "no-store", credentials: "include" });
        const json = await res.json();
        const payload = pickData<HeadInfo>(json);
        if (res.ok && payload && !off) setHead(payload);
      } finally {
        if (!off) setLoadingHead(false);
      }
    })();
    return () => { off = true; };
  }, [code]);

  // Tree
  const loadTree = useCallback(() => {
    let off = false;
    setLoadingTree(true);
    (async () => {
      try {
        const res = await fetch(`/api/setting/get_group_tree_one?user_level=${encodeURIComponent(code)}`, { cache: "no-store", credentials: "include" });
        const json = await res.json();
        const arr = pickData<TreeNode[] | unknown>(json);
        const treeData = Array.isArray(arr) ? (arr as TreeNode[]) : [];
        if (!off) setTree(treeData);
      } catch (e: any) {
        if (!off) setNotice({ type: "err", msg: e?.message || "Gagal memuat hak akses." });
      } finally {
        if (!off) setLoadingTree(false);
      }
    })();
    return () => { off = true; };
  }, [code]);

  useEffect(() => { const un = loadTree(); return () => void un?.(); }, [loadTree]);

  // Users
  useEffect(() => {
    let off = false;
    (async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch(`/api/setting/userlevel/users?code=${encodeURIComponent(code)}`, { cache: "no-store", credentials: "include" });
        const json = await res.json();
        const arr = pickData<UserCard[] | unknown>(json);
        const list = Array.isArray(arr) ? (arr as UserCard[]) : [];
        if (!off) setUsers(list);
      } catch {
        if (!off) setUsers([]);
      } finally {
        if (!off) setLoadingUsers(false);
      }
    })();
    return () => { off = true; };
  }, [code]);

  const checkedIds = useMemo(() => flattenChecked(tree), [tree]);

  async function handleSave() {
    setSaving(true); setNotice(null);
    try {
      const res = await fetch("/api/setting/userlevel/save_access", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ user_level: code, checkedIds }),
      });
      const json = await res.json();
      const okFlag = json?.success ?? false;
      if (!res.ok || !okFlag) throw new Error(json?.message || "Gagal menyimpan perubahan");
      const msg = (pickData<{ message?: string }>(json) as any)?.message ?? "Hak akses berhasil disimpan.";
      setNotice({ type: "ok", msg });
    } catch (e: any) {
      setNotice({ type: "err", msg: e?.message || "Terjadi kesalahan saat menyimpan." });
    } finally { setSaving(false); }
  }

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
              Settings — Detail User Level
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
          {/* Info header */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-cyan-800/40 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-wide text-cyan-200/70">Code</div>
              <div className="mt-1 font-mono text-lg font-semibold text-cyan-50">
                {loadingHead ? <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> : (head?.user_level ?? code)}
              </div>
            </div>
            <div className="rounded-xl border border-cyan-800/40 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-wide text-cyan-200/70">Group Name</div>
              <div className="mt-1 text-lg font-semibold text-cyan-50">
                {loadingHead ? <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> : (head?.level_name ?? "-")}
              </div>
            </div>
            <div className="rounded-xl border border-cyan-800/40 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-wide text-cyan-200/70">Group Level</div>
              <div className="mt-1 text-lg font-semibold text-cyan-50">
                {loadingHead ? <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> : (head?.group_name ?? "-")}
              </div>
            </div>
          </div>

          {/* Aksi simpan hak akses */}
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-100/80">
              <ShieldPlus className="h-3.5 w-3.5" />
              Hak Akses untuk Code <b className="ml-1">{head?.user_level ?? code}</b>
            </div>

          </div>

          {notice && (
            <div className={`rounded-xl px-3 py-2 text-sm ${notice.type === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
              : "border-red-500/40 bg-red-500/10 text-red-100"}`}>
              {notice.msg}
            </div>
          )}

          {/* Tree akses */}
          {/* Tree akses (read-only) */}
          {loadingTree ? (
            <div className="flex items-center gap-2 text-sm text-cyan-200/70">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> Memuat hak akses…
            </div>
          ) : (
            <CheckTree data={tree} onChange={setTree} readOnly />  
          )}

          {/* Daftar pengguna */}
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-100/80">
            <Users className="h-3.5 w-3.5" /> Pengguna di level ini {users.length ? <span className="ml-1 rounded-full bg-cyan-400/20 px-1.5 text-cyan-50">{users.length}</span> : null}
          </div>

          {loadingUsers ? (
            <div className="flex items-center gap-2 text-sm text-cyan-200/70">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> Mengambil data pengguna…
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-xl border border-cyan-800/40 bg-black/20 p-4 text-sm text-cyan-200/70">
              Belum ada pengguna pada level ini.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {users.map(u => (
                <div key={u.user_id} className="rounded-xl border border-cyan-800/40 bg-black/20 p-4">
                  <div className="flex items-start gap-3">
                    <ImgProfile nik={u.nik} alt={u.nama_lgkp} />
                    <div>
                      <div className="text-cyan-50">{u.nama_lgkp}</div>
                      <div className="text-xs text-cyan-200/70">User: {u.user_id}</div>
                      {u.nama_kantor && <div className="text-xs text-cyan-200/70">{u.nama_kantor}</div>}
                      <div className="mt-2 text-xs text-cyan-200/70">{u.tmpt_lhr ? `${u.tmpt_lhr}, ` : ""}{u.tgl_lhr ?? ""}</div>
                      <div className="mt-1 text-xs text-cyan-200/70">
                        {u.telp ? <>Phone: {u.telp}<br /></> : null}
                        {u.alamat_rumah ?? ""}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
