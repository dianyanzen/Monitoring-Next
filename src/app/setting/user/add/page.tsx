"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Save,
  ShieldPlus,
  TriangleAlert,
} from "lucide-react";
import { useSession } from "@/contexts/session";
import SelectDark from "@/components/ui/SelectDark";

/* ======================== Types ======================== */
type Group = { level_code: string; level_name: string };
type NoticeKind = "ok" | "warn" | "err";

/* ======================== Helpers ======================== */
const onlyDigits = (s: string) => s.replace(/[^\d]/g, "");
const toUpperSafe = (s: string) =>
  s.replace(/[`~!@#$%^&*()_=+[\]{};'",.<>/?\\|-]/g, "").toUpperCase();

function keyFilterNumber(e: KeyboardEvent<HTMLInputElement>) {
  const nav = [
    "Backspace",
    "Delete",
    "Tab",
    "Enter",
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
  ];
  if (nav.includes(e.key)) return;
  if (!/^\d$/.test(e.key)) e.preventDefault();
}

function onPasteNumber(
  e: ClipboardEvent<HTMLInputElement>,
  setVal: (v: string) => void
) {
  const clip = e.clipboardData?.getData("text") ?? "";
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
  const [notice, setNotice] = useState<{ type: NoticeKind; msg: string } | null>(
    null
  );

  const firstInvalidRef = useRef<HTMLInputElement | null>(null);

  /* ---------------- Load group list ---------------- */
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        setLoadingGroups(true);
        const res = await fetch("/api/setting/get_group", {
          method: "POST", // API kamu menggunakan POST
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json();
        const list: Group[] = json?.data ?? [];
        if (!off) setGroups(list);
      } catch {
        if (!off)
          setNotice({
            type: "err",
            msg: "Gagal memuat daftar group. Coba muat ulang.",
          });
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
    if (!/^\d{1,3}$/.test(lvlCd.trim()))
      return "Level Code harus numerik dan maksimal 3 digit.";
    if (!lvlNm.trim()) return "Level Name wajib diisi.";
    if (!/^\d+$/.test(kdGroup) || kdGroup === "0")
      return "Pilih Group terlebih dahulu.";
    return null;
  }, [lvlCd, lvlNm, kdGroup]);

  function focusFirstInvalid() {
    if (!/^\d{1,3}$/.test(lvlCd.trim())) {
      firstInvalidRef.current?.focus();
      return;
    }
    // next natural invalid focus:
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
      // 1) Cek duplikat
      const chkRes = await fetch("/api/setting/check_lvl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lvl_cd: lvlCd }),
      });
      const chk = await chkRes.json();
      if (!chkRes.ok || !chk?.success) {
        throw new Error(chk?.message || "Gagal memeriksa Level Code");
      }
      if (chk?.data?.is_exists === 1) {
        setNotice({
          type: "warn",
          msg: `Level Code sudah digunakan oleh: ${chk?.data?.lvl_name ?? "-"}`,
        });
        firstInvalidRef.current?.focus();
        return;
      }

      // 2) Simpan
      const svRes = await fetch("/api/setting/save_lvl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lvl_cd: lvlCd, lvl_nm: lvlNm, kdgroup: kdGroup }),
      });
      const sv = await svRes.json();
      if (!svRes.ok || !sv?.success) {
        throw new Error(sv?.message || "Gagal menyimpan Level");
      }

      setNotice({
        type: "ok",
        msg: sv?.data?.message ?? "Data berhasil disimpan.",
      });

      // reset form
      setLvlCd("");
      setLvlNm("");
      setKdGroup("0");
      firstInvalidRef.current?.focus();
    } catch (e: any) {
      setNotice({ type: "err", msg: e?.message || "Terjadi kesalahan server" });
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
    <div
      className="relative mt-5 space-y-6 px-4 pb-10 pt-6 text-gray-100 sm:px-6 md:px-8 md:pt-8"
      onKeyDown={handleEnter}
    >
      {/* background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="abs-glow-cyan" />
        <div className="abs-glow-magenta" />
      </div>

      <section className="glass-card neon-border">
        {/* Header */}
        <header className="glass-head">
          <div className="ui-shell-head">
            <div className="ui-shell-title">
              <ShieldPlus className="h-5 w-5 text-cyan-300" />
              <span>Setting</span>
              <span className="sep">/</span>
              <span className="accent">Tambah User Level</span>
            </div>
            <div className="ui-shell-actions">
              <button
                type="button"
                onClick={() => router.push("/setting/userlevel")}
                className="btn op"
                disabled={busy}
                aria-label="Kembali ke daftar User Level"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="space-y-6 p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="lbl" htmlFor="input-lvl-cd">
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
              <label className="lbl" htmlFor="input-lvl-nm">
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
              <label className="lbl" htmlFor="select-group">
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

              <div className="hint">
                {loadingGroups ? (
                  <>
                    <Loader2 className="icon-spin" />
                    Memuat daftar group…
                  </>
                ) : (
                  <>Pilih group level untuk menentukan kategori akses.</>
                )}
              </div>
            </div>

            <div className="flex items-end justify-end gap-2">
              <button type="button" className="btn op" disabled={busy} onClick={onReset}>
                Reset
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={busy}
                className="btn-accent"
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
              {notice.type === "ok" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <TriangleAlert className="h-4 w-4" />
              )}
              <span>{notice.msg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="glass-foot">
          <div className="foot-text">
            User:{" "}
            <b>{(user as any)?.S_NAMA_LGKP ?? (user as any)?.S_USER_ID ?? "-"}</b>
          </div>
        </footer>
      </section>
    </div>
  );
}
