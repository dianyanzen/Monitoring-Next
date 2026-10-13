// FILE: src/app/api/espasi/receipt/route.ts

import type { NextRequest } from "next/server";

import { badRequest, err, unauthorized } from "@/lib/http";
import { execOne } from "@/lib/db";
import {
  getClientInfo,
  readServerSession,
} from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT =
  "/api/espasi/receipt";

/*
 * ============================================================
 * DATABASE
 * ============================================================
 *
 * Ikuti alias database yang digunakan API Tracking Pengajuan.
 *
 * Jika API tracking-pengajuan Anda menggunakan alias tertentu,
 * SAMAKAN nilai ini dengan route tersebut.
 *
 * Jangan membuat alias baru di .env.
 */
const ORACLE_ALIAS =
  process.env.DB_ALIAS_TRACKING ??
  "DB";

/*
 * ============================================================
 * TYPE
 * ============================================================
 */

type ReceiptRow = {
  REQUEST_ID: number;

  REGISTRATION_NO: string;

  QUEUE_NO: string | null;

  LOCATION_ID: number;

  LOCATION_CODE: string | null;

  LOCATION_NAME: string | null;

  LOCATION_GROUP: string | null;

  PRODUCT_ID: number;

  PRODUCT_CODE: string | null;

  PRODUCT_NAME: string | null;

  NIK: string;

  APPLICANT_NAME: string;

  NO_KEC: string | null;

  NO_KEL: number | null;

  PHONE: string | null;

  EMAIL: string | null;

  STATUS: string;

  SOURCE: string;

  NOTES: string | null;

  CREATED_BY: string;

  CREATED_DATE: string;

  CREATED_TIME: string;

  EXTRA_NOTE: string | null;
};

/*
 * ============================================================
 * HELPER
 * ============================================================
 */

function text(
  value: unknown,
): string {
  return String(
    value ?? "",
  ).trim();
}

/*
 * ============================================================
 * QUERY RESI
 * ============================================================
 *
 * Receipt TIDAK menerima:
 *
 * - NIK
 * - nama
 * - lokasi
 * - produk
 * - nomor antrian
 * - notes
 *
 * dari browser.
 *
 * Hanya REQUEST_ID.
 *
 * Semua data PDF dibaca ulang dari DB.
 */
const SQL_RECEIPT = `
SELECT
    T.REQUEST_ID,
    T.REGISTRATION_NO,
    T.QUEUE_NO,

    T.LOCATION_ID,
    L.LOCATION_CODE,
    L.LOCATION_NAME,
    L.LOCATION_GROUP,

    T.PRODUCT_ID,
    P.PRODUCT_CODE,
    P.PRODUCT_NAME,

    T.NIK,
    T.APPLICANT_NAME,

    T.NO_KEC,
    T.NO_KEL,

    T.PHONE,
    T.EMAIL,

    T.STATUS,
    T.SOURCE,
    T.NOTES,

    T.CREATED_BY,

    TO_CHAR(
        T.CREATED_AT,
        'DD-MM-YYYY'
    ) AS CREATED_DATE,

    TO_CHAR(
        T.CREATED_AT,
        'HH24:MI'
    ) AS CREATED_TIME,

    T.EXTRA_NOTE

FROM M_TRACKING_REQUEST T

LEFT JOIN M_TRACKING_LOCATION L
    ON L.LOCATION_ID =
       T.LOCATION_ID

LEFT JOIN M_TRACKING_PRODUCT P
    ON P.PRODUCT_ID =
       T.PRODUCT_ID

WHERE T.REQUEST_ID =
      :b_tracking_id

  AND T.IS_ACTIVE = 'Y'
`;

/*
 * ============================================================
 * PDF GENERATOR
 * ============================================================
 *
 * pdfmake menghasilkan Node Buffer.
 *
 * JANGAN:
 *
 * return new Response(pdf)
 *
 * karena TypeScript Next.js Anda menolak
 * Buffer<ArrayBufferLike> sebagai BodyInit.
 *
 * Kita konversi Buffer -> ArrayBuffer.
 */
