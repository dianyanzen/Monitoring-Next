"use client";

import TypeableSelect from "@/components/ui/TypeableSelect";
// FILE: src/app/report/absensi/page.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useSession } from "@/contexts/session";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Network,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import "./absensi-theme.css";

/* ========= Types ========= */

type StatusState = "online" | "offline" | "idle";
type MachineKey = "DINAS" | "MIM" | "FCL";

type MachineStatus = {
  key: MachineKey;
  name: string;
  ip: string;
  status: StatusState | "pending";
  lastSync: string;
  message: string;
};

type PresenceSnapshot = {
  userId: string;
  nik: string;
  name: string;
  kantor: string;
  level: number | string;
  ipAbsen: string;
  clockIn: string;
  clockOut: string;
  monevUser: string;
  monevIp: string;
  monevLast: string;
  monevStatus: StatusState;
  siakUser: string;
  siakIp: string;
  siakLast: string;
  siakStatus: StatusState;
};

type DailyOption = { id: string; label: string };

type DailyForm = {
  tanggal: string; // YYYY-MM-DD
  aktivitas: string;
  jumlah: string;
  dari: string;
  sampai: string;
  keterangan: string;
};

type ToastKind = "success" | "error" | "info";
type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
};

type SyncBanner = {
  kind: "pending" | "success" | "error";
  message: string;
  key: MachineKey | null;
};

const fallbackAvatar = "/assets/plugins/images/calming-cat.gif";

const defaultMachines: MachineStatus[] = [
  {
    key: "MIM",
    name: "Machine MIM",
    ip: "-",
    status: "offline",
    lastSync: "Belum pernah",
    message: "Menunggu sinkronisasi pertama.",
  },
  {
    key: "FCL",
    name: "Machine FCL",
    ip: "-",
    status: "offline",
    lastSync: "Belum pernah",
    message: "Menunggu sinkronisasi pertama.",
  },
  {
    key: "DINAS",
    name: "Machine DINAS",
    ip: "-",
    status: "offline",
    lastSync: "Belum pernah",
    message: "Menunggu sinkronisasi pertama.",
  },
];

/* ========= Helper ========= */

const todayISO = () => new Date().toISOString().slice(0, 10);

const unwrapPayload = <T,>(raw: any): T =>
  raw && typeof raw === "object" && "data" in raw ? (raw as any).data : (raw as T);

const extractMessage = (raw: any) => {
  if (raw && typeof raw === "object") {
    if (raw.data && typeof raw.data.message === "string") return raw.data.message;
    if (typeof raw.message === "string") return raw.message;
  }
  return "";
};

/**
 * Override khusus kalau akses via localhost.
 * Kalau tidak mau dipaksa, boleh dikosongkan jadi "".
 */
const DEV_LOCALHOST_REAL_IP = "172.16.16.213";

const normalizeIp = (ip?: string | null) => {
  if (!ip) return ip ?? "-";
  const trimmed = ip.trim();
  if (!trimmed) return "-";

  // hilangkan prefix ::ffff:
  const cleaned = trimmed.replace(/^::ffff:/i, "");

  // kalau loopback, paksa ke IP LAN yang diinginkan (khusus dev di mesin sendiri)
  if (cleaned === "::1" || cleaned === "127.0.0.1") {
    return DEV_LOCALHOST_REAL_IP || cleaned;
  }

  return cleaned;
};

function buildSnapshot(user: ReturnType<typeof useSession>["user"]): PresenceSnapshot {
  return {
    userId: user?.S_USER_ID?.toString() ?? "",
    nik: user?.S_NIK?.toString() ?? "",
    name: user?.S_NAMA_LGKP ?? "Petugas Monitoring",
    kantor: user?.S_NAMA_KANTOR ?? "Disdukcapil Kota Bandung",
    level: Number(user?.S_USER_LEVEL ?? 0),
    // IP dari session (hasil getClientInfo di server)
    ipAbsen: normalizeIp((user as any)?.S_IP_ADDRESS) ?? "-",
    clockIn: "-",
    clockOut: "-",
    monevUser: "-",
    monevIp: "-",
    monevLast: "-",
    monevStatus: "offline",
    siakUser: "-",
    siakIp: "-",
    siakLast: "-",
    siakStatus: "offline",
  };
}

