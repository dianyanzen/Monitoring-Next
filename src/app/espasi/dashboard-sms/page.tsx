"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

/* =========================================================
   TYPES
   ========================================================= */

type SmsRow = {
  jenis?: string;
  JENIS?: string;

  server?: string;
  SERVER?: string;

  telepon?: string;
  TELEPON?: string;

  isi_pesan?: string;
  ISI_PESAN?: string;

  tanggal?: string;
  TANGGAL?: string;

  waktu?: string | number;
  WAKTU?: string | number;
};

type ApiEnvelope = {
  success?: boolean;

  data?: {
    rows?: SmsRow[];
    sourceUrl?: string;
  };

  message?: string;
};

type StructuredSms = {
  name: string;
  nik: string;
  layanan: string;
};

type TimelineMessage = {
  row: SmsRow;

  phone: string;
  message: string;
  tanggal: string;

  rawWaktu: string;
  clock: string;

  ms: number;

  structuredInbound: StructuredSms | null;
};

type TransactionItem = {
  id: string;

  inbound?: TimelineMessage;
  outbound?: TimelineMessage;

  startedAtMs: number;
  dayKey: string;
};

type TimelineEntry =
  | {
      type: "day";
      key: string;
      label: string;
    }
  | {
      type: "tx";
      key: string;
      tx: TransactionItem;
    };

/* =========================================================
   CONSTANTS
   ========================================================= */

const API_URL =
  "/api/espasi/disduk-sms-antrian/1";

const OUTBOUND_MATCH_WINDOW_MS =
  3 * 60 * 1000;

/* =========================================================
   BASIC HELPERS
   ========================================================= */

function toText(value: unknown) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value);
}

function rowText(
  row: SmsRow,
  lower: keyof SmsRow,
  upper: keyof SmsRow
) {
  return toText(
    row[lower] ??
      row[upper]
  );
}

function rowNumber(
  row: SmsRow,
  lower: keyof SmsRow,
  upper: keyof SmsRow
) {
  const value =
    row[lower] ??
    row[upper];

  return Number(value ?? 0);
}

/* =========================================================
   SORT
   ========================================================= */

function sortByWaktuAsc(
  rows: SmsRow[]
) {
  return [...rows].sort(
    (a, b) =>
      rowNumber(
        a,
        "waktu",
        "WAKTU"
      ) -
      rowNumber(
        b,
        "waktu",
        "WAKTU"
      )
  );
}

/* =========================================================
   READ MORE
   ========================================================= */

function ReadMore({
  text,
  max = 180,
}: {
  text: string;
  max?: number;
}) {
  const [
    expanded,
    setExpanded,
  ] = useState(false);

  if (text.length <= max) {
    return <span>{text}</span>;
  }

  const shortText =
    text.slice(0, max);

  return (
    <>
      <span>
        {expanded
          ? text
          : `${shortText}...`}
      </span>

      <button
        type="button"
        onClick={() =>
          setExpanded(
            (value) => !value
          )
        }
        className="espasi-sms-read-more"
      >
        {expanded
          ? "lebih sedikit"
          : "selengkapnya"}
      </button>
    </>
  );
}

/* =========================================================
   STRUCTURED SMS PARSER

   FORMAT:
   NAMA#NIK#JENIS_LAYANAN

   CONTOH:
   LULU#1472045308880002#BTC_KELAHIRAN
   ========================================================= */

function parseStructuredSms(
  message: string
): StructuredSms | null {
  const parts =
    message
      .split("#")
      .map((part) =>
        part.trim()
      )
      .filter(Boolean);

  if (parts.length !== 3) {
    return null;
  }

  const [
    name,
    nik,
    layanan,
  ] = parts;

  const nikLike =
    /^\d{10,20}$/.test(
      nik
    );

  if (!nikLike) {
    return null;
  }

  return {
    name,
    nik,
    layanan,
  };
}

/* =========================================================
   SERVICE NAME
   ========================================================= */

