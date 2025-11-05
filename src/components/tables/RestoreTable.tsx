// FILE: src/components/table/RestoreTable.tsx
"use client";

import React from "react";

type Align = "left" | "center" | "right";

export type Column<T> = {
  key: string;
  header: string;
  accessor?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | Date | null | undefined; // (diabaikan)
  width?: number | string;
  align?: Align;
  className?: string;
  sortable?: boolean; // (diabaikan)
  sticky?: "left" | "right";
};

export type CustomTableProps<T> = {
  rows: T[];
  columns: Column<T>[];
  // pagination & sorting props dipertahankan untuk kompatibilitas, tapi DIABAIKAN
  pageSizeOptions?: number[];
  initialPageSize?: number;
  initialSortKey?: string;
  initialSortDir?: "asc" | "desc";
  density?: "comfortable" | "compact";
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T, index: number) => string | number;
};

function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export default function CustomTable<T>({
  rows,
  columns,
  density = "comfortable",
  empty = <div className="ctbl-empty">Tidak ada data</div>,
  onRowClick,
  rowKey,
}: CustomTableProps<T>) {
  // ⛔️ Tidak ada state sort & pagination
  React.useEffect(() => {
    // jaga kelas compact bila ingin toggle lewat luar
    if (density === "compact") {
      document.querySelector(".ctbl")?.classList.add("ctbl--compact");
    }
  }, [density]);

  return (
    <div className={cx("ctbl", density === "compact" && "ctbl--compact")}>
      <div className="ctbl-topbar">
        <div className="ctbl-count">
          Total: <b>{rows.length}</b>
        </div>
        {/* Hapus kontrol Rows & Sort; boleh sisakan pengatur density via CSS/kelas jika perlu */}
      </div>

      <div className="ctbl-scroll">
        <table className="ctbl-table">
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} style={c.width ? { width: c.width } : undefined} />
            ))}
          </colgroup>

          <thead className="ctbl-head">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  data-align={c.align ?? "left"}
                  className={cx(
                    c.className,
                    c.sticky === "left" && "ctbl-sticky-left",
                    c.sticky === "right" && "ctbl-sticky-right"
                  )}
                >
                  <div className="ctbl-thbtn">
                    <span>{c.header}</span>
                    {/* ⛔️ indikator sort & klik dihapus */}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="ctbl-body">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>{empty}</td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={rowKey ? rowKey(row, i) : i}
                  className={cx(onRowClick && "ctbl-row--click")}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((c) => {
                    const content = c.accessor ? c.accessor(row) : (row as any)[c.key];
                    return (
                      <td
                        key={c.key}
                        data-align={c.align ?? "left"}
                        className={cx(
                          "ctbl-td",
                          c.className,
                          c.sticky === "left" && "ctbl-sticky-left",
                          c.sticky === "right" && "ctbl-sticky-right"
                        )}
                        title={typeof content === "string" ? content : undefined}
                      >
                        {content ?? "-"}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ⛔️ Pagination dihapus */}
    </div>
  );
}
