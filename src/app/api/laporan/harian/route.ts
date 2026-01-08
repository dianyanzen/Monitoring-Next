// FILE: src/app/api/laporan/harian/route.ts
import { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import { getClientInfo, readServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/laporan/harian";
const ORACLE_ALIAS =
  process.env.DB_ALIAS_MONITORING ?? process.env.DB_ALIAS_CETAK ?? process.env.DB_ALIAS_PRR ?? "DB";

type RekapPelayananRow = { NO: number; DESCRIP: string; VAL: number };
type CetakWilayahRow = { NO_WIL: number; NAMA_WIL: string; JML: number };
type CetakPetugasRow = { KODE_WIL: number; USER_ID: string; NAMA_LGKP: string; JML: number };
type RekamPetugasRow = { KODE_WIL: number; USER_ID: string; NAMA_LGKP: string; JML: number };
type TunggakanRow = {
  USER_ID: string;
  NAMA_LGKP: string;
  NAMA_KANTOR: string;
  NIK: string;
  PENGAJUAN_S: string;
  PINDAHAN_S: string;
  PRR_S: string;
};
type HasilPelayananRow = {
  NO_WIL: number;
  NAMA_WIL: string;
  REKAM: number;
  CETAK: number;
  IKD: number;
  AKTE_17: number;
  KIA: number;
  JUMLAH: number;
};

/** keep only primitive for response safety */
function toPlain(obj: any): any {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map((x) => toPlain(x));
  if (typeof obj === "object") {
    const p: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) p[k] = v;
      else if (["string", "number", "boolean"].includes(typeof v)) p[k] = v;
    }
    return p;
  }
  return obj;
}

const isDMY = (val: string) => /^\d{2}-\d{2}-\d{4}$/.test(val.trim());

const SQL_REKAP_PELAYANAN = `
WITH P AS (
  SELECT TRUNC(TO_DATE(:b_start,'DD-MM-YYYY')) AS T1,
         TRUNC(TO_DATE(:b_end,'DD-MM-YYYY'))   AS T2
  FROM DUAL
)
SELECT * FROM (
  SELECT 
    A.NO,
    A.DESCRIP,
    CASE 
      WHEN A.DESCRIP = 'PENCETAKAN KTP-EL' THEN
        NVL(B.VAL, 0) + NVL(
          (SELECT SUM(D.AMBIL - D.RUSAK - D.PENGEMBALIAN) FROM SIAK_MONEV_BLANGKO_LUDO D, P WHERE TRUNC(D.TANGGAL) BETWEEN P.T1 AND P.T2),
          0
        )
      ELSE NVL(B.VAL, 0)
    END AS VAL
  FROM SIAK_MASTER_DASHBOARD A 
  LEFT JOIN (
    SELECT B.DESCRIP, C.ID, SUM(C.VAL) AS VAL
    FROM SIAK_MASTER_DASHBOARD B 
    INNER JOIN SIAK_DASHBOARD C ON B.VAL = C.ID
    CROSS JOIN P
    WHERE TRUNC(C.CREATED_DT) BETWEEN P.T1 AND P.T2
    GROUP BY B.DESCRIP, C.ID
  ) B ON A.VAL = B.ID
  UNION ALL
  SELECT 24 NO, 'JUMLAH BLANKO KTPEL YANG DIBAKAR' DESCRIP, SUM(JUMLAH) VAL
  FROM SIAK_BLANGKO_INVALID, P
  WHERE TRUNC(TANGGAL_MASUK) BETWEEN P.T1 AND P.T2 
  UNION ALL
  SELECT 25 NO, 'PENDUDUK RENTAN' DESCRIP, COUNT(1) VAL FROM T7_RTN_OT_BIODATA@DB222
  UNION ALL
  SELECT 26 NO, 'PENDUDUK NON PERMANEN' DESCRIP, COUNT(1) VAL FROM T7_NOPER_DETAIL@DB222
) ORDER BY NO
`;

