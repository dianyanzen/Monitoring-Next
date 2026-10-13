import { execOne } from "@/lib/db";

const ORACLE_ALIAS = "DB";

export async function hasPdakUploadAccess(userLevel: number | undefined) {
  return hasPdakMenuAccess(userLevel, "pdak/upload");
}

export async function hasPdakViewAccess(userLevel: number | undefined) {
  return hasPdakMenuAccess(userLevel, "pdak/data");
}
export async function hasIkdRankingAccess(userLevel: number | undefined) {
  return hasPdakMenuAccess(userLevel, "pdak/ikd/ranking");
}

async function hasPdakMenuAccess(userLevel: number | undefined, url: string) {
  const level = Number(userLevel);
  if (!Number.isInteger(level) || level < 1) return false;
  const row = await execOne<{ ACCESS_GRANTED?: number }>(
    `
    SELECT 1 AS ACCESS_GRANTED
    FROM VW_SIAK_MENU
    WHERE USER_LEVEL = :b_user_level
      AND LOWER(TRIM(BOTH '/' FROM TRIM(URL))) = :b_url
      AND ACTIVE_MENU = 1
      AND IS_NEXT = 1
      AND IS_ACTIVE = 1
      AND ROWNUM = 1
    `,
    { b_user_level: level, b_url: url },
    {},
    ORACLE_ALIAS,
  );
  return Number(row?.ACCESS_GRANTED ?? 0) === 1;
}
