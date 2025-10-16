// FILE: src/components/datatable/MuiGrid.tsx
"use client";

import * as React from "react";
import { DataGrid, GridColDef, GridToolbar } from "@mui/x-data-grid";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import "@mui/x-data-grid/themeAugmentation"; // TS: enable MuiDataGrid in theme.components

type Props = {
  rows: Record<string, any>[];
  height?: number;
  minWidth?: number;
  pageSize?: number;
  getRowId?: (row: any) => string | number;
};

const cyberTheme = createTheme({
  palette: {
    mode: "dark",
    text: { primary: "#cffafe" },                             // cyan-100
    background: { default: "#00000000", paper: "rgba(11,11,26,.6)" }, // no 'transparent'
    divider: "rgba(255,255,255,.08)",
    primary: { main: "#22d3ee" },
  },
  components: {
    MuiDataGrid: {
      styleOverrides: {
        root: {
          borderColor: "rgba(34,211,238,.35)",
          color: "#cffafe",
        },
        columnHeaders: {
          background: "rgba(14,14,28,.75)",
          borderBottom: "1px solid rgba(255,255,255,.10)",
        },
        row: { borderColor: "rgba(255,255,255,.06)" },
        cell: { borderColor: "rgba(255,255,255,.06)" },
      },
    },
  },
});

export default function MuiGrid({
  rows,
  height = 600,
  minWidth = 1200,
  pageSize = 25,
  getRowId,
}: Props) {
  // generate columns from first row
  const columns = React.useMemo<GridColDef[]>(() => {
    const sample = rows?.[0] ?? {};
    return Object.keys(sample).map((k) => ({
      field: k,
      headerName: k,
      minWidth: 140,
      flex: 1,
      sortable: true,
    }));
  }, [rows]);

  // ensure an id field exists
  const rowsWithId = React.useMemo(
    () => (getRowId ? rows : rows.map((r, i) => ({ _rowId: i, ...r }))),
    [rows, getRowId]
  );
  const _getRowId = getRowId ?? ((r: any) => r._rowId);

  return (
    <ThemeProvider theme={cyberTheme}>
      <div className="overflow-x-auto">
        <div style={{ height, minWidth }}>
          <DataGrid
            rows={rowsWithId as any[]}
            columns={columns}
            getRowId={_getRowId}
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50, 100]}
            initialState={{
              pagination: { paginationModel: { pageSize } },
              density: "comfortable",
            }}
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: {
                showQuickFilter: true,
                quickFilterProps: { debounceMs: 400 },
                csvOptions: { utf8WithBom: true, fileName: "export" },
              },
            }}
            sx={{
              bgcolor: "rgba(11,11,26,.55)",
              "& .MuiDataGrid-cell": { outline: "none" },
              "& .MuiDataGrid-row:hover": { backgroundColor: "rgba(255,255,255,.05)" },
              "& .MuiDataGrid-footerContainer": { borderTopColor: "rgba(255,255,255,.10)" },
            }}
          />
        </div>
      </div>
    </ThemeProvider>
  );
}