const SQL_CETAK_WILAYAH = `
WITH P AS (
  SELECT TRUNC(TO_DATE(:b_start,'DD-MM-YYYY')) AS T1,
         TRUNC(TO_DATE(:b_end,'DD-MM-YYYY'))   AS T2
  FROM DUAL
)
SELECT 
    A.NO_WIL, 
    A.NAMA_WIL, 
    CASE WHEN B.JML IS NULL THEN 0 ELSE B.JML END AS JML  
FROM SIAK_KODE_WIL A 
LEFT JOIN (
    SELECT
        CASE 
            WHEN E.KODE_WIL IS NULL THEN 0 
            ELSE E.KODE_WIL 
        END AS KODE_WIL,
        COUNT(1) AS JML
    FROM CARD_MANAGEMENT@DB5CETAK A
    LEFT JOIN DEMOGRAPHICS@DB5CETAK B 
        ON A.NIK = B.NIK
    LEFT JOIN SIAK_CETAK_GOIB@YZDB D 
        ON REPLACE(
                UPPER(
                    CASE 
                        WHEN A.LAST_UPDATED_USERNAME IS NULL 
                        THEN A.CREATED_USERNAME 
                        ELSE A.LAST_UPDATED_USERNAME 
                    END
                ), 
            ' ', '') = UPPER(D.USER_BCARD)
        AND D.IS_ACTIVE = 1
    LEFT JOIN SIAK_USER_EKTP E 
        ON REPLACE(
                UPPER(
                    CASE 
                        WHEN A.LAST_UPDATED_USERNAME IS NULL 
                        THEN A.CREATED_USERNAME 
                        ELSE A.LAST_UPDATED_USERNAME 
                    END
                ), 
            ' ', '') = UPPER(E.USER_ID)
    CROSS JOIN P
    WHERE 1=1 
      AND D.USER_BCARD IS NULL
      AND E.KATEGORI = 2
      AND TRUNC(COALESCE(A.LAST_UPDATE, A.PERSONALIZED_DATE)) BETWEEN P.T1 AND P.T2
    GROUP BY E.KODE_WIL 
    ORDER BY E.KODE_WIL
) B 
ON A.NO_WIL = B.KODE_WIL
`;

const SQL_CETAK_PETUGAS = `
WITH P AS (
  SELECT TRUNC(TO_DATE(:b_start,'DD-MM-YYYY')) AS T1,
         TRUNC(TO_DATE(:b_end,'DD-MM-YYYY'))   AS T2
  FROM DUAL
)
SELECT 
    A.KODE_WIL,
    A.USER_ID,
    A.NAMA_LGKP,
    CASE WHEN B.JML IS NULL THEN 0 ELSE B.JML END AS JML
FROM SIAK_USER_EKTP A
LEFT JOIN (
    SELECT
        REPLACE(
          UPPER(
            CASE 
              WHEN A.LAST_UPDATED_USERNAME IS NULL THEN A.CREATED_USERNAME 
              ELSE A.LAST_UPDATED_USERNAME 
            END
          ), ' ', ''
        ) AS PETUGAS_CETAK,
        COUNT(1) AS JML
    FROM CARD_MANAGEMENT@DB5CETAK A
    INNER JOIN DEMOGRAPHICS@DB5CETAK B 
        ON A.NIK = B.NIK
    LEFT JOIN SIAK_CETAK_GOIB@YZDB D 
        ON REPLACE(
                UPPER(
                    CASE 
                        WHEN A.LAST_UPDATED_USERNAME IS NULL 
                        THEN A.CREATED_USERNAME 
                        ELSE A.LAST_UPDATED_USERNAME 
                    END
                ), 
            ' ', '') = UPPER(D.USER_BCARD)
        AND D.IS_ACTIVE = 1
    CROSS JOIN P
    WHERE 1=1 
      AND D.USER_BCARD IS NULL
      AND (B.TGL_LHR <= ADD_MONTHS(SYSDATE,-12*17) OR B.STAT_KWN <> 'BELUM KAWIN')
      AND TRUNC(COALESCE(A.LAST_UPDATE, A.PERSONALIZED_DATE)) BETWEEN P.T1 AND P.T2
    GROUP BY REPLACE(
      UPPER(
        CASE 
          WHEN A.LAST_UPDATED_USERNAME IS NULL THEN A.CREATED_USERNAME 
          ELSE A.LAST_UPDATED_USERNAME 
        END
      ), ' ', ''
    )
) B 
ON REPLACE(UPPER(A.USER_ID), ' ', '') = B.PETUGAS_CETAK
WHERE A.KODE_WIL <> 0
  AND A.KATEGORI = 2
ORDER BY A.KODE_WIL, A.NAMA_LGKP
`;

const SQL_REKAM_PETUGAS = `
WITH P AS (
  SELECT TRUNC(TO_DATE(:b_start,'DD-MM-YYYY')) AS T1,
         TRUNC(TO_DATE(:b_end,'DD-MM-YYYY'))   AS T2
  FROM DUAL
)
SELECT A.KODE_WIL, A.USER_ID, A.NAMA_LGKP, CASE WHEN B.JML IS NULL THEN 0 ELSE B.JML END AS JML
FROM SIAK_USER_EKTP A
LEFT JOIN (
  SELECT
    A.CREATED_USERNAME,
    COUNT(1) AS JML
  FROM DEMOGRAPHICS@DB5 A
  INNER JOIN FINGERS@DB5 X ON A.NIK = X.NIK
  CROSS JOIN P
  WHERE TRUNC(X.CREATED) BETWEEN P.T1 AND P.T2
  GROUP BY A.CREATED_USERNAME
) B
  ON A.USER_ID = B.CREATED_USERNAME
WHERE A.KODE_WIL <> 0
  AND A.KATEGORI = 1
ORDER BY KODE_WIL, NAMA_LGKP
`;

