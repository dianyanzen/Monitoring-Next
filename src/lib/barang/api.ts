import { ok, err, badRequest, unauthorized, forbidden } from "@/lib/http";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import { inventoryPermissions, allowed, type InventoryMode } from "./access";
import { readInventory, saveInventory } from "./repository";
import { InventoryError, number } from "./validation";
export async function inventoryApi(req: Request, mode: string) {
  const started = Date.now();
  try {
    const user = await readServerSession();
    if (!user?.S_USER_ID) return unauthorized();
    const paths = await inventoryPermissions(user.S_USER_LEVEL);
    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      if (Number(req.headers.get("content-length") ?? 0) > 16384)
        return badRequest("Payload terlalu besar.");
      try {
        const raw = await req.json();
        if (!raw || Array.isArray(raw) || typeof raw !== "object")
          return badRequest("Payload tidak valid.");
        body = raw;
      } catch {
        return badRequest("Payload JSON tidak valid.");
      }
    } else body = Object.fromEntries(new URL(req.url).searchParams);
    const action = String(body.action ?? "list").toLowerCase();
    const mutation = ["create", "update", "delete"].includes(action);
    let permitted = false;
    if (mode === "options" || mode === "summary")
      permitted = [
        "master",
        "inputaset",
        "masuk",
        "keluar",
        "status",
        "laporan",
      ].some((m) => allowed(paths, m as InventoryMode));
    else if (mode === "aset-options")
      permitted =
        allowed(paths, "aset") ||
        allowed(paths, "cekaset") ||
        allowed(paths, "laporanaset");
    else if (mode === "master" && action === "create")
      permitted = allowed(paths, "master") || allowed(paths, "inputaset");
    else if (mode === "master" && !mutation)
      permitted = allowed(paths, "master") || allowed(paths, "inputaset");
    else permitted = allowed(paths, mode as InventoryMode);
    if (!permitted)
      return forbidden("Anda tidak memiliki izin untuk menu ini.");
    if (mutation) {
      if (req.method !== "POST")
        return badRequest("Perubahan data wajib menggunakan POST.");
      const origin = req.headers.get("origin");
      if (
        req.headers.get("sec-fetch-site") === "cross-site" ||
        (origin && origin !== new URL(req.url).origin)
      )
        return forbidden("Permintaan lintas situs ditolak.");
      if (!["master", "masuk", "keluar", "aset"].includes(mode))
        return badRequest("Menu ini hanya mendukung pembacaan.");
      const result = await saveInventory(
        mode as "master" | "masuk" | "keluar" | "aset",
        { ...body, action },
        user.S_USER_ID,
      );
      await Log.info({
        scope: "API",
        msg: `barang/${mode}/${action}`,
        user: user.S_USER_ID,
        extra: { result },
        tookMs: Date.now() - started,
      });
      return ok(
        result,
        result.duplicate
          ? "Permintaan yang sama sudah tersimpan."
          : "Perubahan berhasil disimpan.",
      );
    }
    if (!["list", "detail"].includes(action))
      return badRequest("Aksi tidak dikenali.");
    if (mode === "summary") {
      const rows = (await readInventory("status", {})) as Record<
        string,
        unknown
      >[];
      return ok({
        total: rows.length,
        available: rows.filter((r) => Number(r.SALDO_QTY) > 0).length,
        empty: rows.filter((r) => Number(r.SALDO_QTY) === 0).length,
        negative: rows.filter((r) => Number(r.SALDO_QTY) < 0).length,
        value: rows.reduce((a, r) => a + Number(r.HARGA_ASET ?? 0), 0),
      });
    }
    if (action === "detail") {
      const id = number(
        body.id ?? body.seq_id ?? body.no ?? body.aset_no,
        "ID",
        true,
        true,
      );
      const rows = (await readInventory(mode, {
        ...body,
        page: undefined,
      })) as Record<string, unknown>[];
      const field =
        mode === "master" ? "BARANG_ID" : mode === "aset" ? "NO" : "SEQ_ID";
      const row = rows.find((r) => Number(r[field]) === id);
      if (!row) return badRequest("Data tidak ditemukan.");
      return ok(row);
    }
    const result = await readInventory(mode, body);
    await Log.info({
      scope: "API",
      msg: `barang/${mode}/list`,
      user: user.S_USER_ID,
      tookMs: Date.now() - started,
    });
    const response = ok(result);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (e) {
    await Log.error({
      scope: "API",
      msg: `barang/${mode}/error`,
      err: {
        name: e instanceof Error ? e.name : "Error",
        message: e instanceof Error ? e.message : "Unknown",
      },
    });
    return e instanceof InventoryError
      ? badRequest(e.message)
      : err(
          "Permintaan barang gagal. Silakan coba lagi atau hubungi administrator.",
        );
  }
}