function normalizeLayananName(
  value: string
) {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   DATE PARSER
   ========================================================= */

function parseRowDate(
  row: SmsRow
) {
  const raw =
    rowText(
      row,
      "waktu",
      "WAKTU"
    ).replace(/\D/g, "");

  /*
   * FORMAT:
   * YYYYMMDDHHMMSS
   */

  if (raw.length >= 14) {
    const year =
      Number(
        raw.slice(0, 4)
      );

    const month =
      Number(
        raw.slice(4, 6)
      );

    const day =
      Number(
        raw.slice(6, 8)
      );

    const hour =
      Number(
        raw.slice(8, 10)
      );

    const minute =
      Number(
        raw.slice(10, 12)
      );

    const second =
      Number(
        raw.slice(12, 14)
      );

    const date =
      new Date(
        year,
        month - 1,
        day,
        hour,
        minute,
        second
      );

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return {
        dt: date,
        raw: raw.slice(
          0,
          14
        ),
      };
    }
  }

  /*
   * FALLBACK:
   * DD-MM-YYYY HH:mm:ss
   */

  const tanggal =
    rowText(
      row,
      "tanggal",
      "TANGGAL"
    );

  const match =
    tanggal.match(
      /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/
    );

  if (match) {
    const [
      ,
      dd,
      mm,
      yyyy,
      hh,
      mi,
      ss,
    ] = match;

    const date =
      new Date(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh),
        Number(mi),
        Number(ss)
      );

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return {
        dt: date,
        raw: `${yyyy}${mm}${dd}${hh}${mi}${ss}`,
      };
    }
  }

  return {
    dt: new Date(0),
    raw: "0",
  };
}

/* =========================================================
   DATE HELPERS
   ========================================================= */

