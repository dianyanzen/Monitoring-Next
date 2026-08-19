// FILE: src/app/espasi/loket/dinas/baru/page.tsx
"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Loader2,
  PhoneCall,
  Printer,
  RefreshCw,
  RotateCw,
  Search,
  ShieldCheck,
  SkipForward,
  X,
} from "lucide-react";

import {
  createPortal,
} from "react-dom";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

/* =========================================================
   CONFIG
   ========================================================= */

const TITLE =
  "Antrian Verifikasi Baru";

const QUEUE_ENDPOINT =
  "/api/espasi/antrian-loket";

const STATUS_ENDPOINT =
  "/api/espasi/antrian-loket-update";

const TRACKING_MASTER_ENDPOINT =
  "/api/tracking-pengajuan/master";

const TRACKING_ENDPOINT =
  "/api/tracking-pengajuan";

const NIK_LOOKUP_ENDPOINT =
  "/api/tracking-pengajuan/lookup-nik";

const KTP_META_ENDPOINT =
  "/api/check/ktpel/meta";

const KELURAHAN_ENDPOINT =
  "/api/check/ktpel/kelurahan";

const RECEIPT_ENDPOINT =
  "/api/espasi/receipt";

const POLL_INTERVAL_MS =
  5000;

const DEFAULT_LOCATION =
  "DISDUK";

const DEFAULT_LOKET =
  "A";

const PAGE_SIZE_OPTIONS = [
  15,
  25,
  50,
  100,
];

const LOKET_OPTIONS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
];

/*
 * Lokasi ESPASI -> M_TRACKING_LOCATION.LOCATION_CODE
 *
 * DINAS / DISDUK sengaja dipetakan ke 00.
 */
const QUEUE_LOCATION_TO_TRACKING_CODE: Record<
  string,
  string
> = {
  DINAS: "00",
  DISDUK: "00",

  KIWARI: "31",
  FCL: "31",

  BTC: "32",
  MIM: "33",
  DPRD: "34",
  GPP: "35",
  MPP: "36",
  MEPELING: "40",
};

/*
 * Mapping layanan antrian -> tracking.
 *
 * Yang tidak ada di object ini menggunakan
 * kode layanan antrian secara langsung.
 */
const QUEUE_SERVICE_TO_TRACKING_CODE: Record<
  string,
  string
> = {
  PINDAH_KELUAR: "SKP",

  AKTA_KELAHIRAN: "AKL",
  AKTA_KEMATIAN: "AKM",
  AKTA_PENGANGKATAN_ANAK: "PAT",
  AKTA_PENGESAHAN_ANAK: "PSA",
  AKTA_PERCERAIAN: "AKC",
  AKTA_PERKAWINAN: "AKP",

  BTC_KELAHIRAN: "AKL",
  BTC_KEMATIAN: "AKM",
  BTC_KIA: "KIA",
  BTC_PENGAMBILAN: "PENGAMBILAN",
  BTC_PERBAIKAN_DATA: "KK",
  BTC_PEREKAMAN: "KTPR",

  DPRD_KELAHIRAN: "AKL",
  DPRD_KEMATIAN: "AKM",
  DPRD_KIA: "KIA",
  DPRD_PENGAMBILAN: "PENGAMBILAN",
  DPRD_PERBAIKAN_DATA: "KK",
  DPRD_PEREKAMAN: "KTPR",

  FCL_KELAHIRAN: "AKL",
  FCL_KEMATIAN: "AKM",
  FCL_KIA: "KIA",
  FCL_PENGAMBILAN: "PENGAMBILAN",
  FCL_PERBAIKAN_DATA: "KK",
  FCL_PEREKAMAN: "KTPR",

  KIWARI_KELAHIRAN: "AKL",
  KIWARI_KEMATIAN: "AKM",
  KIWARI_KIA: "KIA",
  KIWARI_PENGAMBILAN: "PENGAMBILAN",
  KIWARI_PEREKAMAN: "KTPR",

  MIM_KELAHIRAN: "AKL",
  MIM_KEMATIAN: "AKM",
  MIM_KIA: "KIA",
  MIM_PENGAMBILAN: "PENGAMBILAN",
  MIM_PERBAIKAN_DATA: "KK",
  MIM_PEREKAMAN: "KTPR",

  NON_PERMANEN: "BNP",
  SKTS: "BNP",

  PERBAIKAN_AKTA: "PBT",
  PERBAIKAN_DATA: "KK",
  PERBAIKAN_NAMA: "PNA",

  LEGALISASI: "LEG",
  LEGALISIR: "LEG",

  CATATAN_PINGGIR: "KAS",
};

/*
 * Jenis layanan yang memang tidak menghasilkan resi
 * dari ESPASI.
 */
const NO_RECEIPT_CODES = new Set([
  "PENGAMBILAN",
  "KTPR",
]);

/* =========================================================
   TYPES
   ========================================================= */

type CallState =
  | "Panggil"
  | "Ulangi"
  | "Selesai";

type QueueRow = {
  NIK?: string;
  NAMA?: string;
  KODE_PELAYANAN?: string;
  URUTAN?: string | number;
  STATUS_PELAYANAN?: string;
  TGL_PELAYANAN?: string;
  HARI?: string;
  TELEPON?: string;
  LOKASI?: string;
  JAM?: string;
  EMAIL?: string;
  NO_KECAMATAN?: string | number;
  NO_KEC?: string | number;
  NO_KELURAHAN?: string | number;
  NO_KEL?: string | number;
  RT?: string | number;
  RW?: string | number;
  ALAMAT?: string;
  [key: string]: unknown;
};

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

type QueuePayload = {
  antrian?: QueueRow[];
  urutan_sekarang?: QueueRow | null;
  access?: EspasiAccess;
};

type EspasiAccess = {
  username?: string;
  name?: string;
  roleName?: string;
  lokasi?: string;
  loket?: string;
  isAdmin?: boolean;
  hasAccess?: boolean;
  canAction?: boolean;
};

type TrackingLocation = {
  locationId: number;
  code: string;
  name: string;
  type?: string;
};

type TrackingProduct = {
  productId: number;
  code: string;
  name: string;
};

type TrackingRelation = {
  locationId: number;
  productId: number;
};

type TrackingMaster = {
  locations: TrackingLocation[];
  products: TrackingProduct[];
  relations: TrackingRelation[];
};

type WilayahOption = {
  value: string;
  label: string;
};

type KtpelMeta = {
  defaults: {
    noProp: string;
    noKab: string;
    noKec: string;
    noKel: string;
  };
  wilayah: {
    kecamatan: WilayahOption[];
    kelurahan: WilayahOption[];
  };
};

type TrackingForm = {
  locationId: string;
  productId: string;

  locationName: string;
  productName: string;

  nik: string;
  name: string;

  queueNumber: string;

  phone: string;
  email: string;

  noKec: string;
  noKel: string;

  kecamatanName: string;
  kelurahanName: string;

  rt: string;
  rw: string;

  alamat: string;
};

type ReceiptPrompt = {
  trackingId: number;
  registrationNo: string;
  canPrint: boolean;
};

const EMPTY_TRACKING_FORM: TrackingForm = {
  locationId: "",
  productId: "",

  locationName: "",
  productName: "",

  nik: "",
  name: "",

  queueNumber: "",

  phone: "",
  email: "",

  noKec: "",
  noKel: "",

  kecamatanName: "",
  kelurahanName: "",

  rt: "",
  rw: "",

  alamat: "",
};

/* =========================================================
   HELPERS
   ========================================================= */