function formatDDMMYYYYFromISO(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = `${d.getDate()}`.padStart(2, "0");
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/* ========= Component ========= */

export default function ReportAbsensiPage() {
  const { user } = useSession();
  const [hydrated, setHydrated] = useState(false);

  const [presence, setPresence] = useState<PresenceSnapshot>(
    () => buildSnapshot(user)
  );
  const [machines, setMachines] = useState<MachineStatus[]>(defaultMachines);
  const [syncingKey, setSyncingKey] = useState<MachineKey | null>(null);

  const [dailyOpen, setDailyOpen] = useState(false);
  const [dailyOptions, setDailyOptions] = useState<DailyOption[]>([]);
  const [dailyForm, setDailyForm] = useState<DailyForm>({
    tanggal: todayISO(),
    aktivitas: "",
    jumlah: "",
    dari: "08:00",
    sampai: "17:00",
    keterangan: "",
  });
  const [dailySending, setDailySending] = useState(false);
  const [dailyAllowed, setDailyAllowed] = useState(true);
  const [modal, setModal] = useState<{
    open: boolean;
    kind: ModalKind;
    title: string;
    message: string;
  }>({
    open: false,
    kind: "info",
    title: "Notifikasi",
    message: "",
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [syncBanner, setSyncBanner] = useState<SyncBanner>({
    kind: "pending",
    message: "",
    key: null,
  });

  const userId = useMemo(
    () => (presence.userId || user?.S_USER_ID?.toString() || "").trim(),
    [presence.userId, user]
  );

  // IP yang dipakai ABSENSI: ambil dari session / monev, tidak lagi dari /api/utils/my-ip
  const ipAbsensi = normalizeIp(presence.ipAbsen || presence.monevIp || "-");

  const notify = useCallback(
    (msg: string, kind: ModalKind = "info", title = "Notifikasi") => {
      setModal({ open: true, kind, title, message: msg });
    },
    []
  );

  const reloadInit = useCallback(async () => {
    if (!hydrated || !userId) return;
    try {
      const res = await fetch("/api/report/absensi/init", { method: "GET" });
      if (!res.ok) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any = await res.json();
      const data = unwrapPayload<any>(raw) ?? {};

      setPresence((prev) => ({
        ...prev,
        clockIn: data.clock_in || prev.clockIn,
        clockOut: data.clock_out || prev.clockOut,
        monevUser: data.user_id ?? prev.monevUser,
        monevIp: normalizeIp(data.monev_ip) ?? prev.monevIp,
        monevLast: data.monev_last ?? prev.monevLast,
        monevStatus:
          data.monev_ip && normalizeIp(data.monev_ip) !== "-" ? "online" : "offline",
        siakUser: data.user_siak ?? prev.siakUser,
        siakIp: normalizeIp(data.siak_ip) ?? prev.siakIp,
        siakLast: data.siak_last ?? prev.siakLast,
        siakStatus:
          data.siak_ip && normalizeIp(data.siak_ip) !== "-" ? "online" : "offline",
      }));
    } catch {
      // ignore
    }
  }, [hydrated, userId]);

  /* Hydration guard */
  useEffect(() => {
    setHydrated(true);
  }, []);

  /* Sink session → snapshot */
  useEffect(() => {
    setPresence(buildSnapshot(user));
  }, [user]);

  /* Initial fetch: clock in/out + user online info + opsi daily (API Next.js) */
  useEffect(() => {
    if (!hydrated || !userId) return;

    const fetchDailyOptions = async () => {
      try {
        const res = await fetch("/api/report/absensi/daily-options", {
          method: "GET",
        });
        if (!res.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw: any = await res.json();
        const rows: any[] = unwrapPayload<any[]>(raw) ?? [];

        let i = 1;
        const opts: DailyOption[] = rows.map((r) => {
          const label = `${i}. ${r.activity} (${r.minute} MENIT)`;
          i += 1;
          return { id: String(r.activity_id), label };
        });

        setDailyOptions(opts);
        setDailyForm((prev) => ({
          ...prev,
          aktivitas: prev.aktivitas || opts[0]?.id || "",
        }));
      } catch {
        // ignore
      }
    };

    void reloadInit();
    void fetchDailyOptions();
  }, [hydrated, userId, reloadInit]);

  /* Cek boleh / tidak isi daily saat tanggal berubah (copy logic get_date) */
  useEffect(() => {
    if (!dailyOpen) return;

    const cekTanggal = async () => {
      try {
        const ddmmyyyy = formatDDMMYYYYFromISO(dailyForm.tanggal);
        if (!ddmmyyyy) return;

        const res = await fetch("/api/report/absensi/daily", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            check_date: 1,
            tanggal_report: ddmmyyyy,
          }),
        });

        if (!res.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw: any = await res.json();
        const data: any = unwrapPayload<any>(raw) ?? raw;

        // legacy: message_type 2 → boleh input, 1 → sudah ada / tidak boleh
        if (data.message_type === 2) {
          setDailyAllowed(true);
          setModal((prev) => ({ ...prev, open: false }));
        } else if (data.message_type === 1) {
          setDailyAllowed(false);
          const msg = data.message || "Tanggal ini sudah memiliki daily.";
          setModal({ open: true, kind: "warning", title: "Daily Report", message: msg });
        }
      } catch {
        // fallback: izinkan
        setDailyAllowed(true);
      }
    };

    void cekTanggal();
  }, [dailyForm.tanggal, dailyOpen]);

  /* Sync mesin: MIM/FCL/DINAS */
  const handleSyncMachine = async (key: MachineKey) => {
    const map: Record<MachineKey, "mim" | "fcl" | "dinas"> = {
      MIM: "mim",
      FCL: "fcl",
      DINAS: "dinas",
    };

    setSyncingKey(key);
    setSyncBanner({
      key,
      kind: "pending",
      message: "Memproses permintaan... Mohon tunggu, sistem sedang bekerja.",
    });

    try {
      const res = await fetch("/api/report/absensi/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machine: map[key] }),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any = await res.json().catch(() => ({}));
      const data: any = unwrapPayload<any>(raw) ?? raw;
      const msg =
        extractMessage(raw) ||
        data?.message ||
        (res.ok ? "Sinkronisasi berhasil." : "Gagal sinkron.");

      const now = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });

      setMachines((prev) =>
        prev.map((m) =>
          m.key === key
            ? {
                ...m,
                status: res.ok ? "online" : m.status,
                lastSync: `Hari ini ${now}`,
                message: msg,
              }
            : m
        )
      );

      setSyncBanner({
        key,
        kind: res.ok ? "success" : "error",
        message: msg,
      });
      setToasts((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${key}`,
          kind: res.ok ? "success" : "error",
          message: msg,
        },
      ]);
    } catch {
      const msg = "Gagal menghubungi mesin absensi.";
      setSyncBanner({
        key,
        kind: "error",
        message: msg,
      });
      setToasts((prev) => [
        ...prev,
        { id: `${Date.now()}-${key}`, kind: "error", message: msg },
      ]);
    } finally {
      setSyncingKey(null);
      // auto-hide banner after a few seconds
      setTimeout(() => {
        setSyncBanner((prev) =>
          prev.key === key ? { ...prev, message: "" } : prev
        );
      }, 5500);
    }
  };

  /* Clock in / out (tanpa redirect legacy) */
  const handleClock = async (mode: "in" | "out") => {
    if (!userId) {
      notify("User ID tidak ditemukan di sesi.", "error", "Clock Error");
      return;
    }

    try {
      const res = await fetch("/api/report/absensi/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          // kirim IP yang sama dengan yang ditampilkan (dari session / monev)
          ip_override: ipAbsensi !== "-" ? ipAbsensi : undefined,
        }),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any = await res.json().catch(() => ({}));
      const data: any = unwrapPayload<any>(raw) ?? raw;
      const success = raw?.success !== false && res.ok;
      const msg =
        extractMessage(raw) ||
        data?.message ||
        (success ? "Clock berhasil." : "Clock gagal diproses.");

      notify(
        msg,
        success ? "success" : "error",
        success ? "Clock Berhasil" : "Clock Gagal"
      );

      if (success) {
        setPresence((prev) => ({
          ...prev,
          clockIn: data?.clock_in ?? prev.clockIn,
          clockOut: data?.clock_out ?? prev.clockOut,
        }));
        void reloadInit();
      }
    } catch {
      notify("Gagal menghubungi server absensi.", "error", "Clock Error");
    }
  };

  const goRekapAbsensi = () => {
    if (typeof window !== "undefined") {
      const url = `/report/Rekap`;
      window.open(url, "_blank", "noopener");
    } else {
      setModal({
        open: true,
        kind: "info",
        title: "Rekap Absensi",
        message: "Tidak dapat membuka rekap (window tidak tersedia).",
      });
    }
  };

  const goRekapDaily = () => {
    if (typeof window !== "undefined") {
      const url = `/report/RekapDaily`;
      window.open(url, "_blank", "noopener");
    } else {
      setModal({
        open: true,
        kind: "info",
        title: "Rekap Daily Activity",
        message: "Tidak dapat membuka rekap daily (window tidak tersedia).",
      });
    }
  };

  /* Daily submit */
  const validateDaily = () => {
    if (!dailyForm.jumlah) return "Jumlah aktivitas tidak boleh kosong.";
    if (!dailyForm.keterangan) return "Keterangan tidak boleh kosong.";
    if (dailyForm.keterangan.length > 0 && dailyForm.keterangan.length < 10) {
      return "Keterangan terlalu pendek (min. 10 karakter).";
    }
    return "";
  };

  const handleDailySubmit = async () => {
    const err = validateDaily();
    if (err) {
      setModal({ open: true, kind: "warning", title: "Daily Report", message: err });
      return;
    }
    if (!userId) {
      setModal({
        open: true,
        kind: "error",
        title: "Daily Report",
        message: "User ID tidak ditemukan di sesi.",
      });
      return;
    }
    const tanggalReport = formatDDMMYYYYFromISO(dailyForm.tanggal);
    if (!tanggalReport) {
      setModal({
        open: true,
        kind: "error",
        title: "Daily Report",
        message: "Tanggal report tidak valid.",
      });
      return;
    }

    try {
      setDailySending(true);

      const res = await fetch("/api/report/absensi/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aktivitas: dailyForm.aktivitas,
          tanggal_report: tanggalReport,
          jumlah: dailyForm.jumlah,
          daily_dari: dailyForm.dari,
          daily_sampai: dailyForm.sampai,
          daily_keterangan: dailyForm.keterangan,
        }),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any = await res.json().catch(() => ({}));
      const data: any = unwrapPayload<any>(raw) ?? raw;
      const success = raw?.success !== false && res.ok;

      if (success) {
        const msg =
          extractMessage(raw) || data.message || "Daily report berhasil dikirim.";
        setModal({ open: true, kind: "success", title: "Daily Report", message: msg });
        setDailyForm((prev) => ({
          ...prev,
          jumlah: "",
          keterangan: "",
        }));
        setDailyOpen(false);
      } else {
        const msg =
          extractMessage(raw) ||
          data?.message ||
          "Terjadi kesalahan saat mengirim daily report.";
        setModal({ open: true, kind: "error", title: "Daily Report", message: msg });
      }
    } catch {
      const msg = "Gagal menghubungi server daily report.";
      setModal({ open: true, kind: "error", title: "Daily Report", message: msg });
    } finally {
      setDailySending(false);
    }
  };

  const resetDailyForm = () => {
    setDailyForm({
      tanggal: todayISO(),
      aktivitas: dailyOptions[0]?.id || "",
      jumlah: "",
      dari: "08:00",
      sampai: "17:00",
      keterangan: "",
    });
    setDailyAllowed(true);
    setModal((prev) => ({ ...prev, open: false }));
  };

  if (!hydrated) {
    return (
      <div className="relative mt-5 px-6 pb-10 pt-6 md:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[10%] top-[-15%] h-[900px] w-[900px] rounded-full bg-cyan-500/20 blur-[220px]" />
          <div className="absolute bottom-[-20%] right-[8%] h-[820px] w-[820px] rounded-full bg-fuchsia-500/20 blur-[210px]" />
        </div>
        <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/70 shadow-[0_18px_60px_rgba(0,0,0,0.75)]">
          <div className="flex items-center gap-3 text-slate-200">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Memuat portal absensi…</span>
          </div>
        </div>
      </div>
    );
  }

  const avatarUrl = presence.nik
    ? `/assets/upload/pp/${presence.nik}.jpg`
    : fallbackAvatar;

  return (
    <div className="absensi-report-page relative mt-20 space-y-6 px-6 pb-12 pt-6 md:space-y-8 md:px-8">
      <NeonModal
        open={modal.open}
        kind={modal.kind}
        title={modal.title}
        message={modal.message}
        onClose={() => setModal((prev) => ({ ...prev, open: false }))}
      />
      {toasts.length > 0 && (
        <div className="absensi-toast-stack">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`absensi-toast absensi-toast--${t.kind}`}
              onAnimationEnd={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
            >
              <div className="absensi-toast__dot" />
              <div className="absensi-toast__msg">{t.message}</div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <header className="absensi-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="absensi-pill inline-flex items-center gap-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
            Report / Absensi
          </div>
          <h1 className="absensi-heading mt-3 text-xl font-semibold tracking-wide md:text-2xl">
            My Absensi & Daily Activity
          </h1>
          <p className="absensi-subtitle mt-1 text-sm">
            Satu layar untuk clock in/out, status online SIAK & Monitoring, sinkronisasi mesin absensi, dan pengisian Daily Report.
          </p>
        </div>
        <div className="absensi-pill absensi-pill--mode flex items-center gap-2 px-4 py-1.5 text-xs">
          <Sparkles className="h-4 w-4" />
          <span>Cyberpunk x Elegant Luxe</span>
        </div>
      </header>

      {/* Main grid: kiri = profil + user control, kanan = panel aktivitas + tombol clock */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* KIRI */}
        <div className="space-y-4 lg:col-span-1">
          {/* Banner user + clock display */}
          <section className="absensi-card absensi-card--profile overflow-hidden rounded-3xl">
            <div className="relative h-36 w-full">
              <Image
                src="/assets/plugins/images/wallpaper2.jpg"
                alt="banner"
                fill
                className="object-cover opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-[#0f172a]/55 to-transparent" />
              <div className="relative flex h-full items-end px-4 pb-4">
                <div className="absensi-profile-bar flex items-center gap-3">
                  <div className="relative">
                    <Image
                      src={avatarUrl}
                      alt={presence.name}
                      width={72}
                      height={72}
                      className="h-16 w-16 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = fallbackAvatar;
                      }}
                    />
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-semibold text-slate-950 shadow-[0_0_0_3px_rgba(15,23,42,0.95)]">
                      {presence.level || 0}
                    </span>
                  </div>
                  <div>
                    <p className="absensi-office text-[11px] uppercase tracking-[0.18em]">
                      {presence.kantor}
                    </p>
                    <h2 className="absensi-name text-lg font-semibold">
                      {presence.name}
                    </h2>
                    <p className="absensi-ip text-xs">
                      IP Absensi: {ipAbsensi}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* clock in/out display */}
            <div className="absensi-time grid grid-cols-2">
              <div className="absensi-time__cell absensi-time__cell--in p-4 text-center">
                <p className="absensi-time__label flex items-center justify-center gap-1 text-xs font-semibold">
                  <Clock3 className="h-3 w-3" />
                  Clock In
                </p>
                <p className="absensi-time__value mt-1 text-2xl font-semibold tracking-wide">
                  {presence.clockIn || "-"}
                </p>
              </div>
              <div className="absensi-time__cell absensi-time__cell--out p-4 text-center">
                <p className="absensi-time__label flex items-center justify-center gap-1 text-xs font-semibold">
                  <Clock3 className="h-3 w-3" />
                  Clock Out
                </p>
                <p className="absensi-time__value mt-1 text-2xl font-semibold tracking-wide">
                  {presence.clockOut || "-"}
                </p>
              </div>
            </div>
          </section>

          {/* My User Control */}
          <section className="absensi-card absensi-card--soft space-y-4 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="absensi-section-title text-sm font-semibold tracking-wide">
                My User Control
              </h3>
            </div>

            {/* My SIAK */}
            <div className="absensi-mini-card rounded-xl p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="absensi-mini-card__avatar flex h-7 w-7 items-center justify-center rounded-full text-[12px]">
                    S
                  </div>
                  <div>
                    <p className="absensi-label text-xs uppercase tracking-[0.14em]">
                      My SIAK
                    </p>
                    <p className="absensi-value text-sm font-semibold">
                      {presence.siakUser || "-"}
                    </p>
                  </div>
                </div>
                <span
                  className={`absensi-status ${presence.siakStatus === "online" ? "absensi-status--online" : "absensi-status--offline"}`}
                >
                  {presence.siakStatus === "online" ? "Online" : "Offline"}
                </span>
              </div>
              <div className="absensi-meta mt-2 space-y-0.5 text-[11px]">
                <p>
                  <span className="font-semibold">IP Address:</span>{" "}
                  {presence.siakIp || "-"}
                </p>
                <p>
                  <span className="font-semibold">Last Activity:</span>{" "}
                  {presence.siakLast || "-"}
                </p>
              </div>
            </div>

            {/* My Monitoring */}
            <div className="absensi-mini-card rounded-xl p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="absensi-mini-card__avatar flex h-7 w-7 items-center justify-center rounded-full text-[12px]">
                    M
                  </div>
                  <div>
                    <p className="absensi-label text-xs uppercase tracking-[0.14em]">
                      My Monitoring
                    </p>
                    <p className="absensi-value text-sm font-semibold">
                      {presence.monevUser || "-"}
                    </p>
                  </div>
                </div>
                <span
                  className={`absensi-status ${presence.monevStatus === "online" ? "absensi-status--online" : "absensi-status--offline"}`}
                >
                  {presence.monevStatus === "online" ? "Online" : "Offline"}
                </span>
              </div>
              <div className="absensi-meta mt-2 space-y-0.5 text-[11px]">
                <p>
                  <span className="font-semibold">IP Address:</span>{" "}
                  {presence.monevIp || "-"}
                </p>
                <p>
                  <span className="font-semibold">Last Activity:</span>{" "}
                  {presence.monevLast || "-"}
                </p>
              </div>
            </div>

            {/* Attendance Machine */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-cyan-300" />
                <h4 className="absensi-section-subtitle text-xs font-semibold uppercase tracking-[0.16em]">
                  Attendance Machine
                </h4>
              </div>
              <div className="space-y-2 text-xs">
                {machines.map((m) => (
                  <div
                    key={m.key}
                    className="absensi-machine rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="absensi-machine__label text-[11px] uppercase tracking-[0.16em]">
                          {m.key}
                        </p>
                        <p className="absensi-machine__name text-sm font-semibold">
                          {m.name}
                        </p>
                      </div>
                      <span
                        className={`absensi-status ${
                          m.status === "online"
                            ? "absensi-status--online"
                            : m.status === "offline"
                            ? "absensi-status--offline"
                            : "absensi-status--pending"
                        }`}
                      >
                        {m.status === "online"
                          ? "Online"
                          : m.status === "offline"
                          ? "Offline"
                          : "Menunggu"}
                      </span>
                    </div>
                    <p className="absensi-meta mt-1 text-[11px]">
                      {m.ip} • {m.lastSync}
                    </p>
                    <p className="absensi-meta text-[11px]">{m.message}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="absensi-btn absensi-btn--ghost inline-flex items-center gap-2 text-xs"
                  onClick={() => handleSyncMachine("MIM")}
                  disabled={syncingKey === "MIM"}
                >
                  {syncingKey === "MIM" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="h-3.5 w-3.5" />
                  )}
                  Sync MIM
                </button>
                <button
                  type="button"
                  className="absensi-btn absensi-btn--ghost inline-flex items-center gap-2 text-xs"
                  onClick={() => handleSyncMachine("FCL")}
                  disabled={syncingKey === "FCL"}
                >
                  {syncingKey === "FCL" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="h-3.5 w-3.5" />
                  )}
                  Sync FCL
                </button>
                <button
                  type="button"
                  className="absensi-btn absensi-btn--ghost inline-flex items-center gap-2 text-xs"
                  onClick={() => handleSyncMachine("DINAS")}
                  disabled={syncingKey === "DINAS"}
                >
                  {syncingKey === "DINAS" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="h-3.5 w-3.5" />
                  )}
                  Sync DINAS
                </button>
              </div>
              {syncBanner.message && (
                <div
                  className={`absensi-inline-banner absensi-inline-banner--${syncBanner.kind}`}
                >
                  {syncBanner.kind === "pending" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-[11px] uppercase tracking-[0.12em]">
                      {syncBanner.key ? `Sync ${syncBanner.key}` : "Sync Mesin"}
                    </span>
                    <span className="text-xs">{syncBanner.message}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* KANAN */}
        <div className="space-y-4 lg:col-span-2">
          {/* Panel aktivitas: daily + rekap + excuse info */}
          <section className="absensi-card absensi-card--panel rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="absensi-icon h-4 w-4" />
                <h3 className="absensi-section-title text-sm font-semibold tracking-wide">
                  Panel Aktivitas
                </h3>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Daily Report */}
              <button
                type="button"
                onClick={() => {
                  resetDailyForm();
                  setDailyOpen(true);
                }}
                className="absensi-tile absensi-tile--cyan group flex items-start gap-3 rounded-2xl px-4 py-4 text-left"
              >
                <div className="absensi-tile__icon mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl">
                  <FileText className="absensi-icon h-5 w-5" />
                </div>
                <div>
                  <h4 className="absensi-tile__title text-sm font-semibold">
                    Daily Report
                  </h4>
                  <p className="absensi-tile__desc mt-1 text-xs">
                    Catat aktivitas harianmu lengkap dengan jumlah dan
                    keterangan pekerjaan.
                  </p>
                </div>
              </button>

              {/* Rekap Absensi */}
              <button
                type="button"
                onClick={goRekapAbsensi}
                className="absensi-tile absensi-tile--emerald group flex items-start gap-3 rounded-2xl px-4 py-4 text-left"
              >
                <div className="absensi-tile__icon mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl">
                  <BarChart3 className="absensi-icon h-5 w-5" />
                </div>
                <div>
                  <h4 className="absensi-tile__title text-sm font-semibold">
                    Rekap Absensi
                  </h4>
                  <p className="absensi-tile__desc mt-1 text-xs">
                    Lihat riwayat jam masuk/keluar dari SIAK_ABSENSI harianmu.
                  </p>
                </div>
              </button>

              {/* Rekap Daily Activity */}
              <button
                type="button"
                onClick={goRekapDaily}
                className="absensi-tile absensi-tile--sky group flex items-start gap-3 rounded-2xl px-4 py-4 text-left"
              >
                <div className="absensi-tile__icon mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl">
                  <Activity className="absensi-icon h-5 w-5" />
                </div>
                <div>
                  <h4 className="absensi-tile__title text-sm font-semibold">
                    Rekap Daily Activity
                  </h4>
                  <p className="absensi-tile__desc mt-1 text-xs">
                    Rekapitulasi seluruh Daily Report berdasarkan tanggal dan
                    aktivitas.
                  </p>
                </div>
              </button>

              {/* Excuse (nonaktif) */}
              <div className="absensi-tile absensi-tile--amber flex items-start gap-3 rounded-2xl px-4 py-4 text-left opacity-80">
                <div className="absensi-tile__icon mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl">
                  <AlertTriangle className="absensi-icon h-5 w-5" />
                </div>
                <div>
                  <h4 className="absensi-tile__title text-sm font-semibold">
                    Excuse Claim (Nonaktif)
                  </h4>
                  <p className="absensi-tile__desc mt-1 text-xs">
                    Pengajuan excuse sudah tidak berlaku di monitoring.
                    Koordinasi melalui admin / atasan langsung bila diperlukan.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Panel Clock In / Out */}
          <section className="absensi-card absensi-card--clock rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock3 className="absensi-icon h-4 w-4" />
                <h3 className="absensi-section-title text-sm font-semibold tracking-wide">
                  Clock In / Clock Out
                </h3>
              </div>
              <div className="absensi-meta flex items-center gap-2 text-xs">
                <CalendarDays className="absensi-icon h-3.5 w-3.5" />
                <span>
                  {new Date().toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => handleClock("in")}
                className="absensi-clock absensi-clock--in flex flex-col items-center gap-2 rounded-2xl px-6 py-6 transition hover:translate-y-0.5"
              >
                <CheckCircle2 className="absensi-icon h-9 w-9" />
                <span className="absensi-clock__title text-lg font-semibold tracking-wide">
                  Clock In
                </span>
                <span className="absensi-clock__desc text-[11px]">
                  Klik untuk melakukan absensi masuk via endpoint baru.
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleClock("out")}
                className="absensi-clock absensi-clock--out flex flex-col items-center gap-2 rounded-2xl px-6 py-6 transition hover:translate-y-0.5"
              >
                <AlertTriangle className="absensi-icon h-9 w-9" />
                <span className="absensi-clock__title text-lg font-semibold tracking-wide">
                  Clock Out
                </span>
                <span className="absensi-clock__desc text-[11px]">
                  Klik untuk menyelesaikan absensi pulang hari ini.
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* ===== MODAL DAILY REPORT ===== */}
      {dailyOpen && (
        <div className="absensi-modal__scrim fixed inset-0 z-[999] flex items-center justify-center">
          <div className="absensi-modal w-full max-w-xl rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="absensi-icon h-5 w-5" />
                <h3 className="absensi-section-title text-sm font-semibold tracking-wide">
                  Daily Report
                </h3>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              {/* Tanggal */}
              <div className="grid gap-2 md:grid-cols-[160px,1fr] md:items-center">
                <label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em]">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Tanggal
                </label>
                <input
                  type="date"
                  className="absensi-input w-full rounded-xl border px-3 py-2 text-sm outline-none ring-0 transition"
                  value={dailyForm.tanggal}
                  onChange={(e) =>
                    setDailyForm((prev) => ({
                      ...prev,
                      tanggal: e.target.value,
                    }))
                  }
                />
              </div>

              {/* Aktivitas */}
              <div className="grid gap-2 md:grid-cols-[160px,1fr] md:items-center">
                <label className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Aktivitas
                </label>
                <TypeableSelect
                  className="absensi-input w-full rounded-xl border px-3 py-2 text-sm outline-none ring-0 transition"
                  value={dailyForm.aktivitas}
                  onChange={(e) =>
                    setDailyForm((prev) => ({
                      ...prev,
                      aktivitas: e.target.value,
                    }))
                  }
                  disabled={!dailyAllowed}
                >
                  {dailyOptions.length === 0 ? (
                    <option value="">Memuat aktivitas…</option>
                  ) : (
                    dailyOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))
                  )}
                </TypeableSelect>
              </div>

              {/* Jumlah */}
              <div className="grid gap-2 md:grid-cols-[160px,1fr] md:items-center">
                <label className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Jumlah
                </label>
                <input
                  type="number"
                  min={1}
                  className="absensi-input w-full rounded-xl border px-3 py-2 text-sm outline-none ring-0 transition"
                  value={dailyForm.jumlah}
                  onChange={(e) =>
                    setDailyForm((prev) => ({
                      ...prev,
                      jumlah: e.target.value,
                    }))
                  }
                  disabled={!dailyAllowed}
                />
              </div>

              {/* Dari / Sampai */}
              <div className="grid gap-2 md:grid-cols-[160px,1fr] md:items-center">
                <label className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Rentang Waktu
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    className="absensi-input w-full rounded-xl border px-3 py-2 text-sm outline-none ring-0 transition"
                    value={dailyForm.dari}
                    onChange={(e) =>
                      setDailyForm((prev) => ({
                        ...prev,
                        dari: e.target.value,
                      }))
                    }
                    disabled={!dailyAllowed}
                  />
                  <input
                    type="time"
                    className="absensi-input w-full rounded-xl border px-3 py-2 text-sm outline-none ring-0 transition"
                    value={dailyForm.sampai}
                    onChange={(e) =>
                      setDailyForm((prev) => ({
                        ...prev,
                        sampai: e.target.value,
                      }))
                    }
                    disabled={!dailyAllowed}
                  />
                </div>
              </div>

              {/* Keterangan */}
              <div className="grid gap-2 md:grid-cols-[160px,1fr] md:items-start">
                <label className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Keterangan
                </label>
                <div>
                  <textarea
                    rows={3}
                    maxLength={300}
                    className="absensi-input w-full rounded-xl border px-3 py-2 text-sm outline-none ring-0 transition"
                    placeholder="Isilah dengan singkat, jelas, dan padat (max 300 karakter)."
                    value={dailyForm.keterangan}
                    onChange={(e) =>
                      setDailyForm((prev) => ({
                        ...prev,
                        keterangan: e.target.value,
                      }))
                    }
                    disabled={!dailyAllowed}
                  />
                  <p className="absensi-meta mt-1 text-[11px]">
                    Minimal 10 karakter. Maksimal 300 karakter.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                className="absensi-btn absensi-btn--ghost inline-flex items-center gap-2 text-xs"
                onClick={() => {
                  setDailyOpen(false);
                }}
              >
                Tutup
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="absensi-btn absensi-btn--ghost inline-flex items-center gap-2 text-xs"
                  onClick={resetDailyForm}
                >
                  Reset
                </button>
                <button
                  type="button"
                  disabled={!dailyAllowed || dailySending}
                  className="absensi-btn absensi-btn--primary inline-flex items-center gap-2 text-xs disabled:opacity-70"
                  onClick={handleDailySubmit}
                >
                  {dailySending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Kirim
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