async function createReceiptPdf(
  row: ReceiptRow,
): Promise<ArrayBuffer> {
  const pdfMakeModule =
    await import(
      "pdfmake/build/pdfmake"
    );

  const pdfFontsModule =
    await import(
      "pdfmake/build/vfs_fonts"
    );

  const pdfMake =
    (pdfMakeModule as any)
      .default ??
    pdfMakeModule;

  const pdfFonts =
    (pdfFontsModule as any)
      .default ??
    pdfFontsModule;

  const vfs =
    pdfFonts?.pdfMake?.vfs ??
    pdfFonts?.vfs;

  if (!vfs) {
    throw new Error(
      "Font pdfmake tidak tersedia.",
    );
  }

  pdfMake.vfs = vfs;

  const registrationNo =
    text(
      row.REGISTRATION_NO,
    );

  const queueNo =
    text(
      row.QUEUE_NO,
    );

  const applicantName =
    text(
      row.APPLICANT_NAME,
    );

  const productCode =
    text(
      row.PRODUCT_CODE,
    );

  const productName =
    text(
      row.PRODUCT_NAME,
    );

  const locationCode =
    text(
      row.LOCATION_CODE,
    );

  const locationName =
    text(
      row.LOCATION_NAME,
    );

  const nik =
    text(
      row.NIK,
    );

  const createdDate =
    text(
      row.CREATED_DATE,
    );

  const createdTime =
    text(
      row.CREATED_TIME,
    );

  const status =
    text(
      row.STATUS,
    );

  /*
   * ==========================================================
   * QR
   * ==========================================================
   *
   * Untuk sementara QR diarahkan ke nomor resi.
   *
   * Kalau API tracking-pengajuan Anda sudah mempunyai
   * mekanisme QR/token sendiri, bagian ini tinggal
   * kita sambungkan ke mekanisme tersebut.
   */
  const qrPayload =
    `https://disdukcapil.bandung.go.id/api/web/cekresi?r=${encodeURIComponent(
      registrationNo,
    )}`;

  /*
   * ==========================================================
   * DOCUMENT
   * ==========================================================
   */

  const documentDefinition =
    {
      pageSize:
        "A4",

      pageMargins: [
        42,
        36,
        42,
        36,
      ],

      defaultStyle: {
        font:
          "Roboto",
        fontSize:
          9,
      },

      info: {
        title:
          `Bukti Registrasi ${registrationNo}`,

        author:
          "MONALISA - Disdukcapil Kota Bandung",

        subject:
          "Bukti Registrasi Pengajuan",
      },

      content: [
        /*
         * HEADER
         */
        {
          text:
            "PEMERINTAH KOTA BANDUNG",
          alignment:
            "center",
          bold: true,
          fontSize:
            13,
        },

        {
          text:
            "DINAS KEPENDUDUKAN DAN PENCATATAN SIPIL KOTA BANDUNG",
          alignment:
            "center",
          bold: true,
          fontSize:
            10.5,
          margin: [
            0,
            2,
            0,
            2,
          ],
        },

        {
          text:
            "Jl. Ambon No. 1B, Kota Bandung, Jawa Barat 40115",
          alignment:
            "center",
          fontSize:
            8,
        },

        {
          text:
            "Telp. (022) 4209891",
          alignment:
            "center",
          fontSize:
            8,
          margin: [
            0,
            0,
            0,
            10,
          ],
        },

        {
          canvas: [
            {
              type:
                "line",
              x1:
                0,
              y1:
                0,
              x2:
                515,
              y2:
                0,
              lineWidth:
                1,
            },
          ],

          margin: [
            0,
            0,
            0,
            12,
          ],
        },

        /*
         * TITLE
         */
        {
          text:
            "BUKTI REGISTRASI PENGAJUAN",
          alignment:
            "center",
          bold: true,
          fontSize:
            15,
          margin: [
            0,
            0,
            0,
            10,
          ],
        },

        /*
         * REGISTRATION NUMBER + QR
         */
        {
          table: {
            widths: [
              "*",
              115,
            ],

            body: [
              [
                {
                  stack: [
                    {
                      text:
                        "NOMOR RESI",
                      fontSize:
                        8,
                      bold: true,
                      color:
                        "#666666",
                    },

                    {
                      text:
                        registrationNo,
                      fontSize:
                        16,
                      bold: true,
                      margin: [
                        0,
                        4,
                        0,
                        0,
                      ],
                    },
                  ],
                },

                {
                  qr:
                    qrPayload,

                  fit:
                    105,

                  alignment:
                    "right",
                },
              ],
            ],
          },

          layout:
            "noBorders",

          margin: [
            0,
            0,
            0,
            14,
          ],
        },

        /*
         * DATA PEMOHON
         */
        {
          table: {
            widths: [
              135,
              "*",
            ],

            body: [
              [
                {
                  text:
                    "Nomor Antrian",
                  bold:
                    true,
                },

                {
                  text:
                    `: ${
                      queueNo ||
                      "-"
                    }`,
                },
              ],

              [
                {
                  text:
                    "NIK",
                  bold:
                    true,
                },

                {
                  text:
                    `: ${nik}`,
                },
              ],

              [
                {
                  text:
                    "Nama Pemohon",
                  bold:
                    true,
                },

                {
                  text:
                    `: ${applicantName}`,
                },
              ],

              [
                {
                  text:
                    "Jenis Pelayanan",
                  bold:
                    true,
                },

                {
                  text:
                    `: ${
                      productCode
                        ? `${productCode} - `
                        : ""
                    }${
                      productName ||
                      "-"
                    }`,
                },
              ],

              [
                {
                  text:
                    "Lokasi Pelayanan",
                  bold:
                    true,
                },

                {
                  text:
                    `: ${
                      locationCode
                        ? `${locationCode} - `
                        : ""
                    }${
                      locationName ||
                      "-"
                    }`,
                },
              ],

              [
                {
                  text:
                    "Tanggal Pengajuan",
                  bold:
                    true,
                },

                {
                  text:
                    `: ${createdDate} ${createdTime}`,
                },
              ],

              [
                {
                  text:
                    "Status",
                  bold:
                    true,
                },

                {
                  text:
                    `: ${
                      status ||
                      "-"
                    }`,
                  bold:
                    true,
                },
              ],
            ],
          },

          layout: {
            hLineWidth: (
              i: number,
            ) =>
              i === 0
                ? 0
                : 0.3,

            vLineWidth:
              () => 0,

            hLineColor:
              () =>
                "#D8D8D8",

            paddingTop:
              () => 5,

            paddingBottom:
              () => 5,

            paddingLeft:
              () => 4,

            paddingRight:
              () => 4,
          },

          margin: [
            0,
            0,
            0,
            15,
          ],
        },

        /*
         * INFORMASI
         */
        {
          text:
            "INFORMASI PENTING",
          bold:
            true,
          fontSize:
            10,
          margin: [
            0,
            0,
            0,
            6,
          ],
        },

        {
          ul: [
            {
              text:
                "Simpan resi ini sebagai bukti registrasi pengajuan.",
              fontSize:
                8.5,
            },

            {
              text:
                "Gunakan Nomor Resi atau QR Code untuk memantau status pengajuan.",
              fontSize:
                8.5,
            },

            {
              text:
                "Pastikan nomor HP yang tercantum benar agar informasi pelayanan dapat disampaikan.",
              fontSize:
                8.5,
            },

            {
              text:
                "Apabila terdapat kendala, silakan menghubungi layanan resmi Disdukcapil Kota Bandung.",
              fontSize:
                8.5,
            },
          ],

          margin: [
            8,
            0,
            0,
            14,
          ],
        },

        {
          canvas: [
            {
              type:
                "line",

              x1:
                0,

              y1:
                0,

              x2:
                515,

              y2:
                0,

              lineWidth:
                0.5,
            },
          ],

          margin: [
            0,
            4,
            0,
            7,
          ],
        },

        {
          text:
            "Dokumen ini diterbitkan secara elektronik oleh Sistem MONALISA.",

          alignment:
            "center",

          fontSize:
            7.5,

          color:
            "#666666",
        },

        {
          text:
            "Disdukcapil Kota Bandung",

          alignment:
            "center",

          fontSize:
            7.5,

          color:
            "#666666",

          margin: [
            0,
            3,
            0,
            0,
          ],
        },
      ],
    };

  /*
   * ==========================================================
   * GENERATE BUFFER
   * ==========================================================
   */

  const buffer =
    await new Promise<Buffer>(
      (
        resolve,
        reject,
      ) => {
        try {
          pdfMake
            .createPdf(
              documentDefinition,
            )
            .getBuffer(
              (
                generated: Uint8Array,
              ) => {
                resolve(
                  Buffer.from(
                    generated,
                  ),
                );
              },
            );
        } catch (
          cause
        ) {
          reject(
            cause,
          );
        }
      },
    );

  /*
   * ==========================================================
   * BUFFER -> ARRAYBUFFER
   * ==========================================================
   *
   * INI YANG MEMPERBAIKI ERROR DI SCREENSHOT.
   */
  const arrayBuffer =
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset +
        buffer.byteLength,
    );

  /*
   * TypeScript dapat menganggap ArrayBufferLike.
   *
   * Pastikan return type yang diterima Response
   * benar-benar ArrayBuffer.
   */
  return arrayBuffer as ArrayBuffer;
}

