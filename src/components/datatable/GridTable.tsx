// src/components/datatable/GridTable.tsx
"use client";
import { Grid } from "gridjs-react";
import { useMemo } from "react";

type Props = {
  rows: Record<string, any>[];
  minWidth?: number;
  pageSize?: number;
};

export default function GridTable({ rows, minWidth = 1400, pageSize = 25 }: Props) {
  const columns = useMemo(() => Object.keys(rows?.[0] ?? {}), [rows]);
  const data = useMemo(() => rows.map(r => columns.map(c => r[c])), [rows, columns]);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth }}>
        <Grid
          columns={columns}
          data={data}
          search={true}              // ✅ boolean, not object
          sort={true}                // ✅ boolean, not object
          pagination={{ limit: pageSize }}  // ✅ no "enabled"
          className={{
            // (Grid.js className map)
            table: "w-full !text-sm !text-cyan-100",
            th: "sticky top-0 bg-[#0e0e1c]/90 backdrop-blur border-b border-white/10",
            td: "border-b border-white/5",
            pagination: "!text-cyan-100",
            search: "!text-cyan-100",
          }}
        />
      </div>
    </div>
  );
}