function text(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

function rowValue(
  row: QueueRow | null | undefined,
  key: keyof QueueRow,
): string {
  if (!row) {
    return "";
  }

  const source =
    row as Record<
      string,
      unknown
    >;

  return text(
    source[key] ??
      source[
        String(key).toLowerCase()
      ],
  );
}

function normalizeCode(
  value: unknown,
): string {
  return text(value)
    .replace(/\s+/g, "_")
    .toUpperCase();
}

function rowIdentity(
  row: QueueRow | null | undefined,
): string {
  if (!row) {
    return "";
  }

  return [
    rowValue(row, "NIK"),
    rowValue(row, "URUTAN"),
    rowValue(row, "TELEPON"),
  ].join("|");
}

/**
 * Ambil antrean dengan nomor URUTAN paling kecil.
 * Dipakai hanya ketika panel belum memiliki antrean aktif.
 * Pilihan petugas yang sudah ada tidak pernah ditimpa.
 */
function smallestQueueRow(
  rows: QueueRow[],
): QueueRow | null {
  if (!rows.length) {
    return null;
  }

  return (
    [...rows]
      .filter((row) => rowValue(row, "URUTAN") !== "")
      .sort((a, b) => {
        const aNumber = Number(
          rowValue(a, "URUTAN"),
        );
        const bNumber = Number(
          rowValue(b, "URUTAN"),
        );

        const aValid = Number.isFinite(aNumber);
        const bValid = Number.isFinite(bNumber);

        if (aValid && bValid) {
          return aNumber - bNumber;
        }

        if (aValid) return -1;
        if (bValid) return 1;

        return rowValue(a, "URUTAN").localeCompare(
          rowValue(b, "URUTAN"),
          undefined,
          { numeric: true },
        );
      })[0] ?? null
  );
}

function searchBucket(
  row: QueueRow,
): string {
  return [
    rowValue(row, "NIK"),
    rowValue(row, "NAMA"),
    rowValue(row, "KODE_PELAYANAN"),
    rowValue(row, "URUTAN"),
    rowValue(row, "STATUS_PELAYANAN"),
    rowValue(row, "TGL_PELAYANAN"),
    rowValue(row, "HARI"),
    rowValue(row, "TELEPON"),
    rowValue(row, "LOKASI"),
  ]
    .join(" ")
    .toUpperCase();
}

function cleanDigits(
  value: unknown,
): string {
  return text(value).replace(
    /\D/g,
    "",
  );
}

function normalizeWilayahCode(
  value: unknown,
): string {
  return cleanDigits(value);
}

function findWilayahLabel(
  options: WilayahOption[],
  value: unknown,
): string {
  const target =
    normalizeWilayahCode(value);

  if (!target || target === "0") {
    return "";
  }

  return (
    options.find(
      (item) =>
        normalizeWilayahCode(
          item.value,
        ) === target,
    )?.label ?? ""
  );
}

function queueServiceToTrackingCode(
  value: unknown,
): string {
  const code =
    normalizeCode(value);

  return (
    QUEUE_SERVICE_TO_TRACKING_CODE[
      code
    ] ?? code
  );
}

function resolveTrackingLocation(
  locations: TrackingLocation[],
  queueLocation: unknown,
): TrackingLocation | null {
  const raw =
    normalizeCode(
      queueLocation,
    );

  const mapped =
    QUEUE_LOCATION_TO_TRACKING_CODE[
      raw
    ];

  if (!mapped) {
    return null;
  }

  return (
    locations.find(
      (location) =>
        normalizeCode(
          location.code,
        ) === mapped,
    ) ?? null
  );
}

function resolveTrackingProduct(
  products: TrackingProduct[],
  queueService: unknown,
): TrackingProduct | null {
  const code =
    queueServiceToTrackingCode(
      queueService,
    );

  return (
    products.find(
      (product) =>
        normalizeCode(
          product.code,
        ) === code,
    ) ?? null
  );
}

function relationAllowed(
  relations: TrackingRelation[],
  locationId: number,
  productId: number,
): boolean {
  return relations.some(
    (relation) =>
      Number(
        relation.locationId,
      ) === locationId &&
      Number(
        relation.productId,
      ) === productId,
  );
}

function receiptAllowed(
  productCode: string,
): boolean {
  return !NO_RECEIPT_CODES.has(
    normalizeCode(productCode),
  );
}

function downloadCsv(
  rows: QueueRow[],
) {
  const header = [
    "NO",
    "URUTAN",
    "NIK",
    "NAMA",
    "LAYANAN",
    "STATUS",
    "TANGGAL",
    "HARI",
    "TELEPON",
  ];

  const body =
    rows.map(
      (row, index) =>
        [
          index + 1,
          rowValue(
            row,
            "URUTAN",
          ),
          rowValue(
            row,
            "NIK",
          ),
          rowValue(
            row,
            "NAMA",
          ),
          rowValue(
            row,
            "KODE_PELAYANAN",
          ),
          rowValue(
            row,
            "STATUS_PELAYANAN",
          ),
          rowValue(
            row,
            "TGL_PELAYANAN",
          ),
          rowValue(
            row,
            "HARI",
          ),
          rowValue(
            row,
            "TELEPON",
          ),
        ]
          .map(
            (value) =>
              `"${String(
                value ?? "",
              ).replace(
                /"/g,
                '""',
              )}"`,
          )
          .join(","),
    );

  const csv =
    [
      header.join(","),
      ...body,
    ].join("\n");

  const blob =
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8;",
      },
    );

  const url =
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      "a",
    );

  anchor.href = url;
  anchor.download =
    "antrian-espasi.csv";

  document.body.appendChild(
    anchor,
  );

  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(
    url,
  );
}

/* =========================================================
   COMBOBOX
   ========================================================= */

type ComboOption = {
  value: string;
  label: string;
};

