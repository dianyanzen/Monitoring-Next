"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Eye, Pencil, Trash2, Users } from "lucide-react";

type GroupItem = { level_code: string; level_name: string };
type UserLevelRow = {
  user_level: string;   // ← kode level SEBENARNYA (USER_LEVEL)
  level_name: string;
  group_name: string;
  level_code: string;   // ← kode grup (LEVEL_CODE)
};

export default function UserLevelPage() {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [groupId, setGroupId] = useState<string>("0");

  const [rows, setRows] = useState<UserLevelRow[]>([]);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [loadingTable, setLoadingTable] = useState(false);
  const [errGroup, setErrGroup] = useState<string | null>(null);
  const [errTable, setErrTable] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingGroup(true);
      setErrGroup(null);
      try {
        const res = await fetch("/api/setting/get_group", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
        const list: GroupItem[] = json?.data ?? [];
        if (!cancelled) {
          setGroups(list);
          setGroupId("0");
        }
      } catch (e: any) {
        if (!cancelled) setErrGroup(e?.message || "Gagal memuat group");
      } finally {
        if (!cancelled) setLoadingGroup(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (groupId === "0") {
      setRows([]);
      return;
    }
    (async () => {
      setLoadingTable(true);
      setErrTable(null);
      try {
        const res = await fetch("/api/setting/get_user_level", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group_id: groupId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
        const list: UserLevelRow[] = json?.data ?? [];
        if (!cancelled) setRows(list);
      } catch (e: any) {
        if (!cancelled) {
          setRows([]);
          setErrTable(e?.message || "Gagal memuat daftar level");
        }
      } finally {
        if (!cancelled) setLoadingTable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const currentGroupName = useMemo(() => {
    if (groupId === "0") return "";
    const f = groups.find((g) => g.level_code === groupId);
    return f?.level_name ?? "";
  }, [groupId, groups]);

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      {/* background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="abs-glow-cyan" />
        <div className="abs-glow-magenta" />
      </div>

      {/* page header */}
      <div className="ui-shell-head">
        <div className="ui-shell-title">
          <Users className="h-5 w-5 text-cyan-300" />
          <span>Settings</span>
          <span className="sep">/</span>
          <span className="accent">User Level</span>
        </div>

        <div className="ui-shell-actions">
          <button
            type="button"
            onClick={() => (window.location.href = "/setting/user/add")}
            className="btn-accent"
          >
            <Plus className="h-4 w-4" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* card */}
      <section className="glass-card neon-border">
        <header className="glass-head">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            {/* Group selector */}
            <div className="w-full md:max-w-md">
              <label className="lbl">Group</label>
              <div className="select-wrap">
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  disabled={loadingGroup}
                  className="select"
                  aria-label="Pilih group user level"
                >
                  <option value="0">-- Select Group --</option>
                  {groups.map((g) => (
                    <option key={g.level_code} value={g.level_code}>
                      {g.level_name}
                    </option>
                  ))}
                </select>
                <span className="caret">▾</span>
              </div>
              {loadingGroup ? (
                <div className="hint">
                  <Loader2 className="icon-spin" />
                  Memuat daftar group…
                </div>
              ) : errGroup ? (
                <div className="hint error">{errGroup}</div>
              ) : null}
            </div>

            {/* context info */}
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <span className="chip">
                List User Level
                {currentGroupName ? (
                  <>
                    {" "}
                    — <b>{currentGroupName}</b>
                  </>
                ) : null}
              </span>
              {rows.length > 0 ? (
                <span className="chip ghost">Total: {rows.length}</span>
              ) : null}
            </div>
          </div>
        </header>

        {/* table */}
        <div className="table-wrap">
          <table className="fancy-table">
            <thead>
              <tr>
                <th className="text-center w-16">No</th>
                <th className="text-center w-24">Code</th>
                <th>Group Name</th>
                <th>Level</th>
                <th className="text-center w-60">Operation</th>
              </tr>
            </thead>

            <tbody>
              {loadingTable ? (
                <tr>
                  <td colSpan={5} className="td-center">
                    <Loader2 className="icon-spin" />
                    Mengambil data user level…
                  </td>
                </tr>
              ) : errTable ? (
                <tr>
                  <td colSpan={5} className="td-center td-error">
                    {errTable}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="td-center td-empty">
                    {groupId === "0"
                      ? "Silakan pilih Group terlebih dahulu."
                      : "Tidak ada data untuk group yang dipilih."}
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={`${r.user_level}-${idx}`}>
                    <td className="text-center">{idx + 1}</td>
                    {/* ⬇️ FIX UTAMA: kolom Code harus menampilkan USER_LEVEL, bukan LEVEL_CODE */}
                    <td className="text-center">
                      <span className="badge mono code-glow">{r.user_level}</span>
                    </td>
                    <td>
                      <div className="cell-title">{r.group_name || "-"}</div>
                    </td>
                    <td>
                      <span className="badge tone">{r.level_name || "-"}</span>
                    </td>
                    <td>
                      <div className="ops">
                        <button
                          type="button"
                          onClick={() =>
                            (window.location.href = `/setting/user/lihat/${encodeURIComponent(
                              r.user_level
                            )}`)
                          }
                          className="btn op see"
                          title="Lihat"
                        >
                          <Eye className="h-4 w-4" />
                          Lihat
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            (window.location.href = `/setting/user/change/${encodeURIComponent(
                              r.user_level
                            )}`)
                          }
                          className="btn op edit"
                          title="Ubah"
                        >
                          <Pencil className="h-4 w-4" />
                          Ubah
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            (window.location.href = `/setting/user/delete/${encodeURIComponent(
                              r.user_level
                            )}`)
                          }
                          className="btn op del"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* foot */}
        <footer className="glass-foot">
          {groupId !== "0" && rows.length > 0 ? (
            <div className="foot-text">
              Menampilkan <b>{rows.length}</b> level pada group{" "}
              <b>{currentGroupName}</b>.
            </div>
          ) : (
            <div className="foot-text">Pilih group untuk menampilkan daftar level.</div>
          )}
        </footer>
      </section>
    </div>
  );
}
