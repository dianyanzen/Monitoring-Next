"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Loader2, RefreshCcw } from "lucide-react";
import SettingPageHeader from "@/components/setting/SettingPageHeader";
import { DataShell } from "@/components/ui/LoadingOverlay";
import NeonModal from "@/components/ui/NeonModal";
import { useSession } from "@/contexts/session";

const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), {
  ssr: false,
  loading: () => (
    <div className="px-4 py-5 text-sm text-cyan-100/70">
      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
      Menyiapkan tabel...
    </div>
  ),
});

const dayNumbers = Array.from({ length: 31 }, (_, idx) => idx + 1);
type DayNumber = (typeof dayNumbers)[number];
type DayKey = `t${DayNumber}`;
type Row = {
  no: number;
  userId: string;
  nama: string;
  bulan: string;
  kehadiran: number;
  tepatWaktu: number;
  terlambat: number;
} & Record<DayKey, string>;

const todayMonthYear = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

export default function AbsensiBulananPage() {
  useSession(); // memastikan context sesi aktif

  const [period, setPeriod] = useState(() => todayMonthYear());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: "Absensi Bulanan",
    message: "",
  });

  const columns = useMemo(() => {
    const dayCols = dayNumbers.map((day) => ({
      data: `t${day}`,
      title: `Tgl ${day}`,
      className: "dt-body-center",
      width: "72px",
    }));

    return [
      { data: "no", title: "No", className: "dt-body-center", width: "50px" },
      { data: "userId", title: "User ID", width: "110px" },
      { data: "nama", title: "Nama", width: "170px" },
      { data: "bulan", title: "Bulan", className: "dt-body-center", width: "100px" },
      ...dayCols,
      { data: "kehadiran", title: "Kehadiran", className: "dt-body-center", width: "110px" },
      { data: "tepatWaktu", title: "Tepat Waktu", className: "dt-body-center", width: "120px" },
      { data: "terlambat", title: "Terlambat", className: "dt-body-center", width: "110px" },
    ];
  }, []);

  const fetchRows = useCallback(
    async (withOverlay = true) => {
      setError(null);
      setMessage(null);
      withOverlay ? setLoading(true) : setReloading(true);

      try {
        const res = await fetch("/api/report/absensibulanan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tanggal: period }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.success === false) throw new Error(json.message || "Gagal memuat absensi bulanan");

        const rawItems: any[] = Array.isArray(json.data) ? json.data : [];
        const parsed: Row[] = rawItems.map((item, idx) => {
          const valStr = (key: string) => (item?.[key] == null ? "" : String(item[key]));

          const row: Partial<Row> & Record<string, string | number> = {
            no: Number(item?.no ?? idx + 1),
            userId: valStr("userId"),
            nama: valStr("nama"),
            bulan: valStr("bulan") || period,
            kehadiran: Number(item?.kehadiran ?? 0),
            tepatWaktu: Number(item?.tepatWaktu ?? 0),
            terlambat: Number(item?.terlambat ?? 0),
          };

          dayNumbers.forEach((d) => {
            const key = `t${d}`;
            row[key] = valStr(key) || "-";
          });

          return row as Row;
        });

        setRows(parsed);
        if (!parsed.length) setMessage("Tidak ada data untuk periode ini.");
      } catch (e: any) {
        const msg = e?.message || "Gagal memuat absensi bulanan";
        setError(msg);
        setRows([]);
        setModal({ open: true, title: "Absensi Bulanan", message: msg });
      } finally {
        setLoading(false);
        setReloading(false);
      }
    },
    [period]
  );

  useEffect(() => {
    void fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void fetchRows();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fetchRows]);

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      {modal.open && (
        <NeonModal
          open={modal.open}
          title={modal.title}
          message={modal.message}
          onClose={() => setModal((prev) => ({ ...prev, open: false }))}
        />
      )}

      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[8%] top-[-22%] h-[920px] w-[920px] rounded-full bg-cyan-500/12 blur-[220px]" />
        <div className="absolute right-[10%] bottom-[-18%] h-[880px] w-[880px] rounded-full bg-fuchsia-600/10 blur-[200px]" />
      </div>

      <SettingPageHeader
        lead="Report"
        title="Rekap Absensi Bulanan"
        description="Rekap kehadiran per tanggal dalam bulan terpilih beserta total hadir, tepat waktu, dan terlambat."
      />

      <section className="space-y-4 rounded-2xl border border-cyan-800/50 bg-[#0c1220]/70 p-5 shadow-[0_0_28px_#00ffff22]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Bulan (MM-YYYY)</label>
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-32 rounded-lg border border-cyan-700/40 bg-white/5 px-3 py-2 text-sm text-cyan-100 outline-none ring-0"
              placeholder="MM-YYYY"
            />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchRows()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {loading ? "Memuat..." : "Refresh"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-cyan-100/70">
          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/5 px-3 py-1">
            Nilai <span className="font-semibold text-cyan-50">HADIR</span> menandakan ada absensi di tanggal terkait.
          </span>
          <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1">
            Simbol <span className="font-semibold text-fuchsia-50">-</span> berarti tidak ada catatan hadir/masuk.
          </span>
        </div>
        {message ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
            <Calendar className="h-4 w-4" /> {message}
          </div>
        ) : null}
        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
            <Calendar className="h-4 w-4" /> {error}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-cyan-800/40 bg-[#0b0b1a]/80 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-cyan-900/50 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300/70">Rekap Absensi Bulanan</p>
            <h1 className="text-lg font-semibold text-cyan-100">Data Rekap</h1>
          </div>
          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
            Total: <span className="font-semibold text-cyan-50">{rows.length}</span>
          </span>
          {reloading ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100/80">
              <Loader2 className="h-3 w-3 animate-spin" /> Memuat...
            </span>
          ) : null}
        </header>
        <div className="p-4">
          <DataShell loading={loading || reloading} hasData={rows.length > 0}>
            <JQDataTable
              id="dt-absensi-bulanan"
              data={rows as any[]}
              minWidth={3000}
              pageLength={25}
              tableClassName="dt-cyberpunk"
              columns={columns as any[]}
              options={{
                deferRender: true,
                autoWidth: false,
                scrollX: true,
                stripeClasses: [],
                lengthMenu: [
                  [10, 25, 50, 100],
                  [10, 25, 50, 100],
                ],
                dom:
                  "<'dt-top-bar flex items-center justify-between gap-3'<'dt-left flex items-center gap-2'Bl><'dt-right ml-auto'f>>" +
                  "rt" +
                  "<'dt-bottom-bar flex items-center justify-between gap-3'<'dt-info'i><'dt-paging'p>>",
                language: {
                  search: "",
                  searchPlaceholder: "Search...",
                  lengthMenu: "Tampilkan _MENU_ data",
                  info: "Menampilkan _START_-_END_ dari _TOTAL_ data",
                  infoEmpty: "Menampilkan 0 data",
                  paginate: { previous: "<", next: ">" },
                  zeroRecords: "Tidak ada data yang sesuai",
                },
                buttons: [
                  { extend: "copy", text: "Copy" },
                  { extend: "csvHtml5", text: "CSV", bom: true },
                  { extend: "excelHtml5", text: "Excel" },
                  { extend: "print", text: "Print" },
                ],
                order: [[1, "asc"]],
              }}
            />
          </DataShell>
        </div>
      </section>
    </div>
  );
}