const SQL_TUNGGAKAN = `
SELECT 
    A.USER_ID
    , A.NAMA_LGKP
    , A.NAMA_KANTOR
    , A.NIK 
    , CASE WHEN TO_CHAR(G.JML) = '0' OR TO_CHAR(G.JML) IS NULL THEN '-' ELSE TO_CHAR(G.JML) END AS PENGAJUAN_S 
    , CASE WHEN TO_CHAR(I.JML) = '0' OR TO_CHAR(I.JML) IS NULL THEN '-' ELSE TO_CHAR(I.JML) END AS PINDAHAN_S 
    , CASE WHEN TO_CHAR(H.JML) = '0' OR TO_CHAR(H.JML) IS NULL THEN '-' ELSE TO_CHAR(H.JML) END AS PRR_S 
FROM SIAK_USER_PLUS A LEFT JOIN  
(SELECT A.NO_KEC, COUNT(1) AS JML
FROM  (SELECT ID_CETAK,NO_KEC,NO_KEL, NIK,NAMA_LENGKAP,REQ_DATE,REQ_BY,STEP_PROC,PROC_BY FROM 
(SELECT  ID_CETAK, NO_KEC,NO_KEL, NIK,NAMA_LENGKAP,REQ_DATE,REQ_BY,STEP_PROC,PROC_BY, RANK() OVER (PARTITION BY NIK ORDER BY REQ_BY DESC, ID_CETAK DESC) RNK FROM SIAK_REQ_CETAK_KTP WHERE STEP_PROC <> 'C') WHERE RNK = 1) A 
LEFT JOIN DEMOGRAPHICS_ALL@DB2 B ON A.NIK = B.NIK LEFT JOIN (SELECT NIK,PERSONALIZED_DATE,CREATED_USERNAME,LAST_UPDATED_USERNAME,LAST_UPDATE FROM (SELECT NIK,PERSONALIZED_DATE,CREATED_USERNAME,LAST_UPDATED_USERNAME,LAST_UPDATE, RANK() OVER (PARTITION BY NIK ORDER BY  PERSONALIZED_DATE DESC, LAST_UPDATE DESC, CHIP_ID DESC) RNK FROM CARD_MANAGEMENT@DB5CETAK) WHERE RNK = 1) C ON A.NIK = C.NIK  WHERE 1=1 AND (TRUNC(A.REQ_DATE) > CASE WHEN C.LAST_UPDATE IS NULL THEN TRUNC(C.PERSONALIZED_DATE) ELSE TRUNC(C.LAST_UPDATE) END OR C.PERSONALIZED_DATE IS NULL) GROUP BY A.NO_KEC) G ON A.NO_KEC = G.NO_KEC 
LEFT JOIN  
(SELECT A.NO_KEC, COUNT(1) AS JML
FROM  (SELECT ID_CETAK,NO_KEC, NIK,NAMA_LENGKAP,REQ_DATE,REQ_BY,STEP_PROC,PROC_BY FROM 
(SELECT  ID_CETAK, NO_KEC, NIK,NAMA_LENGKAP,REQ_DATE,REQ_BY,STEP_PROC,PROC_BY, RANK() OVER (PARTITION BY NIK ORDER BY REQ_BY DESC, ID_CETAK DESC) RNK FROM SIAK_REQ_CETAK_KTPLD WHERE STEP_PROC <> 'C') WHERE RNK = 1) A 
LEFT JOIN (SELECT NIK,PERSONALIZED_DATE,CREATED_USERNAME,LAST_UPDATED_USERNAME,LAST_UPDATE FROM (SELECT NIK,PERSONALIZED_DATE,CREATED_USERNAME,LAST_UPDATED_USERNAME,LAST_UPDATE, RANK() OVER (PARTITION BY NIK ORDER BY  PERSONALIZED_DATE DESC, LAST_UPDATE DESC, CHIP_ID DESC) RNK FROM CARD_MANAGEMENT@DB5CETAK) WHERE RNK = 1) C ON A.NIK = C.NIK  WHERE 1=1 AND (TRUNC(A.REQ_DATE) > CASE WHEN C.LAST_UPDATE IS NULL THEN TRUNC(C.PERSONALIZED_DATE) ELSE TRUNC(C.LAST_UPDATE) END OR C.PERSONALIZED_DATE IS NULL) GROUP BY A.NO_KEC) I ON A.NO_KEC = I.NO_KEC
LEFT JOIN (SELECT A.NO_KEC, COUNT(1) AS JML FROM  DEMOGRAPHICS A LEFT JOIN CARD_MANAGEMENT D ON A.NIK = D.NIK WHERE A.CURRENT_STATUS_CODE = 'PRINT_READY_RECORD' AND (A.TGL_LHR<=ADD_MONTHS(SYSDATE,-12*17) OR A.STAT_KWN<>'BELUM KAWIN')  AND D.NIK IS NULL GROUP BY A.NO_KEC) H ON A.NO_KEC = H.NO_KEC  
WHERE A.USER_LEVEL = 1 AND A.IS_SHOW = 1 ORDER BY TO_NUMBER(A.NO_KEC)
`;