/*
 * ============================================================
 * GET
 * ============================================================
 */

export async function GET(
  req: NextRequest,
) {
  const started =
    Date.now();

  const {
    ip,
    ua,
  } =
    await getClientInfo();

  try {
    /*
     * ========================================================
     * SESSION
     * ========================================================
     */

    const session =
      await readServerSession();

    if (
      !session?.S_USER_ID
    ) {
      return unauthorized(
        "Unauthorized",
      );
    }

    /*
     * ========================================================
     * PARAMETER
     * ========================================================
     */

    const url =
      new URL(
        req.url,
      );

    const trackingIdRaw =
      url.searchParams.get(
        "trackingId",
      );

    if (
      !trackingIdRaw
    ) {
      return badRequest(
        "trackingId wajib diisi.",
      );
    }

    const trackingId =
      Number(
        trackingIdRaw,
      );

    if (
      !Number.isInteger(
        trackingId,
      ) ||
      trackingId <= 0
    ) {
      return badRequest(
        "trackingId tidak valid.",
      );
    }

    /*
     * ========================================================
     * DATABASE
     * ========================================================
     *
     * DB adalah SOURCE OF TRUTH.
     */
    const row =
      await execOne<ReceiptRow>(
        SQL_RECEIPT,
        {
          b_tracking_id:
            trackingId,
        },
        {},
        ORACLE_ALIAS,
      );

    if (!row) {
      await Log.warn({
        scope:
          "API",

        msg:
          "espasi/receipt_not_found",

        at:
          AT,

        user:
          session.S_USER_ID,

        ip,

        ua,

        tookMs:
          Date.now() -
          started,

        extra: {
          trackingId,
        },
      });

      return new Response(
        JSON.stringify({
          success:
            false,

          message:
            "Data pengajuan Tracking tidak ditemukan.",
        }),
        {
          status:
            404,

          headers: {
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    /*
     * ========================================================
     * VALIDASI DATA RESI
     * ========================================================
     */

    if (
      !text(
        row.REGISTRATION_NO,
      )
    ) {
      throw new Error(
        "Nomor registrasi tidak tersedia.",
      );
    }

    if (
      !text(
        row.APPLICANT_NAME,
      )
    ) {
      throw new Error(
        "Nama pemohon tidak tersedia.",
      );
    }

    /*
     * ========================================================
     * CREATE PDF
     * ========================================================
     */

    const pdf =
      await createReceiptPdf(
        row,
      );

    /*
     * ========================================================
     * AUDIT
     * ========================================================
     *
     * Jangan gunakan scope EXPORT.
     *
     * LogScope aktual project hanya:
     * API / DB / SESSION / MIDDLEWARE /
     * SYSTEM / ACCOUNT / OTHER.
     */
    await Log.info({
      scope:
        "API",

      msg:
        "espasi/receipt",

      at:
        AT,

      user:
        session.S_USER_ID,

      ip,

      ua,

      tookMs:
        Date.now() -
        started,

      extra: {
        trackingId:
          row.REQUEST_ID,

        registrationNo:
          row.REGISTRATION_NO,

        productId:
          row.PRODUCT_ID,

        locationId:
          row.LOCATION_ID,

        source:
          row.SOURCE,
      },
    });

    /*
     * ========================================================
     * PDF RESPONSE
     * ========================================================
     */

    return new Response(
      pdf,
      {
        status:
          200,

        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `inline; filename="Resi-${row.REGISTRATION_NO}.pdf"`,

          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",

          Pragma:
            "no-cache",

          Expires:
            "0",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (
    cause: any
  ) {
    /*
     * ========================================================
     * ERROR LOG
     * ========================================================
     */

    await Log.error({
      scope:
        "API",

      msg:
        "espasi/receipt_err",

      at:
        AT,

      ip,

      ua,

      tookMs:
        Date.now() -
        started,

      err: {
        name:
          cause?.name ??
          "Error",

        message:
          cause?.message ??
          String(
            cause,
          ),

        stack:
          cause?.stack,
      },
    });

    return err(
      "Terjadi kesalahan server. Silakan coba lagi.",
    );
  }
}