require("@next/env").loadEnvConfig(process.cwd());
require("./pdak-ts-loader.cjs");
const Module = require("node:module"),
  original = Module._load;
Module._load = function (n, ...args) {
  return n === "server-only" ? {} : original.call(this, n, ...args);
};
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  oracledb = require("oracledb");
const { getOracleConnection } = require("../src/lib/oracle.ts");
const {
  readInventory,
  mutateInventory,
  INVENTORY_ALIAS,
} = require("../src/lib/barang/repository.ts");
const { readCapaian } = require("../src/lib/dashboard/capaianRepository.ts");
(async () => {
  let conn, id;
  const timings = {};
  try {
    const capaian = await readCapaian(null);
    assert.equal(capaian.rows.length, 4);
    assert.ok(capaian.rows[2].title.includes("0–4"));
    console.log("Dashboard PDAK live source/date/empty state: PASS");
    for (const mode of [
      "master",
      "masuk",
      "keluar",
      "status",
      "aset",
      "cekaset",
      "laporan",
      "laporanaset",
      "options",
      "aset-options",
    ]) {
      const start = Date.now();
      const result = await readInventory(mode, {
        page: 1,
        pageSize: 10,
        sect: 1,
        start: "2026-10-01",
        end: "2026-10-13",
      });
      assert.ok(Array.isArray(result.rows));
      assert.ok(Number.isFinite(result.total));
      timings[mode] = Date.now() - start;
    }
    conn = await getOracleConnection(INVENTORY_ALIAS);
    conn.callTimeout = 15000;
    const metadata = (
      await conn.execute(
        "SELECT TABLE_NAME,COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE OWNER=USER AND (TABLE_NAME LIKE '%ASET%' OR TABLE_NAME='SIAK_MONEV_WILAYAH') ORDER BY TABLE_NAME,COLUMN_ID",
      )
    ).rows;
    fs.writeFileSync(
      "logs/inventory-schema.json",
      JSON.stringify(metadata, null, 2),
    );
    const user = "__MONALISA_TEST__",
      name = "__TEST_" + Date.now();
    const master = await mutateInventory(
      conn,
      "master",
      {
        action: "create",
        jenis_barang: name,
        satuan: "unit",
        harga: 100,
        keterangan: "rollback test",
      },
      user,
    );
    id = master.id;
    const contender = await getOracleConnection(INVENTORY_ALIAS);
    try {
      await assert.rejects(
        contender.execute(
          "LOCK TABLE SIAK_MASTER_BARANG IN EXCLUSIVE MODE NOWAIT",
        ),
        (e) => e.errorNum === 54,
      );
    } finally {
      await contender.rollback();
      await contender.close();
    }
    const asset = await mutateInventory(
      conn,
      "aset",
      { action: "create", sect: 6, value_data: name },
      user,
    );
    await mutateInventory(
      conn,
      "aset",
      { action: "update", id: asset.id, sect: 6, value_data: name + "_EDIT" },
      user,
    );
    await mutateInventory(
      conn,
      "aset",
      { action: "delete", id: asset.id, sect: 6 },
      user,
    );
    const masuk = await mutateInventory(
      conn,
      "masuk",
      {
        action: "create",
        kd_brg: id,
        jumlah: 10,
        received: user,
        keterangan: "test",
      },
      user,
    );
    const outgoing = {
      action: "create",
      kd_brg: id,
      jumlah: 5,
      received: user,
      keterangan: "test",
    };
    const keluar = await mutateInventory(conn, "keluar", outgoing, user);
    const retry = await mutateInventory(conn, "keluar", outgoing, user);
    assert.equal(retry.id, keluar.id);
    assert.equal(retry.duplicate, true);
    await assert.rejects(
      mutateInventory(conn, "keluar", { ...outgoing, jumlah: 11 }, user),
      /negatif/,
    );
    await assert.rejects(
      mutateInventory(conn, "master", { action: "delete", id }, user),
      /riwayat/,
    );
    await assert.rejects(
      mutateInventory(conn, "masuk", { action: "delete", id: masuk.id }, user),
      /negatif/,
    );
    const before = (
      await conn.execute(
        "SELECT CREATED_DT,CREATED_BY FROM SIAK_BARANG_KELUAR WHERE SEQ_ID=:id",
        { id: keluar.id },
      )
    ).rows[0];
    await mutateInventory(
      conn,
      "keluar",
      { ...outgoing, action: "update", id: keluar.id, jumlah: 2 },
      user,
    );
    const after = (
      await conn.execute(
        "SELECT CREATED_DT,CREATED_BY FROM SIAK_BARANG_KELUAR WHERE SEQ_ID=:id",
        { id: keluar.id },
      )
    ).rows[0];
    assert.deepEqual(before, after);
    console.log(
      "Actual Oracle CRUD, duplicate suppression, negative-stock guard and original creation date: PASS",
    );
    fs.writeFileSync(
      "logs/inventory-api-timings.json",
      JSON.stringify(
        {
          environment:
            "local Node direct repository, Oracle network; one sample per mode, not a median benchmark",
          milliseconds: timings,
        },
        null,
        2,
      ),
    );
  } finally {
    if (conn) {
      await conn.rollback();
      if (id) {
        const rows = (
          await conn.execute(
            "SELECT COUNT(*) TOTAL FROM SIAK_MASTER_BARANG WHERE BARANG_ID=:id",
            { id },
          )
        ).rows;
        assert.equal(rows[0].TOTAL, 0);
        console.log("All inventory test writes rolled back: PASS");
      }
      await conn.close();
    }
    for (const alias of [...new Set(["DB", INVENTORY_ALIAS])]) {
      try {
        await globalThis.__ORACLE_POOLS__?.get(alias)?.close(0);
      } catch {}
    }
  }
})().catch((e) => {
  console.error(e.code ?? e.message);
  process.exitCode = 1;
});
