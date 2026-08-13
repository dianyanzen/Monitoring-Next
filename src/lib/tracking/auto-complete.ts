import { execRows, withTransaction } from "@/lib/db";
import { normalizeDigits, normalizeUpper } from "@/lib/tracking/constants";

const ORACLE_ALIAS = process.env.DB_ALIAS_TRACKING ?? "DB";
const KTPEL_SEARCH_ALIAS = (process.env.KTPEL_DB_ALIAS || "DB5CETAK").toUpperCase();
const AUTO_COMPLETED_BY = "SYSTEM_AUTO";
const KTP_EL_TRACKING_KEYWORDS = [
  "KTP-EL",
  "KTP EL",
  "KTPEL",
  "KTP ELEKTRONIK",
  "PEREKAMAN KTP",
  "PENCETAKAN KTP",
] as const;

type PendingAutoCompleteRow = {
  REQUEST_ID: number;
  NIK: string | null;
  PRODUCT_NAME: string;
  CREATED_AT: string;
};

type KtpelPrintedDateRow = {
  NIK: string;
  KTP_DT: string | null;
};

function isKtpelTrackingProductName(value: unknown) {
  const normalized = normalizeUpper(String(value ?? ""));
  return KTP_EL_TRACKING_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function parseIsoDateOnly(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function parseDdMmYyyy(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchKtpelPrintedDateByNik(niks: string[]) {
  if (!niks.length) return new Map<string, Date>();

  const printedDateByNik = new Map<string, Date>();
  for (const chunk of chunkArray(niks, 200)) {
    const placeholders = chunk.map((_, index) => `:b_nik_${index}`);
    const binds = Object.fromEntries(chunk.map((nik, index) => [`b_nik_${index}`, nik]));
    const rows = await execRows<KtpelPrintedDateRow>(
      `
      SELECT
        A.NIK,
        CASE
          WHEN TO_CHAR(G.LAST_UPDATE,'DD-MM-YYYY') IS NULL AND TO_CHAR(G.PERSONALIZED_DATE,'DD-MM-YYYY') IS NULL THEN '-'
          WHEN TO_CHAR(G.LAST_UPDATE,'DD-MM-YYYY') IS NULL AND TO_CHAR(G.PERSONALIZED_DATE,'DD-MM-YYYY') IS NOT NULL THEN TO_CHAR(G.PERSONALIZED_DATE,'DD-MM-YYYY')
          ELSE TO_CHAR(G.LAST_UPDATE,'DD-MM-YYYY')
        END AS KTP_DT
      FROM DEMOGRAPHICS_ALL A
      LEFT JOIN (
        SELECT NIK, PERSONALIZED_DATE, LAST_UPDATE
        FROM (
          SELECT NIK, PERSONALIZED_DATE, LAST_UPDATE,
                 RANK() OVER (PARTITION BY NIK ORDER BY PERSONALIZED_DATE DESC, LAST_UPDATE DESC, CHIP_ID DESC) RNK
          FROM CARD_MANAGEMENT
        )
        WHERE RNK = 1
      ) G ON G.NIK = A.NIK
      WHERE A.NIK IN (${placeholders.join(", ")})
      `,
      binds,
      {},
      KTPEL_SEARCH_ALIAS
    );

    for (const row of rows) {
      const nik = normalizeDigits(row.NIK, 16);
      const printedDate = parseDdMmYyyy(row.KTP_DT);
      if (nik && printedDate) {
        printedDateByNik.set(nik, printedDate);
      }
    }
  }

  return printedDateByNik;
}

export async function syncAutoCompletedTracking() {
  const pendingRows = await execRows<PendingAutoCompleteRow>(
    `
    SELECT
      T.REQUEST_ID,
      T.NIK,
      P.PRODUCT_NAME,
      TO_CHAR(T.CREATED_AT, 'YYYY-MM-DD HH24:MI:SS') AS CREATED_AT
    FROM M_TRACKING_REQUEST T
    JOIN M_TRACKING_PRODUCT P ON P.PRODUCT_ID = T.PRODUCT_ID
    WHERE T.IS_ACTIVE = 'Y'
      AND T.STATUS = 'BERKAS_MASUK'
    `,
    {},
    {},
    ORACLE_ALIAS
  );

  if (!pendingRows.length) return { updatedCount: 0 };

  const ktpelRows = pendingRows.filter((row) => isKtpelTrackingProductName(row.PRODUCT_NAME));
  const nonKtpRows = pendingRows.filter((row) => !isKtpelTrackingProductName(row.PRODUCT_NAME));
  const printedDateByNik = await fetchKtpelPrintedDateByNik(
    Array.from(new Set(ktpelRows.map((row) => normalizeDigits(row.NIK, 16)).filter((nik) => nik.length === 16)))
  );

  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const staleThreshold = new Date(todayDateOnly);
  staleThreshold.setDate(staleThreshold.getDate() - 7);

  const requestIdsToComplete = new Set<number>();
  for (const row of nonKtpRows) {
    const createdDate = parseIsoDateOnly(row.CREATED_AT);
    if (createdDate && createdDate < staleThreshold) {
      requestIdsToComplete.add(Number(row.REQUEST_ID));
    }
  }

  for (const row of ktpelRows) {
    const nik = normalizeDigits(row.NIK, 16);
    const createdDate = parseIsoDateOnly(row.CREATED_AT);
    const printedDate = printedDateByNik.get(nik);
    if (!createdDate || !printedDate) continue;
    if (printedDate.getTime() > createdDate.getTime()) {
      requestIdsToComplete.add(Number(row.REQUEST_ID));
    }
  }

  const requestIds = Array.from(requestIdsToComplete).filter((id) => Number.isFinite(id) && id > 0);
  if (!requestIds.length) return { updatedCount: 0 };

  let updatedCount = 0;
  await withTransaction(
    async (conn) => {
      for (const chunk of chunkArray(requestIds, 200)) {
        const placeholders = chunk.map((_, index) => `:b_id_${index}`);
        const binds = Object.fromEntries(chunk.map((id, index) => [`b_id_${index}`, id]));
        const result = await conn.execute(
          `
          UPDATE M_TRACKING_REQUEST
          SET STATUS = 'SELESAI',
              UPDATED_BY = :b_user,
              UPDATED_AT = SYSDATE
          WHERE REQUEST_ID IN (${placeholders.join(", ")})
            AND STATUS = 'BERKAS_MASUK'
            AND IS_ACTIVE = 'Y'
          `,
          {
            b_user: AUTO_COMPLETED_BY,
            ...binds,
          },
          { autoCommit: false }
        );
        updatedCount += Number(result.rowsAffected ?? 0);
      }
    },
    ORACLE_ALIAS
  );

  return { updatedCount };
}