function SearchComboBox({
  value,
  options,
  placeholder,
  loading = false,
  disabled = false,
  onChange,
}: {
  value: string;
  options: ComboOption[];
  placeholder: string;
  loading?: boolean;
  disabled?: boolean;
  onChange: (
    value: string,
    option?: ComboOption,
  ) => void;
}) {
  const ref =
    useRef<HTMLDivElement | null>(
      null,
    );

  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    query,
    setQuery,
  ] =
    useState("");

  useEffect(() => {
    function handleOutside(
      event: MouseEvent,
    ) {
      if (
        ref.current &&
        !ref.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutside,
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleOutside,
      );
  }, []);

  const selected =
    options.find(
      (option) =>
        String(
          option.value,
        ) === String(value),
    );

  const filtered =
    options.filter(
      (option) =>
        option.label
          .toUpperCase()
          .includes(
            query
              .trim()
              .toUpperCase(),
          ) ||
        option.value
          .toUpperCase()
          .includes(
            query
              .trim()
              .toUpperCase(),
          ),
    );

  return (
    <div
      ref={ref}
      className="espasi-combobox"
    >
      <button
        type="button"
        className="espasi-combobox-control"
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }

          setOpen(
            (previous) =>
              !previous,
          );
        }}
      >
        <span
          className={
            selected
              ? ""
              : "is-placeholder"
          }
        >
          {selected?.label ??
            placeholder}
        </span>

        {loading ? (
          <Loader2 className="icon-sm animate-spin" />
        ) : (
          <ChevronDown className="icon-sm" />
        )}
      </button>

      {open
        ? createPortal(
            <div className="espasi-combobox-portal">
              <div className="espasi-combobox-menu">
                <div className="espasi-combobox-search">
                  <Search className="icon-sm" />

                  <input
                    autoFocus
                    value={query}
                    onChange={(event) =>
                      setQuery(
                        event.target.value,
                      )
                    }
                    placeholder="Ketik untuk mencari..."
                  />
                </div>

                <div className="espasi-combobox-options">
                  {filtered.length ===
                  0 ? (
                    <div className="espasi-combobox-empty">
                      Tidak ada pilihan
                    </div>
                  ) : (
                    filtered.map(
                      (
                        option,
                      ) => {
                        const active =
                          String(
                            option.value,
                          ) ===
                          String(
                            value,
                          );

                        return (
                          <button
                            key={`${option.value}-${option.label}`}
                            type="button"
                            className={`espasi-combobox-option ${
                              active
                                ? "is-selected"
                                : ""
                            }`}
                            onClick={() => {
                              onChange(
                                String(
                                  option.value,
                                ),
                                option,
                              );

                              setOpen(
                                false,
                              );

                              setQuery(
                                "",
                              );
                            }}
                          >
                            <span>
                              {
                                option.label
                              }
                            </span>

                            {active ? (
                              <CheckCircle2 className="icon-sm" />
                            ) : null}
                          </button>
                        );
                      },
                    )
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/* =========================================================
   PAGE
   ========================================================= */

export default function DinasBaruPage() {
  const router =
    useRouter();

  /* -------------------------------------------------------
     QUEUE
     ------------------------------------------------------- */

  const [
    rows,
    setRows,
  ] =
    useState<QueueRow[]>([]);

  /*
   * PENTING:
   *
   * current = antrian yang benar-benar sedang dilayani.
   *
   * modalRow = row yang baru dipilih dan dikirim
   *            ke modal.
   *
   * Keduanya TIDAK BOLEH digabung.
   */
  const [
    current,
    setCurrent,
  ] =
    useState<QueueRow | null>(
      null,
    );

  const [
    modalRow,
    setModalRow,
  ] =
    useState<QueueRow | null>(
      null,
    );

  const [
    selectionModalOpen,
    setSelectionModalOpen,
  ] =
    useState(false);

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    page,
    setPage,
  ] =
    useState(1);

  const [
    pageSize,
    setPageSize,
  ] =
    useState(15);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  /* -------------------------------------------------------
     ACCESS
     ------------------------------------------------------- */

  const [
    access,
    setAccess,
  ] =
    useState<EspasiAccess | null>(
      null,
    );

  const [
    accessLoading,
    setAccessLoading,
  ] =
    useState(true);

  const [
    loket,
    setLoket,
  ] =
    useState(
      DEFAULT_LOKET,
    );

  const isAdmin =
    access?.isAdmin ===
    true;

  const canAction =
    access?.canAction ===
    true;

  const effectiveLoket =
    isAdmin
      ? loket
      : access?.loket ||
        DEFAULT_LOKET;

  /* -------------------------------------------------------
     CALL STATE
     ------------------------------------------------------- */

  const [
    callState,
    setCallState,
  ] =
    useState<CallState>(
      "Panggil",
    );

  /* -------------------------------------------------------
     TRACKING
     ------------------------------------------------------- */

  const [
    trackingMaster,
    setTrackingMaster,
  ] =
    useState<TrackingMaster | null>(
      null,
    );

  const [
    trackingOpen,
    setTrackingOpen,
  ] =
    useState(false);

  const [
    trackingLoading,
    setTrackingLoading,
  ] =
    useState(false);

  const [
    trackingSaving,
    setTrackingSaving,
  ] =
    useState(false);

  const [
    trackingError,
    setTrackingError,
  ] =
    useState("");

  const [
    trackingForm,
    setTrackingForm,
  ] =
    useState<TrackingForm>(
      EMPTY_TRACKING_FORM,
    );

  /* -------------------------------------------------------
     WILAYAH
     ------------------------------------------------------- */

  const [
    ktpelMeta,
    setKtpelMeta,
  ] =
    useState<KtpelMeta | null>(
      null,
    );

  const [
    kecamatanOptions,
    setKecamatanOptions,
  ] =
    useState<
      WilayahOption[]
    >([]);

  const [
    kelurahanOptions,
    setKelurahanOptions,
  ] =
    useState<
      WilayahOption[]
    >([]);

  const [
    kelurahanCache,
    setKelurahanCache,
  ] =
    useState<
      Record<string, WilayahOption[]>
    >({});

  const [
    wilayahLoading,
    setWilayahLoading,
  ] =
    useState(false);

  /* -------------------------------------------------------
     RECEIPT
     ------------------------------------------------------- */

  const [
    receiptPrompt,
    setReceiptPrompt,
  ] =
    useState<
      ReceiptPrompt | null
    >(null);

  const [
    receiptOpening,
    setReceiptOpening,
  ] =
    useState(false);

  /* -------------------------------------------------------
     REFS
     ------------------------------------------------------- */

  const requestRef =
    useRef<
      AbortController | null
    >(null);

  const mountedRef =
    useRef(true);

  const socketRef =
    useRef<{
      emit: (
        event: string,
        payload?: unknown,
      ) => void;
    } | null>(null);

  /* =======================================================
     LOAD QUEUE
     ======================================================= */

  const loadData =
    useCallback(
      async (
        nextLoket = effectiveLoket,
        silent = false,
      ) => {
        requestRef.current?.abort();

        const controller =
          new AbortController();

        requestRef.current =
          controller;

        if (!silent) {
          setLoading(true);
          setError("");
        }

        try {
          const params =
            new URLSearchParams({
              lokasi:
                DEFAULT_LOCATION,
              loket:
                nextLoket,
              page: "1",
              limit: "150",
              sort:
                "tgl_pelayanan",
              sortType:
                "asc",
            });

          const response =
            await fetch(
              `${QUEUE_ENDPOINT}?${params.toString()}`,
              {
                cache:
                  "no-store",
                credentials:
                  "include",
                signal:
                  controller.signal,
              },
            );

          const json =
            (await response
              .json()
              .catch(
                () => null,
              )) as
              | ApiEnvelope<QueuePayload>
              | null;

          if (
            !response.ok ||
            !json?.success ||
            !json.data
          ) {
            throw new Error(
              json?.message ||
                "Gagal memuat antrian.",
            );
          }

          if (
            !mountedRef.current
          ) {
            return;
          }

          const payload =
            json.data;

          if (
            payload.access
          ) {
            setAccess(
              payload.access,
            );

            setAccessLoading(
              false,
            );

            if (
              !payload.access
                .isAdmin
            ) {
              setLoket(
                payload
                  .access
                  .loket ||
                  DEFAULT_LOKET,
              );
            }
          }

          const nextRows =
            Array.isArray(
              payload.antrian,
            )
              ? payload.antrian
              : [];

          setRows(
            nextRows,
          );

          /*
           * JANGAN otomatis memilih:
           *
           * payload.urutan_sekarang
           * nextRows[0]
           *
           * karena itu menyebabkan panel kanan
           * langsung terisi ketika page dibuka.
           */
          setCurrent(
            (previous) => {
              /*
               * Jika petugas sudah memilih antrean,
               * pilihan tersebut adalah source of truth.
               * Polling tidak boleh menggantinya.
               */
              if (previous) {
                return (
                  nextRows.find(
                    (row) =>
                      rowIdentity(row) ===
                      rowIdentity(previous),
                  ) ?? null
                );
              }

              /*
               * Belum ada antrean yang dipilih:
               * otomatis tampilkan nomor URUTAN terkecil.
               * Bukan nextRows[0], karena urutan response API
               * tidak boleh menjadi penentu antrean.
               */
              return smallestQueueRow(nextRows);
            },
          );

          setPage(
            (previous) =>
              Math.min(
                previous,
                Math.max(
                  1,
                  Math.ceil(
                    nextRows.length /
                      pageSize,
                  ),
                ),
              ),
          );
        } catch (
          cause: unknown
        ) {
          if (
            cause instanceof
              DOMException &&
            cause.name ===
              "AbortError"
          ) {
            return;
          }

          if (
            !silent
          ) {
            setRows([]);
            setCurrent(
              null,
            );

            setError(
              cause instanceof
                Error
                ? cause.message
                : "Gagal memuat antrian.",
            );
          }
        } finally {
          if (
            mountedRef.current &&
            !silent
          ) {
            setLoading(
              false,
            );
          }
        }
      },
      [
        effectiveLoket,
        pageSize,
      ],
    );

  /* =======================================================
     INITIAL + POLLING
     ======================================================= */

  useEffect(() => {
    mountedRef.current =
      true;

    void loadData(
      effectiveLoket,
      false,
    );

    return () => {
      mountedRef.current =
        false;

      requestRef.current?.abort();
    };
  }, [
    effectiveLoket,
    loadData,
  ]);

  useEffect(() => {
    let timer:
      | ReturnType<
          typeof setInterval
        >
      | null = null;

    function start() {
      if (timer) {
        return;
      }

      timer =
        setInterval(() => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void loadData(
              effectiveLoket,
              true,
            );
          }
        }, POLL_INTERVAL_MS);
    }

    function stop() {
      if (!timer) {
        return;
      }

      clearInterval(
        timer,
      );

      timer = null;
    }

    function visibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void loadData(
          effectiveLoket,
          true,
        );

        start();
      } else {
        stop();
      }
    }

    document.addEventListener(
      "visibilitychange",
      visibilityChange,
    );

    if (
      document.visibilityState ===
      "visible"
    ) {
      start();
    }

    return () => {
      stop();

      document.removeEventListener(
        "visibilitychange",
        visibilityChange,
      );
    };
  }, [
    effectiveLoket,
    loadData,
  ]);

  /* =======================================================
     FILTER
     ======================================================= */

  const filteredRows =
    useMemo(() => {
      const needle =
        query
          .trim()
          .toUpperCase();

      if (!needle) {
        return rows;
      }

      return rows.filter(
        (row) =>
          searchBucket(
            row,
          ).includes(
            needle,
          ),
      );
    }, [
      rows,
      query,
    ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredRows.length /
          pageSize,
      ),
    );

  const pageRows =
    filteredRows.slice(
      (page - 1) *
        pageSize,
      page *
        pageSize,
    );

  useEffect(() => {
    if (
      page >
      totalPages
    ) {
      setPage(
        totalPages,
      );
    }
  }, [
    page,
    totalPages,
  ]);

  /* =======================================================
     SELECT ROW -> MODAL
     ======================================================= */

  function pickRow(
    row: QueueRow,
  ) {
    /*
     * INI PERUBAHAN UTAMA.
     *
     * Jangan:
     *
     * setCurrent(row)
     *
     * karena itu langsung mengubah panel kanan.
     *
     * Row masuk ke modal terlebih dahulu.
     */
    setModalRow(
      row,
    );

    setSelectionModalOpen(
      true,
    );

    setError("");
  }

  function closeSelectionModal() {
    setSelectionModalOpen(
      false,
    );

    setModalRow(
      null,
    );
  }

  function useSelectedQueue() {
    if (!modalRow) {
      return;
    }

    setCurrent(
      modalRow,
    );

    setCallState(
      "Panggil",
    );

    setSelectionModalOpen(
      false,
    );

    setModalRow(
      null,
    );
  }

  /* =======================================================
     CALL SOCKET
     ======================================================= */

  async function emitCall(
    row: QueueRow,
  ) {
    /*
     * Mengikuti mekanisme legacy ESPASI.
     *
     * Event name dapat diberikan oleh aplikasi
     * socket legacy jika tersedia.
     *
     * Jika socket tidak tersedia, status UI tetap
     * berjalan sehingga operasional page tidak rusak.
     */

    const eventName =
      `antrian_${normalizeCode(
        rowValue(
          row,
          "LOKASI",
        ) ||
          DEFAULT_LOCATION,
      )}`;

    socketRef.current?.emit(
      eventName,
      {
        loket:
          effectiveLoket,
        urutan:
          rowValue(
            row,
            "URUTAN",
          ),
      },
    );
  }

  /* =======================================================
     PANGGIL / ULANGI / SELESAI
     ======================================================= */

  async function handleCall() {
    if (
      !current ||
      busy ||
      !canAction
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await emitCall(
        current,
      );

      setCallState(
        "Ulangi",
      );
    } catch (
      cause: unknown
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : "Gagal memanggil antrian.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRecall() {
    if (
      !current ||
      busy ||
      !canAction
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await emitCall(
        current,
      );

      setCallState(
        "Ulangi",
      );
    } catch (
      cause: unknown
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : "Gagal memanggil ulang antrian.",
      );
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     UPDATE QUEUE STATUS
     ======================================================= */

  async function updateQueueStatus(
    status:
      | "SUDAH"
      | "PENDING",
  ) {
    if (
      !current ||
      busy ||
      !canAction
    ) {
      return false;
    }

    setBusy(true);
    setError("");

    try {
      const response =
        await fetch(
          STATUS_ENDPOINT,
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            cache:
              "no-store",
            credentials:
              "include",
            body:
              JSON.stringify({
                nik:
                  rowValue(
                    current,
                    "NIK",
                  ),

                telepon:
                  rowValue(
                    current,
                    "TELEPON",
                  ),

                layanan:
                  rowValue(
                    current,
                    "KODE_PELAYANAN",
                  ),

                /*
                 * DINAS / DISDUK adalah lokasi
                 * page, bukan nomor antrian.
                 */
                lokasi:
                  DEFAULT_LOCATION,

                loket:
                  effectiveLoket,

                status,
              }),
          },
        );

      const json =
        (await response
          .json()
          .catch(
            () => null,
          )) as
          | ApiEnvelope<unknown>
          | null;

      if (
        !response.ok ||
        json?.success ===
          false
      ) {
        throw new Error(
          json?.message ||
            "Gagal memperbarui status antrian.",
        );
      }

      return true;
    } catch (
      cause: unknown
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : "Gagal memperbarui status antrian.",
      );

      return false;
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     LOAD TRACKING MASTER
     ======================================================= */

  async function loadTrackingMaster(): Promise<TrackingMaster> {
    if (
      trackingMaster
    ) {
      return trackingMaster;
    }

    setTrackingLoading(
      true,
    );

    try {
      const response =
        await fetch(
          TRACKING_MASTER_ENDPOINT,
          {
            cache:
              "no-store",
            credentials:
              "include",
          },
        );

      const json =
        (await response
          .json()
          .catch(
            () => null,
          )) as
          | ApiEnvelope<TrackingMaster>
          | null;

      if (
        !response.ok ||
        json?.success ===
          false ||
        !json?.data
      ) {
        throw new Error(
          json?.message ||
            "Gagal memuat master Tracking Pengajuan.",
        );
      }

      const master: TrackingMaster =
        {
          locations:
            Array.isArray(
              json.data
                .locations,
            )
              ? json.data
                  .locations
              : [],

          products:
            Array.isArray(
              json.data
                .products,
            )
              ? json.data
                  .products
              : [],

          relations:
            Array.isArray(
              json.data
                .relations,
            )
              ? json.data
                  .relations
              : [],
        };

      setTrackingMaster(
        master,
      );

      return master;
    } finally {
      setTrackingLoading(
        false,
      );
    }
  }

  /* =======================================================
     KTP-EL META / WILAYAH
     ======================================================= */

  async function loadKtpelMeta(): Promise<KtpelMeta> {
    if (ktpelMeta) {
      return ktpelMeta;
    }

    setWilayahLoading(true);

    try {
      const response =
        await fetch(
          KTP_META_ENDPOINT,
          {
            cache: "no-store",
            credentials: "include",
          },
        );

      const json =
        (await response.json().catch(
          () => null,
        )) as
          | {
              success?: boolean;
              message?: string;
              data?: KtpelMeta;
            }
          | null;

      if (
        !response.ok ||
        json?.success === false ||
        !json?.data
      ) {
        throw new Error(
          json?.message ??
            "Gagal memuat master wilayah.",
        );
      }

      const meta = json.data;

      setKtpelMeta(meta);

      setKecamatanOptions(
        Array.isArray(
          meta.wilayah?.kecamatan,
        )
          ? meta.wilayah.kecamatan
          : [],
      );

      const defaultNoKec =
        normalizeWilayahCode(
          meta.defaults?.noKec,
        );

      const defaultKelurahan =
        Array.isArray(
          meta.wilayah?.kelurahan,
        )
          ? meta.wilayah.kelurahan
          : [];

      if (
        defaultNoKec &&
        defaultNoKec !== "0" &&
        defaultKelurahan.length > 0
      ) {
        setKelurahanCache(
          (previous) => ({
            ...previous,
            [defaultNoKec]:
              defaultKelurahan,
          }),
        );
      }

      return meta;
    } finally {
      setWilayahLoading(false);
    }
  }

  async function loadKelurahan(
    noKec: string,
    meta: KtpelMeta,
  ): Promise<WilayahOption[]> {
    const kec =
      normalizeWilayahCode(noKec);

    if (
      !kec ||
      kec === "0"
    ) {
      setKelurahanOptions([]);
      return [];
    }

    const cached =
      kelurahanCache[kec];

    if (cached) {
      setKelurahanOptions(cached);
      return cached;
    }

    setWilayahLoading(true);

    try {
      const params =
        new URLSearchParams({
          no_kec: kec,
          no_prop:
            meta.defaults?.noProp ??
            "32",
          no_kab:
            meta.defaults?.noKab ??
            "73",
        });

      const response =
        await fetch(
          `${KELURAHAN_ENDPOINT}?${params.toString()}`,
          {
            cache: "no-store",
            credentials: "include",
          },
        );

      const json =
        (await response.json().catch(
          () => null,
        )) as
          | {
              success?: boolean;
              data?: {
                kelurahan?: WilayahOption[];
              };
              kelurahan?: WilayahOption[];
              message?: string;
            }
          | null;

      if (!response.ok) {
        throw new Error(
          json?.message ??
            `Gagal memuat kelurahan (${response.status}).`,
        );
      }

      const list =
        Array.isArray(
          json?.data?.kelurahan,
        )
          ? json.data.kelurahan
          : Array.isArray(
                json?.kelurahan,
              )
            ? json.kelurahan
            : [];

      setKelurahanCache(
        (previous) => ({
          ...previous,
          [kec]: list,
        }),
      );

      setKelurahanOptions(list);

      return list;
    } finally {
      setWilayahLoading(false);
    }
  }

  /* =======================================================
     LOOKUP NIK
     ======================================================= */

  async function lookupNik(
    nik: string,
  ): Promise<Record<string, unknown> | null> {
    const cleanNik =
      cleanDigits(nik).slice(0, 16);

    if (
      cleanNik.length !== 16
    ) {
      return null;
    }

    const response =
      await fetch(
        NIK_LOOKUP_ENDPOINT,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          cache: "no-store",
          credentials: "include",
          body: JSON.stringify({
            nik: cleanNik,
          }),
        },
      );

    const json =
      (await response.json().catch(
        () => null,
      )) as
        | ApiEnvelope<
            Record<string, unknown>
          >
        | null;

    if (
      !response.ok ||
      json?.success === false
    ) {
      throw new Error(
        json?.message ??
          "Gagal mengambil biodata NIK.",
      );
    }

    return json?.data ?? null;
  }

  /* =======================================================
     OPEN TRACKING MODAL
     ======================================================= */

  async function openTrackingModal() {
    if (
      !current ||
      busy
    ) {
      return;
    }

    setTrackingOpen(true);
    setTrackingError("");
    setTrackingLoading(true);

    try {
      const [
        master,
        wilayahMeta,
      ] =
        await Promise.all([
          loadTrackingMaster(),
          loadKtpelMeta(),
        ]);

      const queueLocation =
        rowValue(
          current,
          "LOKASI",
        ) ||
        DEFAULT_LOCATION;

      const queueService =
        rowValue(
          current,
          "KODE_PELAYANAN",
        );

      const location =
        resolveTrackingLocation(
          master.locations,
          queueLocation,
        );

      if (!location) {
        throw new Error(
          `Lokasi antrian "${queueLocation}" belum memiliki mapping ke M_TRACKING_LOCATION.`,
        );
      }

      const product =
        resolveTrackingProduct(
          master.products,
          queueService,
        );

      if (!product) {
        throw new Error(
          `Jenis pelayanan "${queueService}" belum memiliki mapping ke M_TRACKING_PRODUCT.`,
        );
      }

      if (
        !relationAllowed(
          master.relations,
          Number(location.locationId),
          Number(product.productId),
        )
      ) {
        throw new Error(
          `Layanan ${product.code} tidak diizinkan pada lokasi ${location.name}. Periksa M_TRACKING_LOCATION_PRODUCT.`,
        );
      }

      /*
       * Ambil data dasar dari antrian terlebih dahulu.
       * Lookup NIK kemudian melakukan enrichment.
       */
      let nik =
        cleanDigits(
          rowValue(
            current,
            "NIK",
          ),
        );

      let name =
        rowValue(
          current,
          "NAMA",
        ).toUpperCase();

      let phone =
        rowValue(
          current,
          "TELEPON",
        );

      let email =
        rowValue(
          current,
          "EMAIL",
        );

      let noKec =
        cleanDigits(
          rowValue(
            current,
            "NO_KECAMATAN",
          ) ||
            rowValue(
              current,
              "NO_KEC",
            ),
        );

      let noKel =
        cleanDigits(
          rowValue(
            current,
            "NO_KELURAHAN",
          ) ||
            rowValue(
              current,
              "NO_KEL",
            ),
        );

      let rt =
        rowValue(
          current,
          "RT",
        );

      let rw =
        rowValue(
          current,
          "RW",
        );

      let alamat =
        rowValue(
          current,
          "ALAMAT",
        );

      /*
       * Lookup NIK adalah enrichment.
       * Jika lookup gagal, data dari antrian tetap dipakai.
       */
      if (nik.length === 16) {
        try {
          const person =
            await lookupNik(nik);

          if (person) {
            name =
              String(
                person.NAMA_LGKP ??
                  person.NAMA ??
                  name,
              )
                .trim()
                .toUpperCase();

            phone =
              text(
                person.TELEPON ??
                  person.PHONE ??
                  person.NO_HP ??
                  phone,
              );

            email =
              text(
                person.EMAIL ??
                  email,
              );

            noKec =
              cleanDigits(
                person.NO_KEC ??
                  person.NO_KECAMATAN ??
                  person.noKec ??
                  noKec,
              );

            noKel =
              cleanDigits(
                person.NO_KEL ??
                  person.NO_KELURAHAN ??
                  person.noKel ??
                  noKel,
              );

            rt =
              text(
                person.RT ??
                  person.NO_RT ??
                  person.rt ??
                  rt,
              );

            rw =
              text(
                person.RW ??
                  person.NO_RW ??
                  person.rw ??
                  rw,
              );

            alamat =
              text(
                person.ALAMAT ??
                  person.ALAMAT_LENGKAP ??
                  person.alamat ??
                  alamat,
              );
          }
        } catch {
          /*
           * Lookup NIK bukan alasan untuk
           * menggagalkan modal.
           */
        }
      }

      /*
       * Setelah NO_KEC diketahui, load kelurahan.
       */
      const kelurahanList =
        noKec
          ? await loadKelurahan(
              noKec,
              wilayahMeta,
            )
          : [];

      const kecamatanName =
        findWilayahLabel(
          wilayahMeta.wilayah?.kecamatan ??
            [],
          noKec,
        );

      const kelurahanName =
        findWilayahLabel(
          kelurahanList,
          noKel,
        );

      /*
       * Simpan KODE wilayah di form.
       * Yang ditampilkan SearchComboBox adalah LABEL.
       */
      setTrackingForm({
        locationId:
          String(
            location.locationId,
          ),

        productId:
          String(
            product.productId,
          ),

        locationName:
          location.name,

        productName:
          product.name,

        nik,

        name,

        queueNumber:
          rowValue(
            current,
            "URUTAN",
          ),

        phone,

        email,

        noKec,

        noKel,

        kecamatanName,

        kelurahanName,

        rt,

        rw,

        alamat:
          alamat.toUpperCase(),
      });
    } catch (
      cause: unknown
    ) {
      setTrackingError(
        cause instanceof Error
          ? cause.message
          : "Gagal menyiapkan pengajuan tracking.",
      );
    } finally {
      setTrackingLoading(false);
    }
  }

  /* =======================================================
     UPDATE TRACKING FIELD
     ======================================================= */

  function updateTrackingField(
    field: keyof TrackingForm,
    value: string,
  ) {
    setTrackingForm(
      (
        previous,
      ) => ({
        ...previous,
        [field]:
          value,
      }),
    );
  }

  /* =======================================================
     SAVE TRACKING
     ======================================================= */

  async function saveTracking() {
    if (
      !current ||
      trackingSaving
    ) {
      return;
    }

    setTrackingError("");

    const cleanNik =
      cleanDigits(
        trackingForm.nik,
      );

    if (
      cleanNik.length !==
      16
    ) {
      setTrackingError(
        "NIK harus 16 digit.",
      );

      return;
    }

    const required = [
      trackingForm.name,
      trackingForm.phone,
      trackingForm.noKec,
      trackingForm.noKel,
      trackingForm.rt,
      trackingForm.rw,
      trackingForm.alamat,
    ];

    if (
      required.some(
        (item) =>
          !text(item),
      )
    ) {
      setTrackingError(
        "Lengkapi nama, nomor HP, kecamatan, kelurahan, RT, RW, dan alamat.",
      );

      return;
    }

    setTrackingSaving(
      true,
    );

    let createdTrackingId =
      0;

    try {
      const master =
        await loadTrackingMaster();

      const allowed =
        relationAllowed(
          master.relations,
          Number(
            trackingForm.locationId,
          ),
          Number(
            trackingForm.productId,
          ),
        );

      if (!allowed) {
        throw new Error(
          "Kombinasi lokasi dan layanan tidak diizinkan oleh master tracking.",
        );
      }

      const product =
        master.products.find(
          (item) =>
            Number(
              item.productId,
            ) ===
            Number(
              trackingForm.productId,
            ),
        );

      if (!product) {
        throw new Error(
          "Produk tracking tidak ditemukan.",
        );
      }

      const res =
        await fetch(
          TRACKING_ENDPOINT,
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            cache:
              "no-store",
            credentials:
              "include",

            body:
              JSON.stringify({
                /*
                 * PENTING:
                 *
                 * locationId = ID lokasi tracking.
                 * BUKAN nomor antrian.
                 */
                locationId:
                  trackingForm.locationId,

                productId:
                  trackingForm.productId,

                noDok: "",

                extraNote: "",

                nik:
                  cleanNik,

                applicantName:
                  trackingForm.name
                    .trim()
                    .toUpperCase(),

                /*
                 * KODE tetap dikirim.
                 * UI menampilkan nama.
                 */
                noKec:
                  cleanDigits(
                    trackingForm.noKec,
                  ),

                noKel:
                  cleanDigits(
                    trackingForm.noKel,
                  ),

                alamat:
                  trackingForm.alamat
                    .trim()
                    .toUpperCase(),

                noRw:
                  cleanDigits(
                    trackingForm.rw,
                  ),

                noRt:
                  cleanDigits(
                    trackingForm.rt,
                  ),

                phone:
                  trackingForm.phone.trim(),

                email:
                  trackingForm.email.trim(),

                source:
                  "ESPASI",

                /*
                 * Sesuai permintaan:
                 * NOTES kosong.
                 */
                notes: "",
              }),
          },
        );

      const json =
        (await res
          .json()
          .catch(
            () => null,
          )) as
          | ApiEnvelope<any>
          | null;

      if (
        !res.ok ||
        json?.success ===
          false
      ) {
        throw new Error(
          json?.message ||
            "Gagal menyimpan pengajuan tracking.",
        );
      }

      createdTrackingId =
        Number(
          json?.data
            ?.item
            ?.trackingId ??
            json?.data
              ?.trackingId ??
            0,
        );

      const registrationNo =
        text(
          json?.data
            ?.item
            ?.registrationNo ??
            json?.data
              ?.registrationNo ??
            "",
        );

      /*
       * Setelah tracking berhasil:
       * baru status antrian menjadi SUDAH.
       */
      const statusOk =
        await updateQueueStatus(
          "SUDAH",
        );

      if (!statusOk) {
        throw new Error(
          "Tracking berhasil dibuat tetapi status antrian gagal diperbarui.",
        );
      }

      /*
       * Tutup modal tracking.
       */
      setTrackingOpen(
        false,
      );

      setTrackingForm(
        EMPTY_TRACKING_FORM,
      );

      /*
       * Jenis layanan yang tidak menghasilkan resi:
       *
       * PENGAMBILAN
       * KTPR / PEREKAMAN
       *
       * langsung selesai.
       */
      const canPrint =
        receiptAllowed(
          product.code,
        );

      if (
        canPrint &&
        createdTrackingId >
          0
      ) {
        setReceiptPrompt({
          trackingId:
            createdTrackingId,

          registrationNo,

          canPrint:
            true,
        });
      }

      setCurrent(
        null,
      );

      setCallState(
        "Panggil",
      );

      await loadData(
        effectiveLoket,
        false,
      );
    } catch (
      cause: unknown
    ) {
      /*
       * Compensation.
       *
       * Jika tracking sudah dibuat tetapi proses berikutnya
       * gagal, hapus tracking baru agar retry tidak membuat
       * duplikasi.
       */
      if (
        createdTrackingId >
        0
      ) {
        try {
          await fetch(
            `/api/tracking-pengajuan/${createdTrackingId}`,
            {
              method:
                "DELETE",
              headers: {
                "Content-Type":
                  "application/json",
              },
              cache:
                "no-store",
              credentials:
                "include",
            },
          );
        } catch {
          // Error utama tetap ditampilkan.
        }
      }

      setTrackingError(
        cause instanceof
          Error
          ? cause.message
          : "Gagal menyimpan pengajuan tracking.",
      );
    } finally {
      setTrackingSaving(
        false,
      );
    }
  }

  /* =======================================================
     CLOSE TRACKING
     ======================================================= */

  function closeTracking() {
    if (
      trackingSaving
    ) {
      return;
    }

    setTrackingOpen(
      false,
    );

    setTrackingError("");

    setTrackingForm(
      EMPTY_TRACKING_FORM,
    );
  }

  /* =======================================================
     RECEIPT
     ======================================================= */

  async function printReceipt() {
    if (
      !receiptPrompt ||
      !receiptPrompt.canPrint
    ) {
      return;
    }

    setReceiptOpening(
      true,
    );

    try {
      /*
       * Endpoint resi ESPASI menggunakan nomor registrasi
       * sebagai identifier utama.
       *
       * Contoh:
       * REG-00-SKP-20260819-003
       */
      const registrationNo =
        text(
          receiptPrompt.registrationNo,
        );

      if (!registrationNo) {
        throw new Error(
          "Nomor registrasi pengajuan tidak tersedia.",
        );
      }

      /*
       * Ambil PDF sebagai Blob terlebih dahulu.
       *
       * Jangan window.open(url) langsung:
       * browser dapat memperlakukan request sebagai popup
       * dan endpoint membutuhkan session cookie.
       */
      const response =
        await fetch(
          `${RECEIPT_ENDPOINT}?registrationNo=${encodeURIComponent(
            registrationNo,
          )}`,
          {
            cache:
              "no-store",
            credentials:
              "include",
          },
        );

      if (!response.ok) {
        const json =
          (await response
            .json()
            .catch(
              () => null,
            )) as
            | {
                message?: string;
              }
            | null;

        throw new Error(
          json?.message ??
            "PDF resi gagal dibuat.",
        );
      }

      const contentType =
        response.headers.get(
          "content-type",
        ) ?? "";

      if (
        !contentType
          .toLowerCase()
          .includes("application/pdf")
      ) {
        const body =
          await response.text().catch(
            () => "",
          );

        throw new Error(
          body ||
            "Server tidak mengembalikan PDF resi.",
        );
      }

      const blob =
        await response.blob();

      const blobUrl =
        URL.createObjectURL(
          blob,
        );

      /*
       * Buka PDF pada tab baru menggunakan anchor.
       * Cara ini lebih konsisten di Chrome daripada
       * window.open() setelah await fetch().
       */
      const anchor =
        document.createElement(
          "a",
        );

      anchor.href =
        blobUrl;

      anchor.target =
        "_blank";

      anchor.rel =
        "noopener noreferrer";

      document.body.appendChild(
        anchor,
      );

      anchor.click();

      anchor.remove();

      window.setTimeout(
        () =>
          URL.revokeObjectURL(
            blobUrl,
          ),
        60_000,
      );

      setReceiptPrompt(
        null,
      );
    } catch (
      cause: unknown
    ) {
      setError(
        cause instanceof
          Error
          ? cause.message
          : "Gagal membuka PDF resi.",
      );
    } finally {
      setReceiptOpening(
        false,
      );
    }
  }

  function closeReceiptPrompt() {
    setReceiptPrompt(
      null,
    );
  }

  /* =======================================================
     SELESAI
     ======================================================= */

  async function handleFinish() {
    if (
      !current ||
      busy ||
      !canAction
    ) {
      return;
    }

    /*
     * Jangan langsung SUDAH.
     *
     * Selesai membuka modal Input Pengajuan.
     */
    await openTrackingModal();
  }

  /* =======================================================
     LEWAT
     ======================================================= */

  async function handleSkip() {
    if (
      !current ||
      busy ||
      !canAction
    ) {
      return;
    }

    const success =
      await updateQueueStatus(
        "PENDING",
      );

    if (!success) {
      return;
    }

    setCurrent(
      null,
    );

    setCallState(
      "Panggil",
    );

    await loadData(
      effectiveLoket,
      false,
    );
  }

  /* =======================================================
     RESET PANEL
     ======================================================= */

  async function resetPanel() {
    setCurrent(
      null,
    );

    setCallState(
      "Panggil",
    );

    setError("");

    await loadData(
      effectiveLoket,
      false,
    );
  }

  /* =======================================================
     REFRESH
     ======================================================= */

  async function refresh() {
    await loadData(
      effectiveLoket,
      false,
    );
  }

  /* =======================================================
     CURRENT LABEL
     ======================================================= */

  const currentNumber =
    current
      ? rowValue(
          current,
          "URUTAN",
        )
      : "";

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <main className="panel page-feature espasi-loket-page">
      {/* ===================================================
          HEADER
          =================================================== */}

      <header className="espasi-dinas-header">
        <div className="espasi-dinas-header__identity">
          <button
            type="button"
            className="espasi-back-button"
            onClick={() =>
              router.push(
                "/dashboard",
              )
            }
            aria-label="Kembali"
          >
            <ArrowLeft className="icon-md" />
          </button>

          <div>
            <div className="espasi-eyebrow">
              MONALISA · ESPASI
            </div>

            <h1>
              {TITLE}
            </h1>

            <div className="espasi-subtitle">
              <span className="espasi-status-dot" />

              DINAS KEPENDUDUKAN DAN PENCATATAN SIPIL

              <span className="espasi-divider">
                /
              </span>

              Loket{" "}
              {effectiveLoket}
            </div>
          </div>
        </div>

        <div className="espasi-dinas-header__meta">
          <div className="espasi-total">
            <span>
              TOTAL
            </span>

            <strong>
              {
                filteredRows.length
              }
            </strong>
          </div>

          <button
            type="button"
            className="espasi-refresh-button"
            onClick={() =>
              void refresh()
            }
            disabled={
              loading ||
              busy ||
              accessLoading
            }
            aria-label="Refresh"
          >
            <RefreshCw
              className={
                loading
                  ? "icon-sm animate-spin"
                  : "icon-sm"
              }
            />

            <span>
              Refresh
            </span>
          </button>
        </div>
      </header>

      {/* ===================================================
          ERROR
          =================================================== */}

      {error ? (
        <section className="espasi-inline-error">
          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            aria-label="Tutup pesan error"
          >
            <X className="icon-sm" />
          </button>
        </section>
      ) : null}

      {/* ===================================================
          ACCESS
          =================================================== */}

      {!accessLoading &&
      access &&
      access.hasAccess ===
        false ? (
        <section className="espasi-viewonly-banner">
          <Eye className="icon-sm" />

          <div>
            <strong>
              Mode View Only
            </strong>

            <span>
              Akun ini tidak terdaftar
              pada M_ESPASI_USER.
              Data tetap dapat dilihat,
              tetapi aksi operasional
              dinonaktifkan.
            </span>
          </div>
        </section>
      ) : null}

      {access?.hasAccess &&
      !canAction ? (
        <section className="espasi-viewonly-banner">
          <ShieldCheck className="icon-sm" />

          <div>
            <strong>
              Akses Operasional
              Terkunci
            </strong>

            <span>
              User terdaftar tetapi
              tidak memiliki hak aksi
              pada halaman ini.
            </span>
          </div>
        </section>
      ) : null}

      {/* ===================================================
          WORKSPACE
          =================================================== */}

      <section className="espasi-workspace">
        {/* =================================================
            TABLE
            ================================================= */}

        <div className="espasi-table-panel">
          <div className="espasi-toolbar">
            <div className="espasi-search">
              <Search className="icon-sm" />

              <input
                value={query}
                onChange={(
                  event,
                ) => {
                  setQuery(
                    event.target
                      .value,
                  );

                  setPage(1);
                }}
                placeholder="Cari NIK, nama, atau nomor..."
                aria-label="Cari antrian"
              />

              {query ? (
                <button
                  type="button"
                  onClick={() =>
                    setQuery("")
                  }
                  aria-label="Hapus pencarian"
                >
                  <X className="icon-sm" />
                </button>
              ) : null}
            </div>

            <div className="espasi-toolbar-spacer" />

            <div className="espasi-toolbar-actions">
              <button
                type="button"
                className="espasi-toolbar-button espasi-download-button"
                onClick={() =>
                  downloadCsv(
                    filteredRows,
                  )
                }
                disabled={
                  filteredRows.length ===
                  0
                }
              >
                <Download className="icon-sm" />

                <span>
                  Download
                </span>
              </button>

              <div className="espasi-location-readonly">
                <span>
                  LOKASI
                </span>

                <strong>
                  DINAS KEPENDUDUKAN DAN PENCATATAN SIPIL
                </strong>
              </div>

              <label className="espasi-loket-control">
                <span>
                  LOKET
                </span>

                <select
                  value={
                    effectiveLoket
                  }
                  onChange={(
                    event,
                  ) => {
                    if (
                      !isAdmin
                    ) {
                      return;
                    }

                    setLoket(
                      event.target
                        .value,
                    );

                    setCurrent(
                      null,
                    );

                    setCallState(
                      "Panggil",
                    );

                    setPage(1);
                  }}
                  disabled={
                    !isAdmin ||
                    accessLoading ||
                    loading ||
                    busy
                  }
                  aria-label="Pilih loket"
                >
                  {LOKET_OPTIONS.map(
                    (
                      option,
                    ) => (
                      <option
                        key={
                          option
                        }
                        value={
                          option
                        }
                      >
                        Loket{" "}
                        {option}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
          </div>

          {/* ===============================================
              TABLE
              =============================================== */}

          <div className="espasi-table-wrap">
            <table className="espasi-table">
              <thead>
                <tr>
                  <th>
                    #
                  </th>

                  <th>
                    URUTAN
                  </th>

                  <th>
                    NIK
                  </th>

                  <th>
                    NAMA
                  </th>

                  <th>
                    STATUS
                  </th>

                  <th>
                    TANGGAL
                  </th>

                  <th>
                    HARI
                  </th>

                  <th>
                    AKSI
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading &&
                pageRows.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="espasi-table-loading"
                    >
                      <Loader2 className="icon-md animate-spin" />
                      Memuat antrian...
                    </td>
                  </tr>
                ) : pageRows.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="espasi-table-empty"
                    >
                      <FileText className="icon-md" />

                      <strong>
                        Tidak ada
                        antrian
                      </strong>

                      <span>
                        Tidak ada
                        data yang
                        sesuai
                        pencarian.
                      </span>
                    </td>
                  </tr>
                ) : (
                  pageRows.map(
                    (
                      row,
                      index,
                    ) => {
                      const active =
                        rowIdentity(
                          row,
                        ) ===
                        rowIdentity(
                          current,
                        );

                      return (
                        <tr
                          key={`${rowIdentity(
                            row,
                          )}-${index}`}
                          className={
                            active
                              ? "is-current"
                              : ""
                          }
                        >
                          <td>
                            {
                              (page -
                                1) *
                                pageSize +
                                index +
                                1
                            }
                          </td>

                          <td>
                            <span className="espasi-queue-number">
                              {rowValue(
                                row,
                                "URUTAN",
                              )}
                            </span>
                          </td>

                          <td>
                            {rowValue(
                              row,
                              "NIK",
                            )}
                          </td>

                          <td className="espasi-name-cell">
                            {rowValue(
                              row,
                              "NAMA",
                            )}
                          </td>

                          <td>
                            <span className="espasi-status-chip">
                              <span />
                              {rowValue(
                                row,
                                "STATUS_PELAYANAN",
                              ) ||
                                "BELUM"}
                            </span>
                          </td>

                          <td>
                            {rowValue(
                              row,
                              "TGL_PELAYANAN",
                            )}
                          </td>

                          <td>
                            {rowValue(
                              row,
                              "HARI",
                            )}
                          </td>

                          <td>
                            <button
                              type="button"
                              className="espasi-pilih-button"
                              onClick={() =>
                                pickRow(
                                  row,
                                )
                              }
                              disabled={
                                busy ||
                                loading ||
                                !canAction
                              }
                            >
                              <Eye className="icon-sm" />

                              <span>
                                Pilih
                              </span>
                            </button>
                          </td>
                        </tr>
                      );
                    },
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* ===============================================
              FOOTER TABLE
              =============================================== */}

          <div className="espasi-table-footer">
            <span>
              Menampilkan{" "}
              <strong>
                {filteredRows.length ===
                0
                  ? 0
                  : (page -
                      1) *
                      pageSize +
                    1}
                –
                {Math.min(
                  page *
                    pageSize,
                  filteredRows.length,
                )}
              </strong>{" "}
              dari{" "}
              <strong>
                {filteredRows.length}
              </strong>{" "}
              data
            </span>

            <div className="espasi-pagination">
              <label>
                Tampilkan

                <select
                  value={
                    pageSize
                  }
                  onChange={(
                    event,
                  ) => {
                    setPageSize(
                      Number(
                        event
                          .target
                          .value,
                      ),
                    );

                    setPage(1);
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map(
                    (
                      option,
                    ) => (
                      <option
                        key={
                          option
                        }
                        value={
                          option
                        }
                      >
                        {option}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <button
                type="button"
                onClick={() =>
                  setPage(
                    (value) =>
                      Math.max(
                        1,
                        value -
                          1,
                      ),
                  )
                }
                disabled={
                  page <= 1
                }
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft className="icon-sm" />
              </button>

              <span>
                {page} /{" "}
                {totalPages}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPage(
                    (value) =>
                      Math.min(
                        totalPages,
                        value +
                          1,
                      ),
                  )
                }
                disabled={
                  page >=
                  totalPages
                }
                aria-label="Halaman berikutnya"
              >
                <ChevronRight className="icon-sm" />
              </button>
            </div>
          </div>
        </div>

        {/* =================================================
            PANEL LOKET
            ================================================= */}

        <aside className="espasi-loket-panel">
          <header className="espasi-loket-panel__header">
            <div>
              <span>
                PANEL LOKET
              </span>

              <h2>
                DINAS KEPENDUDUKAN DAN PENCATATAN SIPIL
              </h2>

              <small>
                Loket{" "}
                {effectiveLoket}
              </small>
            </div>

            <div className="espasi-operator-badge">
              <ShieldCheck className="icon-sm" />
              OPERATOR
            </div>
          </header>

          <div className="espasi-loket-panel__body">
            {!current ? (
              <div className="espasi-no-current">
                <Eye className="icon-lg" />

                <strong>
                  Belum ada antrian
                </strong>

                <span>
                  Klik{" "}
                  <b>
                    Pilih
                  </b>{" "}
                  pada tabel untuk
                  membuka data
                  antrian.
                </span>
              </div>
            ) : (
              <>
                <div className="espasi-current-card">
                  <span className="espasi-current-label">
                    ANTRIAN DIPILIH
                  </span>

                  <span className="espasi-current-number-label">
                    NOMOR
                  </span>

                  <strong className="espasi-current-number">
                    {currentNumber}
                  </strong>

                  <strong className="espasi-current-name">
                    {rowValue(
                      current,
                      "NAMA",
                    )}
                  </strong>

                  <span className="espasi-current-nik">
                    {rowValue(
                      current,
                      "NIK",
                    )}
                  </span>

                  <div className="espasi-current-meta">
                    <div>
                      <span>
                        STATUS
                      </span>

                      <strong>
                        {rowValue(
                          current,
                          "STATUS_PELAYANAN",
                        ) ||
                          "BELUM"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        HARI
                      </span>

                      <strong>
                        {rowValue(
                          current,
                          "HARI",
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* =========================================
                    ACTIONS
                    ========================================= */}

                <div className="espasi-action-grid">
                  {callState ===
                  "Panggil" ? (
                    <button
                      type="button"
                      className="espasi-action espasi-action-call"
                      onClick={() =>
                        void handleCall()
                      }
                      disabled={
                        busy ||
                        !canAction
                      }
                    >
                      {busy ? (
                        <Loader2 className="icon-md animate-spin" />
                      ) : (
                        <PhoneCall className="icon-md" />
                      )}

                      <span>
                        Panggil
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="espasi-action espasi-action-recall"
                      onClick={() =>
                        void handleRecall()
                      }
                      disabled={
                        busy ||
                        !canAction
                      }
                    >
                      {busy ? (
                        <Loader2 className="icon-md animate-spin" />
                      ) : (
                        <RotateCw className="icon-md" />
                      )}

                      <span>
                        Ulangi
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="espasi-action espasi-action-finish"
                    onClick={() =>
                      void handleFinish()
                    }
                    disabled={
                      busy ||
                      !canAction ||
                      callState ===
                        "Panggil"
                    }
                  >
                    <CheckCircle2 className="icon-md" />

                    <span>
                      Selesai
                    </span>
                  </button>

                  <button
                    type="button"
                    className="espasi-action espasi-action-skip"
                    onClick={() =>
                      void handleSkip()
                    }
                    disabled={
                      busy ||
                      !canAction
                    }
                  >
                    <SkipForward className="icon-md" />

                    <span>
                      Lewat
                    </span>
                  </button>

                  <button
                    type="button"
                    className="espasi-action espasi-action-reset"
                    onClick={() =>
                      void resetPanel()
                    }
                    disabled={
                      busy
                    }
                  >
                    <RefreshCw className="icon-md" />

                    <span>
                      Reset Panel
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>

          <footer className="espasi-loket-panel__footer">
            <span className="espasi-status-dot" />

            <div>
              <strong>
                STATUS SISTEM
              </strong>

              <p>
                Petugas dapat melakukan
                aksi operasional.
              </p>

              <small>
                Sinkronisasi otomatis
                setiap 5 detik saat
                halaman aktif.
              </small>
            </div>
          </footer>
        </aside>
      </section>

      {/* ===================================================
          MODAL PILIH ANTRIAN
          =================================================== */}

      {selectionModalOpen &&
      modalRow
        ? createPortal(
            <div className="espasi-modal-backdrop">
              <div className="espasi-selection-modal">
                <header className="espasi-modal-header">
                  <div>
                    <span className="espasi-modal-eyebrow">
                      ANTRIAN DIPILIH
                    </span>

                    <h2>
                      Konfirmasi
                      Antrian
                    </h2>

                    <p>
                      Data antrian telah
                      dikirim ke modal.
                      Panel loket belum
                      diubah.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="espasi-modal-close"
                    onClick={
                      closeSelectionModal
                    }
                    aria-label="Tutup"
                  >
                    <X className="icon-md" />
                  </button>
                </header>

                <div className="espasi-selection-body">
                  <div className="espasi-selection-number">
                    <span>
                      NOMOR
                    </span>

                    <strong>
                      {rowValue(
                        modalRow,
                        "URUTAN",
                      )}
                    </strong>
                  </div>

                  <div className="espasi-selection-info">
                    <div>
                      <span>
                        NIK
                      </span>

                      <strong>
                        {rowValue(
                          modalRow,
                          "NIK",
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        NAMA
                      </span>

                      <strong>
                        {rowValue(
                          modalRow,
                          "NAMA",
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        JENIS PELAYANAN
                      </span>

                      <strong>
                        {rowValue(
                          modalRow,
                          "KODE_PELAYANAN",
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        LOKASI
                      </span>

                      <strong>
                        DINAS /
                        DISDUK
                      </strong>
                    </div>
                  </div>
                </div>

                <footer className="espasi-modal-footer">
                  <button
                    type="button"
                    className="espasi-modal-button secondary"
                    onClick={
                      closeSelectionModal
                    }
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    className="espasi-modal-button primary"
                    onClick={
                      useSelectedQueue
                    }
                  >
                    <CheckCircle2 className="icon-sm" />

                    Gunakan
                    Antrian
                  </button>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* ===================================================
          MODAL INPUT PENGAJUAN
          =================================================== */}

      {trackingOpen
        ? createPortal(
            <div className="espasi-modal-backdrop">
              <div className="espasi-tracking-modal">
                <header className="espasi-modal-header">
                  <div>
                    <span className="espasi-modal-eyebrow">
                      SETELAH PELAYANAN
                      SELESAI
                    </span>

                    <h2>
                      Input Pengajuan
                    </h2>

                    <p>
                      NIK, jenis layanan,
                      lokasi, dan nomor
                      antrian berasal dari
                      antrian.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="espasi-modal-close"
                    onClick={
                      closeTracking
                    }
                    disabled={
                      trackingSaving
                    }
                    aria-label="Tutup"
                  >
                    <X className="icon-md" />
                  </button>
                </header>

                <div className="espasi-tracking-modal-body">
                  {trackingError ? (
                    <div className="espasi-modal-error">
                      {trackingError}
                    </div>
                  ) : null}

                  <div className="espasi-form-grid">
                    {/* NIK */}
                    <label className="espasi-form-field">
                      <span>
                        NIK
                      </span>

                      <input
                        value={
                          trackingForm.nik
                        }
                        onChange={(
                          event,
                        ) =>
                          updateTrackingField(
                            "nik",
                            event.target
                              .value
                              .replace(
                                /\D/g,
                                "",
                              )
                              .slice(
                                0,
                                16,
                              ),
                          )
                        }
                      />
                    </label>

                    {/* LAYANAN */}
                    <label className="espasi-form-field">
                      <span>
                        JENIS PELAYANAN
                      </span>

                      <SearchComboBox
                        value={
                          trackingForm.productId
                        }
                        options={
                          trackingMaster
                            ? trackingMaster.products
                                .filter((product) =>
                                  relationAllowed(
                                    trackingMaster.relations,
                                    Number(
                                      trackingForm.locationId,
                                    ),
                                    Number(
                                      product.productId,
                                    ),
                                  ),
                                )
                                .map(
                                  (
                                    product,
                                  ) => ({
                                    value:
                                      String(
                                        product.productId,
                                      ),
                                    label: `${product.code} - ${product.name}`,
                                  }),
                                )
                            : []
                        }
                        placeholder="Pilih jenis pelayanan"
                        loading={
                          trackingLoading
                        }
                        disabled={
                          trackingSaving
                        }
                        onChange={(
                          value,
                          option,
                        ) => {
                          updateTrackingField(
                            "productId",
                            value,
                          );

                          updateTrackingField(
                            "productName",
                            option?.label ??
                              "",
                          );
                        }}
                      />

                      <small>
                        Default disesuaikan
                        dengan antrian,
                        tetapi petugas tetap
                        dapat mengubahnya.
                      </small>
                    </label>

                    {/* LOKASI */}
                    <label className="espasi-form-field">
                      <span>
                        LOKASI PELAYANAN
                      </span>

                      <input
                        value={
                          trackingForm.locationName
                        }
                        readOnly
                      />

                      <small>
                        Location ID tracking:
                        {" "}
                        {
                          trackingForm.locationId
                        }
                      </small>
                    </label>

                    {/* NOMOR ANTRIAN */}
                    <label className="espasi-form-field">
                      <span>
                        NOMOR ANTRIAN
                      </span>

                      <input
                        value={
                          trackingForm.queueNumber
                        }
                        readOnly
                      />

                      <small>
                        Tidak dikirim
                        sebagai locationId.
                      </small>
                    </label>

                    {/* NAMA */}
                    <label className="espasi-form-field">
                      <span>
                        NAMA PEMOHON
                      </span>

                      <input
                        value={
                          trackingForm.name
                        }
                        onChange={(
                          event,
                        ) =>
                          updateTrackingField(
                            "name",
                            event.target
                              .value
                              .toUpperCase(),
                          )
                        }
                      />
                    </label>

                    {/* PHONE */}
                    <label className="espasi-form-field">
                      <span>
                        NOMOR HP
                      </span>

                      <input
                        value={
                          trackingForm.phone
                        }
                        onChange={(
                          event,
                        ) =>
                          updateTrackingField(
                            "phone",
                            event.target
                              .value,
                          )
                        }
                        placeholder="+628..."
                      />

                      <small>
                        Nomor HP dapat
                        dilengkapi atau
                        diperbaiki petugas.
                      </small>
                    </label>

                    {/* EMAIL */}
                    <label className="espasi-form-field">
                      <span>
                        EMAIL
                      </span>

                      <input
                        value={
                          trackingForm.email
                        }
                        onChange={(
                          event,
                        ) =>
                          updateTrackingField(
                            "email",
                            event.target
                              .value,
                          )
                        }
                      />
                    </label>

                    {/* KECAMATAN */}
                    <label className="espasi-form-field">
                      <span>
                        KECAMATAN
                      </span>

                      <SearchComboBox
                        value={
                          trackingForm.noKec
                        }
                        options={
                          kecamatanOptions
                        }
                        placeholder="Pilih kecamatan"
                        loading={
                          wilayahLoading
                        }
                        disabled={
                          trackingSaving
                        }
                        onChange={(
                          value,
                          option,
                        ) => {
                          updateTrackingField(
                            "noKec",
                            value,
                          );

                          updateTrackingField(
                            "kecamatanName",
                            option?.label ??
                              "",
                          );

                          updateTrackingField(
                            "noKel",
                            "",
                          );

                          updateTrackingField(
                            "kelurahanName",
                            "",
                          );

                          if (ktpelMeta) {
                            void loadKelurahan(
                              value,
                              ktpelMeta,
                            );
                          }
                        }}
                      />
                    </label>

                    {/* KELURAHAN */}
                    <label className="espasi-form-field">
                      <span>
                        KELURAHAN
                      </span>

                      <SearchComboBox
                        value={
                          trackingForm.noKel
                        }
                        options={
                          kelurahanOptions
                        }
                        placeholder="Pilih kelurahan"
                        loading={
                          wilayahLoading
                        }
                        disabled={
                          trackingSaving ||
                          !trackingForm.noKec
                        }
                        onChange={(
                          value,
                          option,
                        ) => {
                          updateTrackingField(
                            "noKel",
                            value,
                          );

                          updateTrackingField(
                            "kelurahanName",
                            option?.label ??
                              "",
                          );
                        }}
                      />
                    </label>

                    {/* RT */}
                    <label className="espasi-form-field">
                      <span>
                        RT
                      </span>

                      <input
                        value={
                          trackingForm.rt
                        }
                        onChange={(
                          event,
                        ) =>
                          updateTrackingField(
                            "rt",
                            event.target
                              .value
                              .replace(
                                /\D/g,
                                "",
                              ),
                          )
                        }
                      />
                    </label>

                    {/* RW */}
                    <label className="espasi-form-field">
                      <span>
                        RW
                      </span>

                      <input
                        value={
                          trackingForm.rw
                        }
                        onChange={(
                          event,
                        ) =>
                          updateTrackingField(
                            "rw",
                            event.target
                              .value
                              .replace(
                                /\D/g,
                                "",
                              ),
                          )
                        }
                      />
                    </label>

                    {/* ALAMAT */}
                    <label className="espasi-form-field espasi-form-field--full">
                      <span>
                        ALAMAT
                      </span>

                      <textarea
                        value={
                          trackingForm.alamat
                        }
                        onChange={(
                          event,
                        ) =>
                          updateTrackingField(
                            "alamat",
                            event.target
                              .value
                              .toUpperCase(),
                          )
                        }
                        rows={4}
                      />
                    </label>
                  </div>
                </div>

                <footer className="espasi-modal-footer">
                  <button
                    type="button"
                    className="espasi-modal-button secondary"
                    onClick={
                      closeTracking
                    }
                    disabled={
                      trackingSaving
                    }
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    className="espasi-modal-button primary"
                    onClick={() =>
                      void saveTracking()
                    }
                    disabled={
                      trackingSaving ||
                      trackingLoading
                    }
                  >
                    {trackingSaving ? (
                      <Loader2 className="icon-sm animate-spin" />
                    ) : (
                      <CheckCircle2 className="icon-sm" />
                    )}

                    {trackingSaving
                      ? "Menyimpan..."
                      : "Simpan Pengajuan"}
                  </button>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* ===================================================
          RECEIPT PROMPT
          =================================================== */}

      {receiptPrompt
        ? createPortal(
            <div className="espasi-modal-backdrop">
              <div className="espasi-receipt-modal">
                <div className="espasi-receipt-icon">
                  <Printer className="icon-lg" />
                </div>

                <span className="espasi-modal-eyebrow">
                  PENGAJUAN BERHASIL
                </span>

                <h2>
                  Cetak Resi?
                </h2>

                <p>
                  Pengajuan tracking telah
                  berhasil disimpan.
                </p>

                {receiptPrompt
                  .registrationNo ? (
                  <div className="espasi-registration-card">
                    <span>
                      NOMOR REGISTRASI
                    </span>

                    <strong>
                      {
                        receiptPrompt.registrationNo
                      }
                    </strong>
                  </div>
                ) : null}

                <div className="espasi-receipt-actions">
                  <button
                    type="button"
                    className="espasi-modal-button secondary"
                    onClick={
                      closeReceiptPrompt
                    }
                    disabled={
                      receiptOpening
                    }
                  >
                    Tidak
                  </button>

                  <button
                    type="button"
                    className="espasi-modal-button primary"
                    onClick={() =>
                      void printReceipt()
                    }
                    disabled={
                      receiptOpening
                    }
                  >
                    {receiptOpening ? (
                      <Loader2 className="icon-sm animate-spin" />
                    ) : (
                      <Printer className="icon-sm" />
                    )}

                    {receiptOpening
                      ? "Membuka..."
                      : "Cetak Resi"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </main>
  );
}