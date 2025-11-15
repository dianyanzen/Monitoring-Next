// FILE: src/app/setting/user/add/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Save, ShieldPlus, TriangleAlert, RefreshCcw } from "lucide-react";
import { useSession } from "@/contexts/session";
import SelectDark from "@/components/ui/SelectDark";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";

/* ======================== Types ======================== */
type Group = { level_code: string; level_name: string };
type NoticeKind = "ok" | "warn" | "err";

/* ======================== Helpers ======================== */
const onlyDigits = (s: string) => s.replace(/[^\d]/g, "");
const toUpperSafe = (s: string) =>
  s.replace(/[`~!@#$%^&*()_=+[\]{};'",.<>/?\\|-]/g, "").toUpperCase();

function keyFilterNumber(e: KeyboardEvent<HTMLInputElement>) {
  const nav = ["Backspace", "Delete", "Tab", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"];
  if (nav.includes(e.key)) return;
  if (!/^\d$/.test(e.key)) e.preventDefault();
}

function onPasteNumber(e: ClipboardEvent<HTMLInputElement>, setVal: (v: string) => void) {
  const clip = e.clipboardData?.getData("text") ?? "";
  theInput(e, setVal, clip);
}
function theInput(e: ClipboardEvent<HTMLInputElement>, setVal: (v: string) => void, clip: string) {
  const sanitized = onlyDigits(clip);
  const input = e.currentTarget;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const next = input.value.slice(0, start) + sanitized + input.value.slice(end);
  e.preventDefault();
  setVal(next.slice(0, 3));
  queueMicrotask(() => {
    const caret = Math.min(start + sanitized.length, 3);
    input.setSelectionRange(caret, caret);
  });
}

/* Extract human message from any API envelope */
function pickMsg(json: any) {
  const msg =
    (json?.data && typeof json.data === "object" && (json.data as any).message) ||
    json?.message ||
    "pesan yang di terima.";
  return String(msg);
}

/* ======================== Page ======================== */
export default function AddUserLevelPage() {
  const router = useRouter();
  const { user } = useSession();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const [lvlCd, setLvlCd] = useState("");
  const [lvlNm, setLvlNm] = useState("");
  const [kdGroup, setKdGroup] = useState("0");

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: NoticeKind; msg: string } | null>(null);

  const firstInvalidRef = useRef<HTMLInputElement | null>(null);

  // Modal state
  const [modal, setModal] = useState<{ open: boolean; kind: ModalKind; title: string; message: string }>({
    open: false,
    kind: "success",
    title: "Tersimpan",
    message: "Data berhasil disimpan.",
  });

  /* ---------------- Load group list ---------------- */
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        setLoadingGroups(true);
        const res = await fetch("/api/setting/get_group", {
          method: "POST",
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json();
        const list: Group[] = json?.data ?? [];
        if (!off) setGroups(list);
      } catch {
        if (!off)
          setNotice({ type: "err", msg: "Gagal memuat daftar group. Coba muat ulang." });
      } finally {
        if (!off) setLoadingGroups(false);
      }
    })();
    return () => {
      off = true;
    };
  }, []);

  /* ---------------- Validation ---------------- */
  const validationMsg = useMemo(() => {
    if (!/^\d{1,3}$/.test(lvlCd.trim())) return "Level Code harus numerik dan maksimal 3 digit.";
    if (!lvlNm.trim()) return "Level Name wajib diisi.";
    if (!/^\d+$/.test(kdGroup) || kdGroup === "0") return "Pilih Group terlebih dahulu.";
    return null;
  }, [lvlCd, lvlNm, kdGroup]);

  function focusFirstInvalid() {
    if (!/^\d{1,3}$/.test(lvlCd.trim())) {
      firstInvalidRef.current?.focus();
      return;
    }
    document.getElementById("input-lvl-nm")?.focus();
  }

  function handleEnter(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    void onSave();
  }

  /* ---------------- Actions ---------------- */
  async function onSave() {
    if (validationMsg) {
      setNotice({ type: "warn", msg: validationMsg });
      focusFirstInvalid();
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      // 1) cek duplikat
      const chkRes = await fetch("/api/setting/check_lvl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lvl_cd: lvlCd }),
      });
      const chk = await chkRes.json();
      if (!chkRes.ok || !chk?.success) throw new Error(pickMsg(chk));
      if (chk?.data?.is_exists === 1) {
        setNotice({
          type: "warn",
          msg: `Level Code sudah digunakan oleh: ${chk?.data?.lvl_name ?? "-"}`,
        });
        firstInvalidRef.current?.focus();
        return;
      }

      // 2) simpan
      const svRes = await fetch("/api/setting/save_lvl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lvl_cd: lvlCd, lvl_nm: lvlNm, kdgroup: kdGroup }),
      });
      const sv = await svRes.json();
      const ok = !!sv?.success;
      const msg = pickMsg(sv);

      if (!svRes.ok || !ok) {
        // error → tampilkan modal error
        setModal({ open: true, kind: "error", title: "Gagal Menyimpan", message: msg });
        return;
      }

      // success → modal success lalu redirect ke list
      setModal({ open: true, kind: "success", title: "Tersimpan", message: msg || "Data berhasil disimpan." });
    } catch (e: any) {
      setModal({
        open: true,
        kind: "error",
        title: "Kesalahan Server",
        message: e?.message || "Terjadi kesalahan server",
      });
    } finally {
      setBusy(false);
    }
  }

  function onReset() {
    setLvlCd("");
    setLvlNm("");
    setKdGroup("0");
    setNotice(null);
    firstInvalidRef.current?.focus();
  }

  /* ---------------- UI ---------------- */
  return (
    <>
      <div
        className="relative mt-5 space-y-8 px-4 pb-10 pt-6 text-gray-100 sm:px-6 md:px-8 md:pt-8"
        onKeyDown={handleEnter}
      >
        {/* ambient glow */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[15%] top-[-15%] h-[1100px] w-[1100px] rounded-full bg-cyan-500/15 blur-[220px]" />
          <div className="absolute right-[18%] bottom-[-20%] h-[1000px] w-[1000px] rounded-full bg-fuchsia-600/12 blur-[190px]" />
        </div>

        <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
          {/* HEADER */}
          <header className="border-b border-cyan-900/50 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              <h1 className="text-base font-semibold tracking-wide text-cyan-200">
                Setting — Tambah User Level
              </h1>
              <div className="ml-auto flex items-center gap-2">
                <div className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
                  User: {(user as any)?.S_NAMA_LGKP ?? (user as any)?.S_USER_ID ?? "-"}
                </div>
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
                  onClick={() => router.push("/setting/userlevel")}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                  aria-label="Kembali ke daftar User Level"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
              </div>
            </div>
          </header>

          {/* BODY */}
          <div className="space-y-6 p-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70" htmlFor="input-lvl-cd">
                  Level Code
                </label>
                <input
                  id="input-lvl-cd"
                  ref={firstInvalidRef}
                  inputMode="numeric"
                  maxLength={3}
                  value={lvlCd}
                  onChange={(e) => setLvlCd(onlyDigits(e.target.value).slice(0, 3))}
                  onKeyDown={keyFilterNumber}
                  onPaste={(e) => onPasteNumber(e, (v) => setLvlCd(v))}
                  placeholder="mis. 3"
                  className="w-full rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  aria-invalid={!!validationMsg && !/^\d{1,3}$/.test(lvlCd.trim())}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70" htmlFor="input-lvl-nm">
                  Level Name
                </label>
                <input
                  id="input-lvl-nm"
                  value={lvlNm}
                  onChange={(e) => setLvlNm(toUpperSafe(e.target.value))}
                  placeholder="PELAYANAN KELURAHAN"
                  className="w-full rounded-lg border border-cyan-800/50 bg-black/30 px-3 py-2 text-sm text-cyan-100 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                  aria-invalid={!!validationMsg && !lvlNm.trim()}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-100/70" htmlFor="select-group">
                  Group
                </label>
                <SelectDark
                  id="select-group"
                  value={kdGroup}
                  onChange={(e) => setKdGroup(e.target.value)}
                  disabled={loadingGroups || busy}
                  aria-invalid={!!validationMsg && (kdGroup === "0" || !/^\d+$/.test(kdGroup))}
                >
                  <option value="0">-- Select Group --</option>
                  {groups.map((g) => (
                    <option key={g.level_code} value={g.level_code}>
                      {g.level_name}
                    </option>
                  ))}
                </SelectDark>

                <div className="mt-1 flex items-center gap-2 text-xs text-cyan-200/70">
                  {loadingGroups ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" />
                      Memuat daftar group…
                    </>
                  ) : (
                    <>Pilih group level untuk menentukan kategori akses.</>
                  )}
                </div>
              </div>

              <div className="flex items-end justify-end gap-2">
                <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/50 bg-white/5 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-white/10" disabled={busy} onClick={onReset}>
                  Reset
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-black shadow-lg transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Simpan user level"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </div>

            {notice && (
              <div
                role="status"
                className={
                  notice.type === "ok"
                    ? "flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100"
                    : notice.type === "warn"
                    ? "flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
                    : "flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100"
                }
              >
                {notice.type === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
                <span>{notice.msg}</span>
              </div>
            )}
          </div>

          <footer className="border-t border-cyan-900/50 px-5 py-3 text-sm text-cyan-200/70">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2">
                <ShieldPlus className="h-4 w-4 text-cyan-300" />
                <span>Form User Level</span>
              </div>
              <div>
                User: <b>{(user as any)?.S_NAMA_LGKP ?? (user as any)?.S_USER_ID ?? "-"}</b>
              </div>
            </div>
          </footer>
        </section>
      </div>

      {/* MODAL — redirect ke list setelah sukses */}
      <NeonModal
        open={modal.open}
        kind={modal.kind}
        title={modal.title}
        message={modal.message}
        onClose={() => {
          if (modal.kind === "success") router.push("/setting/userlevel");
          setModal((m) => ({ ...m, open: false }));
        }}
      />
    </>
  );
}
