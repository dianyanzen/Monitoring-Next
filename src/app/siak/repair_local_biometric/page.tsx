// FILE: src/app/siak/repair_local_biometric/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSession } from "@/contexts/session";
import { Activity, Image as ImageIcon, Loader2, RefreshCcw, Search, Trash2 } from "lucide-react";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";

/* ========= Types ========= */
type Scope = "rekam" | "cetak";

type ScanPerson = {
  NIK: string;
  NO_KK: string;
  NAMA_LGKP: string;
  TMPT_LHR: string;
  TGL_LHR: string;
  JENIS_KLMIN: string;
  CURRENT_STATUS_CODE: string;
};

type FingerItem = { name: string; png: string | null; error?: string };
type ScanResponse = {
  scope: Scope;
  nik: string;
  personSource: "DEMOGRAPHICS" | "DEMOGRAPHICS_ALL" | "NONE";
  person: ScanPerson[];
  biometric: {
    counts: { faces: number; signatures: number };
    faces: { FACE: string }[];
    signatures: { SIGNATURE: string }[];
  };
  iris: {
    mime: string | null;
    left: string | null;
    right: string | null;
    meta?: { converted?: boolean; sourceCode?: string | null; errors?: string[] | null };
  } | null;
  fingers: { mime: string | null; items: FingerItem[] } | null;
};

type ApiEnvelope<T = unknown> = { success: boolean; message: string; data?: T };

/* ========= UI const ========= */
const PLACEHOLDER_MALE_DARK = "/assets/upload/cyber_man.png";
const PLACEHOLDER_FEMALE_DARK = "/assets/upload/cyber_woman.png";
const PLACEHOLDER_MALE_LIGHT = "/assets/upload/lux_man.png";
const PLACEHOLDER_FEMALE_LIGHT = "/assets/upload/lux_woman.png";
const BIOMETRIC_TABLES = ["DEMOGRAPHICS", "FACES", "SIGNATURES"] as const;

