// FILE: src/app/api/espasi/access/route.ts

import type { NextRequest } from "next/server";
import {
  err,
  forbidden,
  ok,
  unauthorized,
} from "@/lib/http";
import { execOne } from "@/lib/db";
import { Log } from "@/lib/log";
import { readServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * M_ESPASI_USER berada pada database monitoring.
 *
 * Sesuaikan ALIAS hanya jika M_ESPASI_USER ternyata
 * berada pada alias Oracle yang berbeda.
 */
const ALIAS = "WEBDB";

const SQL_ACCESS = `
SELECT
    USERNAME,
    NAME,
    ROLE_NAME,
    LOKET,
    LOKASI
FROM M_ESPASI_USER@YZDB
WHERE UPPER(USERNAME) = UPPER(:b_username)
FETCH FIRST 1 ROW ONLY
`;

type EspasiAccessRow = {
  USERNAME?: string;
  NAME?: string;
  ROLE_NAME?: string;
  LOKET?: string;
  LOKASI?: string;
};

function text(value: unknown): string {
  return value === null ||
    value === undefined
    ? ""
    : String(value).trim();
}

function normalizeRole(
  value: unknown,
): string {
  return text(value).toUpperCase();
}

export async function GET(
  _req: NextRequest,
) {
  const startedAt =
    Date.now();

  try {
    const sess =
      await readServerSession();

    if (!sess?.S_USER_ID) {
      return unauthorized(
        "Sesi tidak ditemukan",
      );
    }

    const username =
      text(sess.S_USER_ID);

    const row =
      (await execOne(
        SQL_ACCESS,
        {
          b_username:
            username,
        },
        {},
        ALIAS,
      )) as
        | EspasiAccessRow
        | null
        | undefined;

    if (!row) {
      await Log.warn({
        scope: "API",
        msg:
          "ESPASI access denied - user tidak terdaftar",
        user:
          username,
        tookMs:
          Date.now() -
          startedAt,
      });

      return forbidden(
        "User tidak terdaftar sebagai pengguna ESPASI",
      );
    }

    const roleName =
      normalizeRole(
        row.ROLE_NAME,
      );

    const isAdmin =
      roleName === "ADMIN";

    const lokasi =
      text(row.LOKASI);

    const loket =
      text(row.LOKET);

    /*
     * User Loket wajib memiliki LOKASI + LOKET.
     *
     * Admin boleh memilih lokasi/loket dari UI,
     * tetapi API tetap mengembalikan identitas dasarnya.
     */
    if (
      !isAdmin &&
      (
        !lokasi ||
        !loket
      )
    ) {
      await Log.warn({
        scope: "API",
        msg:
          "ESPASI access denied - mapping loket tidak lengkap",
        user:
          username,
        extra: {
          roleName,
          lokasi,
          loket,
        },
        tookMs:
          Date.now() -
          startedAt,
      });

      return forbidden(
        "Mapping lokasi/loket user belum lengkap",
      );
    }

    await Log.info({
      scope: "API",
      msg:
        "ESPASI access resolved",
      user:
        username,
      extra: {
        roleName,
        lokasi:
          isAdmin
            ? "ADMIN"
            : lokasi,
        loket:
          isAdmin
            ? "SELECTABLE"
            : loket,
      },
      tookMs:
        Date.now() -
        startedAt,
    });

    return ok(
      {
        username,
        name:
          text(row.NAME) ||
          username,
        roleName,
        lokasi,
        loket,

        isAdmin,

        canChooseLokasi:
          isAdmin,

        canChooseLoket:
          isAdmin,
      },
      "OK",
    );
  } catch (e: unknown) {
    await Log.error({
      scope: "API",
      msg:
        "ESPASI access failed",
      user: undefined,
      tookMs:
        Date.now() -
        startedAt,
      err:
        e instanceof Error
          ? e
          : new Error(
              String(e),
            ),
    });

    return err(
      "Terjadi kesalahan server. Silakan coba lagi.",
    );
  }
}