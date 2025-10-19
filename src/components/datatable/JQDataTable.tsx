// FILE: src/components/datatable/JQDataTable.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ====== CSS bawaan DataTables ======
import "datatables.net-dt/css/dataTables.dataTables.css";
import "datatables.net-responsive-dt";
import "datatables.net-buttons-dt";
import "datatables.net-responsive-dt/css/responsive.dataTables.css";
import "datatables.net-buttons-dt/css/buttons.dataTables.css";

// ====== CSS tema kamu ======
import "@/styles/datatable-cyberpunk.css";
import "@/styles/datatable-light.css";

type AnyRow = Record<string, unknown>;
type ColumnDef =
  | {
      data:
        | string
        | ((data: any, type: any, row: AnyRow, meta?: any) => any);
      title?: string;
      className?: string;
      orderable?: boolean;
      width?: string;
      render?: (data: any, type: any, row: AnyRow) => any;
    }
  | Record<string, any>;

type Props = {
  data: AnyRow[];
  id?: string;
  minWidth?: number;
  pageLength?: number;
  columns?: ColumnDef[];
  options?: Record<string, any>;
  tableClassName?: string;
};

export default function JQDataTable({
  data,
  id = "dt",
  minWidth = 1000,
  pageLength = 25,
  columns,
  options,
  tableClassName = "dt-cyberpunk",
}: Props) {
  const tableRef = useRef<HTMLTableElement>(null);
  const dtRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  // auto-generate kolom bila tidak diberikan (dipakai untuk kasus umum)
  const autoColumns = useMemo<ColumnDef[]>(() => {
    if (columns?.length) return columns;
    const keys = data?.length ? Object.keys(data[0]) : [];
    return keys.map((k) => ({ data: k, title: k }));
  }, [data, columns]);

  // freeze kolom yang dipakai instance ini (mencegah re-init loop)
  const resolvedColumnsRef = useRef<ColumnDef[] | null>(null);

  // INIT SEKALI
  useEffect(() => {
    let destroyed = false;

    async function boot() {
      if (!tableRef.current) return;

      // pakai definisi kolom dari render pertama
      resolvedColumnsRef.current = autoColumns;

      const [{ default: DataTable }, { default: JSZip }] = await Promise.all([
        import("datatables.net"),
        import("jszip"),
      ]);

      (window as any).DataTable = DataTable;
      (window as any).JSZip = JSZip;

      await Promise.all([
        import("datatables.net-responsive"),
        import("datatables.net-buttons"),
        import("datatables.net-buttons/js/buttons.html5.mjs"),
        import("datatables.net-buttons/js/buttons.print.mjs"),
      ]);

      if (destroyed) return;

      dtRef.current = new DataTable(tableRef.current!, {
        data,
        columns: resolvedColumnsRef.current!, // ← kolom dibekukan
        responsive: false,
        scrollX: true,
        autoWidth: false,
        deferRender: true,
        pageLength,
        lengthMenu: [
          [10, 25, 50, 100, -1],
          [10, 25, 50, 100, "All"],
        ],
        pagingType: "simple_numbers",
        dom: '<"dt-toolbar d-flex justify-between align-center"Bf>rt<"bottom"ip>',
        buttons: [
          { extend: "copy", text: "Copy" },
          { extend: "csv", text: "CSV" },
          { extend: "excel", text: "Excel" },
          { extend: "print", text: "Print" },
        ],
        language: {
          search: "Search:",
          emptyTable: "Tidak ada data.",
          info: "Menampilkan _START_–_END_ dari _TOTAL_ entri",
          infoEmpty: "Menampilkan 0 entri",
          lengthMenu: "Tampil _MENU_",
          paginate: { first: "«", last: "»", next: "›", previous: "‹" },
          processing: "Memuat…",
        },
        order: [],
        ...(options || {}),
      } as any);

      tableRef.current!.classList.add(
        "display",
        "nowrap",
        "w-full",
        "compact",
        "dt-cyberpunk"
      );
      setReady(true);
    }

    boot();

    return () => {
      destroyed = true;
      if (dtRef.current) {
        dtRef.current.destroy(true);
        dtRef.current = null;
      }
    };
  }, []); // ← init sekali (bukan bergantung ke autoColumns)

  // UPDATE DATA setiap props.data berubah (tanpa re-init)
  useEffect(() => {
    if (!dtRef.current) return;
    const api = dtRef.current;
    api.clear();
    if (data?.length) api.rows.add(data as any);
    api.draw(false);
  }, [data]);

  return (
    <div className="overflow-x-auto">
      {!ready && (
        <div className="px-2 py-4 text-sm text-cyan-200/80">Menyiapkan tabel…</div>
      )}
      <table
        id={id}
        ref={tableRef}
        className={`display nowrap stripe hover order-column cell-border ${tableClassName}`}
        style={{ width: "100%", minWidth }}
      >
        <thead></thead>
        <tbody></tbody>
        <tfoot></tfoot>
      </table>
    </div>
  );
}