/* ========= Utils ========= */
function cx(...a: (string | false | null | undefined)[]) { return a.filter(Boolean).join(" "); }
function useThemeDark(): boolean {
  const [isDark, set] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      const byClass = root.classList.contains("dark");
      const byAttr = (root.getAttribute("data-theme") || "").toLowerCase() === "dark";
      set(byClass || byAttr);
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

/* ========= Page ========= */
export default function RepairLocalBiometricPage() {
  const { user } = useSession();
  const nikRef = useRef<HTMLInputElement>(null);
  const maskNik = (n: string) => (n && n.length >= 4 ? `******${n.slice(-4)}` : n);

  const isDark = useThemeDark();

  const [nik, setNik] = useState("");
  const [scope, setScope] = useState<Scope>("rekam");
  const [loading, setLoading] = useState<"idle" | "scan" | "delete">("idle");
  const [scan, setScan] = useState<ScanResponse | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<ModalKind>("info");
  const [modalTitle, setModalTitle] = useState("Notification");
  const [modalMsg, setModalMsg] = useState("");
  const [modalOnYes, setModalOnYes] = useState<(() => void) | undefined>();
  const saving = loading === "delete";

  const nikValid = /^\d{16}$/.test(nik);
  const person = useMemo(() => scan?.person?.[0] ?? null, [scan]);

  const gender = (person?.JENIS_KLMIN || "").toUpperCase();
  const isFemale = gender.includes("PEREM") || gender === "P" || gender === "2";

  const faceBase64 = scan?.biometric?.faces?.[0]?.FACE || "";
  const signBase64 = scan?.biometric?.signatures?.[0]?.SIGNATURE || "";
  const irisMime = scan?.iris?.mime || "image/jpeg";
  const irisMeta = scan?.iris?.meta;

  function openAlert(kind: ModalKind, title: string, message: string) {
    setModalKind(kind); setModalTitle(title); setModalMsg(message); setModalOnYes(undefined); setModalOpen(true);
  }
  function openConfirm(title: string, message: string, onYes: () => void) {
    setModalKind("confirm"); setModalTitle(title); setModalMsg(message); setModalOnYes(() => onYes); setModalOpen(true);
  }

  const doScan = useCallback(async () => {
    if (!nikValid) { openAlert("warning", "Format NIK salah", "NIK harus 16 digit angka."); return; }
    setLoading("scan"); setScan(null);
    try {
      const url = `/api/siak/repair_local_biometric/scan?nik=${encodeURIComponent(nik)}&scope=${scope}`;
      const res = await fetch(url, { method: "GET" });
      const json: ApiEnvelope<ScanResponse> = await res.json();
      if (!json.success) { openAlert("error", "Gagal memuat data", json.message || "Tidak dapat memindai data."); return; }
      setScan(json.data as ScanResponse);
    } catch (e: any) {
      openAlert("error", "Kesalahan", e?.message || "Terjadi kesalahan saat memindai data.");
    } finally { setLoading("idle"); }
  }, [nik, nikValid, scope]);

  const performDelete = useCallback(async () => {
    setLoading("delete");
    try {
      const res = await fetch("/api/siak/repair_local_biometric/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nik, scope }),
      });
      const json: ApiEnvelope<any> = await res.json();
      if (!json.success) { openAlert("error", "Gagal menghapus data", json.message || "Operasi hapus gagal."); return; }
      setScan((prev) =>
        prev ? {
          ...prev,
          person: [], personSource: "NONE",
          biometric: { counts: { faces: 0, signatures: 0 }, faces: [], signatures: [] },
          iris: { mime: prev.iris?.mime ?? null, left: null, right: null, meta: prev.iris?.meta },
          fingers: { mime: prev.fingers?.mime ?? "image/png", items: [] },
        } : prev
      );
      openAlert("success", "Selesai", json.data?.message || "Data berhasil dibersihkan.");
    } catch (e: any) {
      openAlert("error", "Kesalahan", e?.message || "Terjadi kesalahan saat menghapus data.");
    } finally { setLoading("idle"); setModalOpen(false); }
  }, [nik, scope]);

  const doDelete = useCallback(() => {
    if (!nikValid) { openAlert("warning", "Format NIK salah", "NIK harus 16 digit angka."); return; }
    const confirmText = scope === "rekam"
      ? "Bersihkan data perekaman (termasuk Demographics_all) dan selaraskan pencetakan?"
      : "Bersihkan data di database pencetakan?";
    openConfirm("Konfirmasi Hapus", confirmText, performDelete);
  }, [nikValid, scope, performDelete]);

  const onReset = useCallback(() => { setNik(""); setScope("rekam"); setScan(null); nikRef.current?.focus(); }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); if (loading === "idle") void doScan(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); if (loading === "idle") doDelete(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [doScan, doDelete, loading]);

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-10 pt-6 text-gray-100 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-[-15%] h-[1100px] w-[1100px] rounded-full bg-cyan-500/15 blur-[220px]" />
        <div className="absolute right-[18%] bottom-[-20%] h-[1000px] w-[1000px] rounded-full bg-fuchsia-600/12 blur-[190px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500/80 dark:text-slate-400/70">Repair</p>
          <div className="flex items-center gap-3">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
            <h1 className="text-base font-semibold tracking-wide text-cyan-200">Monitoring - Repair Local Biometric</h1>
            <div className="ml-auto flex items-center gap-2">
              <div className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
                User: {(user as any)?.S_NAMA_LGKP ?? (user as any)?.S_USER_ID ?? "-"}
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <RefreshCcw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Cek & bersihkan data biometrik dan demografis di database perekaman atau pencetakan.</p>
        </header>

        <div className="repair-toolbar border-t border-slate-200/60 bg-white/85 px-5 py-5 dark:border-white/10 dark:bg-slate-900/40">
          <div className="grid gap-4 sm:grid-cols-[2fr_auto_auto] sm:items-start">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500/90 dark:text-slate-400/80">NIK (16 digit)</label>
              <input
                ref={nikRef}
                value={nik}
                onChange={(e) => setNik(e.target.value.replace(/\D/g, "").slice(0, 16))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void doScan(); } }}
                inputMode="numeric" maxLength={16} placeholder="Masukkan NIK"
                className={cx(
                  "w-full rounded-xl border bg-white px-4 py-3 font-mono text-sm tracking-widest text-slate-800 outline-none transition dark:bg-white/5 dark:text-white",
                  "focus:ring-2",
                  nik.length > 0 && !nikValid && "border-rose-400 focus:ring-rose-300/40",
                  nikValid && "border-slate-200 focus:ring-sky-300/60 dark:border-white/10 dark:focus:ring-cyan-500/40"
                )}
              />
              {nik.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Masukkan 16 digit NIK untuk memindai.</p>
              ) : !nikValid ? (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">NIK harus 16 digit angka.</p>
              ) : null}
            </div>

            <div className="self-start sm:justify-self-start">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500/90 dark:text-slate-400/80">Scope</label>
              <div className="ktpel-tabs">
                <button type="button" onClick={() => setScope("rekam")} className={`ktpel-tab${scope === "rekam" ? " ktpel-tab--active" : ""}`}>Perekaman</button>
                <button type="button" onClick={() => setScope("cetak")} className={`ktpel-tab${scope === "cetak" ? " ktpel-tab--active" : ""}`}>Pencetakan</button>
              </div>
            </div>

            <div className="flex flex-col gap-2 self-start sm:flex-row sm:items-start sm:justify-end">
              <button
                type="button" onClick={onReset} disabled={loading !== "idle"}
                className="repair-btn repair-btn--ghost inline-flex items-center gap-2 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.22em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-cyan-400 dark:focus-visible:ring-offset-slate-900"
                title="Reset"
              >
                <RefreshCcw className="h-3.5 w-3.5" /> <span>Reset</span>
              </button>

              <button
                type="button" onClick={doScan} disabled={!nikValid || loading !== "idle"}
                className="repair-btn repair-btn--primary inline-flex items-center gap-2 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-900 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-950 dark:focus-visible:ring-cyan-400 dark:focus-visible:ring-offset-slate-900"
                title="Scan"
              >
                {loading === "scan" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} <span>Scan</span>
              </button>

              <button
                type="button" onClick={doDelete} disabled={!nikValid || loading !== "idle"}
                className="repair-btn repair-btn--danger inline-flex items-center gap-2 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.22em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-rose-400 dark:focus-visible:ring-offset-slate-900"
                title="Bersihkan"
              >
                {loading === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} <span>Bersihkan</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Hasil ===== */}
      {scan && (
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          {/* Kiri */}
          <div className="space-y-4">
            <div className="repair-info-card rounded-2xl border border-slate-200/60 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
              <h3 className="mb-3 text-sm font-semibold">Face</h3>
              {faceBase64 ? (
                <img alt="Face" className="ph-wrap w-full" style={{ aspectRatio: "4 / 5" }} src={`data:image/jpeg;base64,${faceBase64}`} />
              ) : (
                (() => {
                  const src = isFemale
                    ? isDark ? PLACEHOLDER_FEMALE_DARK : PLACEHOLDER_FEMALE_LIGHT
                    : isDark ? PLACEHOLDER_MALE_DARK : PLACEHOLDER_MALE_LIGHT;
                  return (
                    <div className="ph-wrap w-full" style={{ aspectRatio: "4 / 5" }}>
                      <img
                        src={src} alt="" width={480} height={600}
                        className="absolute left-1/2 top-1/2 max-h-[96%] max-w-[96%] -translate-x-1/2 -translate-y-1/2 select-none object-contain"
                        draggable={false}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  );
                })()
              )}
            </div>

            <div className="repair-info-card rounded-2xl border border-slate-200/60 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
              <h3 className="mb-3 text-sm font-semibold">Signature</h3>
              {signBase64 ? (
                <img alt="Signature" className="aspect-video w-full rounded-xl object-contain" src={`data:image/jpeg;base64,${signBase64}`} />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-xl border bg-muted/10 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    <span className="text-xs">Tidak ada signature</span>
                  </div>
                </div>
              )}
            </div>

            <div className="repair-info-card rounded-2xl border border-slate-200/60 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
              <h3 className="mb-2 text-sm font-semibold">Ringkas Biometrik</h3>
              <ul className="text-sm leading-6">
                <li>Faces: <span key={scan.biometric.counts.faces} className="metric-bump font-semibold">{scan.biometric.counts.faces}</span></li>
                <li>Signatures: <span key={scan.biometric.counts.signatures} className="metric-bump font-semibold">{scan.biometric.counts.signatures}</span></li>
              </ul>
            </div>
          </div>

          {/* Kanan */}
          <div className="repair-info-card rounded-2xl border border-slate-200/60 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/60 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Data Penduduk</h3>
              <span
                className={cx(
                  "rounded-full px-2 py-[2px] text-[10px]",
                  scan.personSource === "DEMOGRAPHICS" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                  scan.personSource === "DEMOGRAPHICS_ALL" && "bg-cyan-500/15 text-cyan-700 dark:text-cyan-200",
                  scan.personSource === "NONE" && "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                )}
                title="Sumber record"
              >
                {scan.personSource}
              </span>
            </div>

            {person ? (
              <div className="repair-info-card overflow-hidden rounded-2xl border border-slate-200/60 bg-white/90 p-0 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
                <table className="w-full text-sm">
                  <tbody className="divide-y fade-stagger">
                    <Tr label="NAMA LENGKAP" value={person.NAMA_LGKP} />
                    <Tr label="NIK" value={(user as any)?.S_USER_LEVEL >= 3 ? person.NIK : maskNik(person.NIK)} mono />
                    <Tr label="NO KK" value={person.NO_KK} mono />
                    <Tr label="TEMPAT LAHIR" value={person.TMPT_LHR} />
                    <Tr label="TANGGAL LAHIR" value={person.TGL_LHR} />
                    <Tr label="JENIS KELAMIN" value={person.JENIS_KLMIN} />
                    <Tr label="STATUS PEREKAMAN" value={person.CURRENT_STATUS_CODE} badge />
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-xl border p-10 text-sm text-muted-foreground">
                Data tidak ditemukan pada sumber utama.
              </div>
            )}

            <div className="mt-6">
              <h4 className="mb-2 text-sm font-semibold">Keberadaan Data (indikatif)</h4>
              <div className="repair-info-card overflow-hidden rounded-2xl border border-slate-200/60 bg-white/90 p-0 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
                <table className="w-full text-sm table-minimal">
                  <thead>
                    <tr><th className="px-3 py-2 text-left">Tabel</th><th className="px-3 py-2 text-left">Status</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {BIOMETRIC_TABLES.map((name) => {
                      const status =
                        name === "DEMOGRAPHICS" ? (person ? "ADA" : "TIDAK ADA")
                        : name === "FACES" ? (scan.biometric.counts.faces > 0 ? "ADA" : "TIDAK ADA")
                        : (scan.biometric.counts.signatures > 0 ? "ADA" : "TIDAK ADA");
                      const color = status === "ADA" ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300";
                      return (
                        <tr key={name}>
                          <td className="px-3 py-2">{name}</td>
                          <td className={cx("px-3 py-2 font-medium", color)}>{status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* IRIS */}
            <div className="mt-6">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">IRIS</h3>
                {irisMeta?.sourceCode && (
                  <span className="rounded-full border border-white/15 px-2 py-[2px] text-[10px]">
                    Kode sumber: <strong>{irisMeta.sourceCode}</strong>
                  </span>
                )}
                {irisMeta?.converted && (
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-[2px] text-[10px] text-emerald-100">
                    Otomatis dikonversi ke PNG (JPG2 → PNG)
                  </span>
                )}
                {!!irisMeta?.errors?.length && (
                  <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-[2px] text-[10px] text-amber-100">
                    {irisMeta.errors[0]}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <figure className="flex aspect-square flex-col overflow-hidden rounded-xl border border-white/10 bg-black/20 text-center dark:bg-black/30">
                  <figcaption className="border-b border-white/10 px-3 py-2 text-left text-xs font-semibold text-white/70">Left Iris</figcaption>
                  <div className="flex flex-1 items-center justify-center p-2">
                    {scan?.iris?.left ? (
                      <img alt="Left Iris" src={`data:${irisMime};base64,${scan.iris.left}`} className="h-full w-full rounded-md object-contain" draggable={false} />
                    ) : (<span className="text-xs text-white/50">Tidak ada data</span>)}
                  </div>
                </figure>

                <figure className="flex aspect-square flex-col overflow-hidden rounded-xl border border-white/10 bg-black/20 text-center dark:bg-black/30">
                  <figcaption className="border-b border-white/10 px-3 py-2 text-left text-xs font-semibold text-white/70">Right Iris</figcaption>
                  <div className="flex flex-1 items-center justify-center p-2">
                    {scan?.iris?.right ? (
                      <img alt="Right Iris" src={`data:${irisMime};base64,${scan.iris.right}`} className="h-full w-full rounded-md object-contain" draggable={false} />
                    ) : (<span className="text-xs text-white/50">Tidak ada data</span>)}
                  </div>
                </figure>
              </div>
            </div>

            {/* FINGERS */}
            {scan?.fingers && (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-semibold">Fingers (WSQ → PNG)</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {scan.fingers.items.map((f) => (
                    <figure key={f.name} className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                      <figcaption className="border-b border-white/10 px-3 py-2 text-left text-xs font-semibold text-white/70 uppercase">
                        {f.name.replaceAll("_", " ")}
                      </figcaption>
                      <div className="relative w-full pb-[145%]">
                        <div className="absolute inset-0 p-3">
                          {f.png ? (
                            <img
                              alt={f.name}
                              src={`data:${scan.fingers.mime || "image/png"};base64,${f.png}`}
                              className="h-full w-full rounded-md object-contain bg-white"
                              draggable={false}
                            />
                          ) : f.error ? (
                            <span className="flex h-full items-center justify-center px-2 text-center text-[11px] text-amber-200">
                              No data / {f.error}
                            </span>
                          ) : (
                            <span className="flex h-full items-center justify-center text-xs text-white/50">Tidak ada data</span>
                          )}
                        </div>
                      </div>
                    </figure>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Catatan */}
      <div className="repair-info-card rounded-2xl border border-slate-200/60 bg-white/90 p-4 text-xs shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/60">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" />
          <span>
            Mode <b>perekaman</b>: termasuk hapus <code>Demographics_all</code> dan selaraskan ke database pencetakan.
            Mode <b>pencetakan</b>: hanya bersihkan database pencetakan.
          </span>
        </div>
      </div>

      <NeonModal
        open={modalOpen}
        kind={modalKind}
        title={modalTitle}
        message={modalMsg}
        confirmText={modalKind === "confirm" ? "Ya, lanjut" : "OK"}
        cancelText="Batal"
        loading={saving && modalKind === "confirm"}
        onConfirm={() => { modalOnYes?.(); }}
        onClose={() => !saving && setModalOpen(false)}
      />
    </div>
  );
}

function Tr({ label, value, mono, badge }: { label: string; value: string | number | null | undefined; mono?: boolean; badge?: boolean; }) {
  const v = value ?? "-";
  return (
    <tr>
      <td className="w-48 bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground">{label}</td>
      <td className="px-3 py-2">
        {badge ? (
          <span className="rounded-md bg-cyan-500/15 px-2 py-[2px] text-xs font-medium text-cyan-700 dark:text-cyan-200">{v}</span>
        ) : (
          <span className={mono ? "font-mono" : ""}>{v}</span>
        )}
      </td>
    </tr>
  );
}