const SQL_HASIL_PELAYANAN = `
WITH P AS (
  SELECT TRUNC(TO_DATE(:b_start,'DD-MM-YYYY')) AS T1,
         TRUNC(TO_DATE(:b_end,'DD-MM-YYYY'))   AS T2
  FROM DUAL
)
select A.no_WIL, A.NAMA_WIL
,CASE WHEN b.rekam IS NULL THEN 0 ELSE b.rekam END AS rekam
, CASE WHEN b.cetak IS NULL THEN 0 ELSE b.cetak END AS cetak
, CASE WHEN b.ikd IS NULL THEN 0 ELSE b.ikd END AS ikd
, CASE WHEN b.akte_17 IS NULL THEN 0 ELSE b.akte_17 END AS akte_17
, CASE WHEN b.kia IS NULL THEN 0 ELSE b.kia END AS kia
, CASE WHEN b.jumlah IS NULL THEN 0 ELSE b.jumlah END AS jumlah
from SIAK_KODE_WIL a 
CROSS JOIN P
left join (
  select no_wil,sum(rekam) rekam
  ,sum(cetak) cetak
  ,sum(ikd) ikd
  ,sum(akte_17) akte_17
  ,sum(kia) kia
  ,sum(jumlah) jumlah 
  from siak_monev_laporan, P 
  where trunc(tanggal) between P.T1 and P.T2 
  group by no_wil
) b on a.no_WIL = b.no_wil
order by a.no_wil
`;

const PARTS = [
  "rekapPelayanan",
  "cetakPerWilayah",
  "cetakPerPetugas",
  "rekamPerPetugas",
  "tunggakanPerWilayah",
  "hasilPelayanan",
] as const;
type PartKey = (typeof PARTS)[number];

export async function POST(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();

  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const body = await req.json().catch(() => ({} as any));
    const startDate = String(body?.startDate || body?.tgl_start || "").trim();
    const endDate = String(body?.endDate || body?.tgl_end || "").trim() || startDate;

    const urlPart = req.nextUrl.searchParams.get("part") ?? "";
    const bodyPart = String(body?.part ?? "").trim();
    const rawPart = urlPart || bodyPart;
    const requestedParts = (rawPart || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => PARTS.includes(s as PartKey)) as PartKey[];
    const parts: PartKey[] = requestedParts.length ? requestedParts : [...PARTS];

    if (!isDMY(startDate) || !isDMY(endDate)) {
      return badRequest("Format tanggal harus DD-MM-YYYY");
    }

    const binds = { b_start: startDate, b_end: endDate };

    const runners: Record<PartKey, () => Promise<any[]>> = {
      rekapPelayanan: () => execRows<RekapPelayananRow>(SQL_REKAP_PELAYANAN, binds, {}, ORACLE_ALIAS),
      cetakPerWilayah: () => execRows<CetakWilayahRow>(SQL_CETAK_WILAYAH, binds, {}, ORACLE_ALIAS),
      cetakPerPetugas: () => execRows<CetakPetugasRow>(SQL_CETAK_PETUGAS, binds, {}, ORACLE_ALIAS),
      rekamPerPetugas: () => execRows<RekamPetugasRow>(SQL_REKAM_PETUGAS, binds, {}, ORACLE_ALIAS),
      tunggakanPerWilayah: () => execRows<TunggakanRow>(SQL_TUNGGAKAN, {}, {}, ORACLE_ALIAS),
      hasilPelayanan: () => execRows<HasilPelayananRow>(SQL_HASIL_PELAYANAN, binds, {}, ORACLE_ALIAS),
    };

    const data: Record<string, any> = { startDate, endDate };
    await Promise.all(
      parts.map(async (p) => {
        const rows = await runners[p]();
        data[p] = toPlain(rows);
      })
    );

    await Log.info({
      scope: "API",
      msg: "laporan_harian",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: {
        startDate,
        endDate,
        parts,
        counts: parts.reduce<Record<string, number>>((acc, p) => {
          const arr = data[p] as any[];
          acc[p] = Array.isArray(arr) ? arr.length : 0;
          return acc;
        }, {}),
      },
    });

    return ok(data);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "laporan_harian_error",
      at: AT,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat laporan harian");
  }
}