function dayKeyFromDate(
  date: Date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dayLabelFromDate(
  date: Date
) {
  return new Intl.DateTimeFormat(
    "id-ID",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  )
    .format(date)
    .toUpperCase();
}

function extractClockText(
  tanggal: string,
  fallbackDate: Date
) {
  const clock =
    tanggal.split(" ")[1];

  if (clock) {
    return clock;
  }

  return [
    fallbackDate.getHours(),
    fallbackDate.getMinutes(),
    fallbackDate.getSeconds(),
  ]
    .map((value) =>
      String(value).padStart(
        2,
        "0"
      )
    )
    .join(":");
}

/* =========================================================
   MESSAGE TYPE
   ========================================================= */

function isInboundRow(
  row: SmsRow
) {
  return (
    rowText(
      row,
      "jenis",
      "JENIS"
    ).toLowerCase() ===
    "by-other"
  );
}

function isFormatWarningOutbound(
  message: string
) {
  return /mohon cek kembali jenis format layanan/i.test(
    message
  );
}

/* =========================================================
   BUILD TIMELINE
   ========================================================= */

function buildTimelineEntries(
  rows: SmsRow[]
): TimelineEntry[] {
  const sorted =
    sortByWaktuAsc(rows);

  const pendingInboundByPhone =
    new Map<
      string,
      TransactionItem[]
    >();

  const transactions: TransactionItem[] =
    [];

  sorted.forEach(
    (row, index) => {
      const inbound =
        isInboundRow(row);

      const phone =
        rowText(
          row,
          "telepon",
          "TELEPON"
        ) || "-";

      const message =
        rowText(
          row,
          "isi_pesan",
          "ISI_PESAN"
        ) || "-";

      const tanggal =
        rowText(
          row,
          "tanggal",
          "TANGGAL"
        ) || "-";

      const parsedDate =
        parseRowDate(row);

      const timelineMessage: TimelineMessage =
        {
          row,

          phone,
          message,
          tanggal,

          rawWaktu:
            parsedDate.raw,

          clock:
            extractClockText(
              tanggal,
              parsedDate.dt
            ),

          ms:
            parsedDate.dt.getTime(),

          structuredInbound:
            inbound
              ? parseStructuredSms(
                  message
                )
              : null,
        };

      /* =====================================================
         INBOUND
         ===================================================== */

      if (inbound) {
        const transaction: TransactionItem =
          {
            id: `${phone}-${parsedDate.raw}-${index}`,

            inbound:
              timelineMessage,

            startedAtMs:
              timelineMessage.ms,

            dayKey:
              dayKeyFromDate(
                parsedDate.dt
              ),
          };

        transactions.push(
          transaction
        );

        const queue =
          pendingInboundByPhone.get(
            phone
          ) ?? [];

        queue.push(
          transaction
        );

        pendingInboundByPhone.set(
          phone,
          queue
        );

        return;
      }

      /* =====================================================
         OUTBOUND
         ===================================================== */

      const queue =
        pendingInboundByPhone.get(
          phone
        ) ?? [];

      const matchIndex =
        queue.findIndex(
          (candidate) => {
            if (
              !candidate.inbound
            ) {
              return false;
            }

            const difference =
              timelineMessage.ms -
              candidate.inbound.ms;

            return (
              difference >= 0 &&
              difference <=
                OUTBOUND_MATCH_WINDOW_MS &&
              !candidate.outbound
            );
          }
        );

      if (matchIndex >= 0) {
        const transaction =
          queue[matchIndex];

        transaction.outbound =
          timelineMessage;

        queue.splice(
          matchIndex,
          1
        );

        pendingInboundByPhone.set(
          phone,
          queue
        );

        return;
      }

      /*
       * OUTBOUND TANPA INBOUND
       */

      transactions.push({
        id: `${phone}-${parsedDate.raw}-out-${index}`,

        outbound:
          timelineMessage,

        startedAtMs:
          timelineMessage.ms,

        dayKey:
          dayKeyFromDate(
            parsedDate.dt
          ),
      });
    }
  );

  transactions.sort(
    (a, b) =>
      a.startedAtMs -
      b.startedAtMs
  );

  const entries: TimelineEntry[] =
    [];

  let lastDay = "";

  transactions.forEach(
    (transaction) => {
      if (
        transaction.dayKey !==
        lastDay
      ) {
        const date =
          new Date(
            transaction.startedAtMs
          );

        entries.push({
          type: "day",

          key: `day-${transaction.dayKey}`,

          label:
            dayLabelFromDate(
              date
            ),
        });

        lastDay =
          transaction.dayKey;
      }

      entries.push({
        type: "tx",

        key: `tx-${transaction.id}`,

        tx: transaction,
      });
    }
  );

  return entries;
}

/* =========================================================
   MESSAGE HEADER
   ========================================================= */

function MessageHeader({
  message,
  inbound,
}: {
  message: TimelineMessage;
  inbound: boolean;
}) {
  return (
    <div
      className={`
        espasi-sms-message-header
        ${inbound ? "is-inbound" : "is-outbound"}
      `}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {/* AVATAR */}

        <div
          className={`
            espasi-sms-avatar
            ${inbound ? "is-inbound" : "is-outbound"}
          `}
        >
          {inbound
            ? "IN"
            : "OUT"}
        </div>

        {/* IDENTITY */}

        <div className="min-w-0">
          <div className="espasi-sms-phone truncate">
            {message.phone}
          </div>

          <div className="espasi-sms-message-type">
            {inbound
              ? "Pesan masuk"
              : "Pesan keluar"}
          </div>
        </div>
      </div>

      {/* BADGE */}

      <span
        className={`
          espasi-sms-direction-badge
          ${inbound ? "is-inbound" : "is-outbound"}
        `}
      >
        {inbound
          ? "MASUK"
          : "KELUAR"}
      </span>
    </div>
  );
}

/* =========================================================
   STRUCTURED INBOUND
   ========================================================= */

function StructuredInbound({
  data,
}: {
  data: StructuredSms;
}) {
  return (
    <div className="space-y-2">
      {/* NAME */}

      <div className="espasi-sms-structured-name">
        {data.name}
      </div>

      {/* NIK */}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="espasi-sms-field-label">
          NIK
        </span>

        <span className="espasi-sms-field-value font-mono">
          {data.nik}
        </span>
      </div>

      {/* LAYANAN */}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="espasi-sms-field-label">
          Layanan
        </span>

        <span className="espasi-sms-field-value">
          {normalizeLayananName(
            data.layanan
          )}
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   MESSAGE BUBBLE
   ========================================================= */

function MessageBubble({
  item,
  inbound,
}: {
  item: TimelineMessage;
  inbound: boolean;
}) {
  const structured =
    inbound
      ? item.structuredInbound
      : null;

  return (
    <div
      className={`
        flex
        w-full
        ${
          inbound
            ? "justify-start pr-[12%]"
            : "justify-end pl-[12%]"
        }
      `}
    >
      <div
        className={`
          espasi-sms-bubble
          ${inbound ? "is-inbound" : "is-outbound"}
        `}
      >
        <div className="p-3.5">
          {/* HEADER */}

          <MessageHeader
            message={item}
            inbound={inbound}
          />

          {/* BODY */}

          <div className="espasi-sms-message-body">
            {structured ? (
              <StructuredInbound
                data={structured}
              />
            ) : (
              <ReadMore
                text={item.message}
                max={220}
              />
            )}
          </div>

          {/* FOOTER */}

          <div
            className={`
              espasi-sms-message-footer
              ${inbound ? "is-inbound" : "is-outbound"}
            `}
          >
            <span className="espasi-sms-clock">
              {item.clock}
            </span>

            <span className="espasi-sms-state">
              {inbound
                ? "Received"
                : "Sent"}
            </span>
          </div>

          {/* RAW DATA */}

          <details className="espasi-sms-raw-details">
            <summary className="espasi-sms-raw-summary">
              <span className="mr-1">
                ▶
              </span>

              Read More
            </summary>

            <div className="espasi-sms-raw-grid">
              <span className="espasi-sms-raw-label">
                JENIS
              </span>

              <span className="espasi-sms-raw-value">
                {rowText(
                  item.row,
                  "jenis",
                  "JENIS"
                ) || "-"}
              </span>

              <span className="espasi-sms-raw-label">
                WAKTU
              </span>

              <span className="espasi-sms-raw-value font-mono">
                {item.rawWaktu ||
                  "-"}
              </span>

              <span className="espasi-sms-raw-label">
                TANGGAL
              </span>

              <span className="espasi-sms-raw-value">
                {item.tanggal ||
                  "-"}
              </span>

              <span className="espasi-sms-raw-label">
                TELEPON
              </span>

              <span className="espasi-sms-raw-value">
                {item.phone ||
                  "-"}
              </span>

              <span className="espasi-sms-raw-label">
                SERVER
              </span>

              <span className="espasi-sms-raw-value">
                {rowText(
                  item.row,
                  "server",
                  "SERVER"
                ) || "1"}
              </span>

              <span className="espasi-sms-raw-label">
                ISI
              </span>

              <span className="espasi-sms-raw-value whitespace-pre-wrap">
                {item.message ||
                  "-"}
              </span>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   TRANSACTION STATUS
   ========================================================= */

function TransactionStatus({
  transaction,
}: {
  transaction: TransactionItem;
}) {
  if (
    transaction.inbound &&
    transaction.outbound
  ) {
    if (
      isFormatWarningOutbound(
        transaction.outbound
          .message
      )
    ) {
      return (
        <div className="espasi-sms-status is-warning">
          FORMAT TIDAK SESUAI
        </div>
      );
    }

    return (
      <div className="espasi-sms-status is-success">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

        TRANSAKSI SELESAI
      </div>
    );
  }

  if (
    transaction.inbound &&
    !transaction.outbound
  ) {
    if (
      !transaction.inbound
        .structuredInbound
    ) {
      return (
        <div className="espasi-sms-status is-warning">
          FORMAT BELUM SESUAI
        </div>
      );
    }

    return (
      <div className="espasi-sms-status is-pending">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />

        MENUNGGU RESPONS
      </div>
    );
  }

  return (
    <div className="espasi-sms-status is-neutral">
      RESPONS TANPA REQUEST
    </div>
  );
}

/* =========================================================
   DAY SEPARATOR
   ========================================================= */

function DaySeparator({
  label,
}: {
  label: string;
}) {
  return (
    <div className="sticky top-0 z-10 flex justify-center py-2">
      <div className="espasi-sms-day-separator">
        {label}
      </div>
    </div>
  );
}

/* =========================================================
   PANEL
   ========================================================= */

function Panel({
  title,
  modemLabel,
  rows,
  boxRef,
}: {
  title: string;
  modemLabel: string;
  rows: SmsRow[];
  boxRef: RefObject<
    HTMLDivElement | null
  >;
}) {
  const total =
    rows.length;

  const timeline =
    useMemo(
      () =>
        buildTimelineEntries(
          rows
        ),
      [rows]
    );

  return (
    <article className="espasi-sms-panel">
      {/* ===================================================
          PANEL HEADER
          =================================================== */}

      <header className="espasi-sms-panel-header">
        {/* LEFT */}

        <div className="flex items-center gap-3">
          <div className="espasi-sms-server-badge">
            {modemLabel}
          </div>

          <div className="espasi-sms-online">
            <span className="espasi-sms-online-dot" />

            ONLINE
          </div>
        </div>

        {/* RIGHT */}

        <div className="text-right">
          <div className="espasi-sms-panel-title">
            {title}
          </div>

          <div className="espasi-sms-panel-count">
            {total.toLocaleString(
              "id-ID"
            )}{" "}
            pesan
          </div>
        </div>
      </header>

      {/* ===================================================
          CHAT AREA
          =================================================== */}

      <div
        ref={boxRef}
        className="espasi-sms-chat"
      >
        {rows.length === 0 ? (
          <div className="espasi-sms-empty">
            <div className="espasi-sms-empty-icon">
              SMS
            </div>

            <span className="espasi-sms-empty-text">
              Belum ada pesan
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {timeline.map(
              (entry) => {
                /* DAY */

                if (
                  entry.type ===
                  "day"
                ) {
                  return (
                    <DaySeparator
                      key={
                        entry.key
                      }
                      label={
                        entry.label
                      }
                    />
                  );
                }

                /* TRANSACTION */

                const transaction =
                  entry.tx;

                return (
                  <div
                    key={
                      entry.key
                    }
                    className="espasi-sms-transaction"
                  >
                    {/* INBOUND */}

                    {transaction.inbound ? (
                      <MessageBubble
                        item={
                          transaction.inbound
                        }
                        inbound={
                          true
                        }
                      />
                    ) : null}

                    {/* OUTBOUND */}

                    {transaction.outbound ? (
                      <MessageBubble
                        item={
                          transaction.outbound
                        }
                        inbound={
                          false
                        }
                      />
                    ) : null}

                    {/* STATUS */}

                    <TransactionStatus
                      transaction={
                        transaction
                      }
                    />
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/* =========================================================
   PAGE
   ========================================================= */

export default function DashboardSmsPage() {
  const [
    rows,
    setRows,
  ] = useState<SmsRow[]>(
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    sourceUrl,
    setSourceUrl,
  ] = useState("");

  const boxRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const totalMessages =
    useMemo(
      () => rows.length,
      [rows.length]
    );

  /* =======================================================
     LOAD API
     ======================================================= */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response =
        await fetch(
          API_URL,
          {
            cache:
              "no-store",
          }
        );

      const json =
        (await response
          .json()
          .catch(
            () => null
          )) as
          | ApiEnvelope
          | null;

      if (
        !response.ok ||
        !json?.success
      ) {
        throw new Error(
          json?.message ||
            "Gagal memuat data modem 1"
        );
      }

      return {
        rows:
          sortByWaktuAsc(
            Array.isArray(
              json.data
                ?.rows
            )
              ? json.data.rows
              : []
          ),

        sourceUrl:
          toText(
            json.data
              ?.sourceUrl
          ),
      };
    }

    async function loadModem1() {
      if (!cancelled) {
        setLoading(
          true
        );

        setError("");
      }

      try {
        const data =
          await load();

        if (
          cancelled
        ) {
          return;
        }

        setRows(
          data.rows
        );

        setSourceUrl(
          data.sourceUrl
        );
      } catch (
        errorValue
      ) {
        if (
          !cancelled
        ) {
          setError(
            errorValue instanceof
              Error
              ? errorValue.message
              : "Gagal memuat dashboard SMS"
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false
          );
        }
      }
    }

    void loadModem1();

    const timer =
      setInterval(
        () => {
          void loadModem1();
        },
        7000
      );

    return () => {
      cancelled =
        true;

      clearInterval(
        timer
      );
    };
  }, []);

  /* =======================================================
     AUTO SCROLL
     ======================================================= */

  useEffect(() => {
    const node =
      boxRef.current;

    if (!node) {
      return;
    }

    node.scrollTop =
      node.scrollHeight;
  }, [rows]);

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="cp espasi-sms-page mt-10">
      <div className="espasi-sms-container">
        {/* =================================================
            DASHBOARD HEADER
            ================================================= */}

        <header className="espasi-sms-dashboard-header">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* TITLE */}

            <div>
              <div className="espasi-sms-dashboard-title">
                Dashboard SMS Antrian
              </div>

              <div className="espasi-sms-dashboard-subtitle">
                Monitoring
                Espasi server secara
                realtime
              </div>
            </div>

            {/* STATUS */}

            <div
              className={`
                espasi-sms-loading
                ${
                  loading
                    ? "is-loading"
                    : "is-ready"
                }
              `}
            >
              <span
                className={`
                  espasi-sms-loading-dot
                  ${
                    loading
                      ? "is-loading"
                      : "is-ready"
                  }
                `}
              />

              {loading
                ? "Refreshing"
                : "Ready"}
            </div>
          </div>

          {/* METADATA */}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {/* TOTAL */}

            <span className="espasi-sms-chip is-total">
              Total:{" "}
              {totalMessages.toLocaleString(
                "id-ID"
              )}
            </span>

            {/* SERVER */}

            <span className="espasi-sms-chip">
              Server: Espasi Gateway
            </span>

          
          </div>

          {/* ERROR */}

          {error ? (
            <div className="espasi-sms-error">
              {error}
            </div>
          ) : null}
        </header>

        {/* =================================================
            SMS PANEL

            PENTING:
            menggunakan div/article,
            bukan section,
            untuk menghindari global
            section theme override.
            ================================================= */}

        <div className="mt-4 grid grid-cols-1 gap-4">
          <Panel
            title="Espasi Gateway"
            modemLabel="SERVER Espasi"
            rows={rows}
            boxRef={boxRef}
          />
        </div>
      </div>

    </div>
  );
}