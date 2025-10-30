"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ====== CSS DataTables ======
import "datatables.net-dt/css/dataTables.dataTables.css";
import "datatables.net-responsive-dt";
import "datatables.net-buttons-dt";
import "datatables.net-responsive-dt/css/responsive.dataTables.css";
import "datatables.net-buttons-dt/css/buttons.dataTables.css";

// ====== CSS tema kamu ======
import "@/styles/datatable-cyberpunk.css";
import "@/styles/datatable-light.css";
// import "@/styles/datatable-dark.css";

type AnyRow = Record<string, unknown>;
type ColumnDef =
  | {
      data: string | ((data: any, type: any, row: AnyRow, meta?: any) => any);
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
  onApiReady?: (api: any | null) => void;
};

/** Render pager custom ke dalam host dan hubungkan ke API DT */
function mountCustomPager(api: any, host: HTMLElement | null) {
  if (!host) return;

  const info = api.page.info(); // {page, pages, ...}
  const cur = info.page;        // 0-based
  const pages = Math.max(info.pages, 1);

  const windowSize = 7;
  let start = Math.max(0, cur - Math.floor(windowSize / 2));
  let end = Math.min(pages - 1, start + windowSize - 1);
  start = Math.max(0, end - windowSize + 1);

  const mk = (label: string, goto: string, disabled = false, active = false) =>
    `<button data-goto="${goto}" class="${
      disabled ? "is-disabled " : ""
    }${active ? "is-active " : ""}">${label}</button>`;

  const nums: string[] = [];
  for (let i = start; i <= end; i++) nums.push(mk(String(i + 1), String(i), false, i === cur));

  host.innerHTML = `
    <div class="dt-pager">
      ${mk("«", "first", cur === 0)}
      ${mk("‹", "prev", cur === 0)}
      <span class="hidden sm:inline-flex gap-1">${nums.join("")}</span>
      ${mk("›", "next", cur >= pages - 1)}
      ${mk("»", "last", cur >= pages - 1)}
    </div>
  `;

  host.querySelectorAll<HTMLButtonElement>("[data-goto]").forEach((btn) => {
    if (btn.classList.contains("is-disabled")) return;
    const to = btn.dataset.goto!;
    btn.addEventListener("click", () => {
      if (to === "first") api.page("first").draw("page");
      else if (to === "prev") api.page("previous").draw("page");
      else if (to === "next") api.page("next").draw("page");
      else if (to === "last") api.page("last").draw("page");
      else api.page(Number(to)).draw("page");
    });
  });
}

export default function JQDataTable({
  data,
  id = "dt",
  minWidth = 1000,
  pageLength = 50,
  columns,
  options,
  tableClassName = "dt-cyberpunk",
  onApiReady,
}: Props) {
  const tableRef = useRef<HTMLTableElement>(null);
  const dtRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const onApiReadyRef = useRef<typeof onApiReady>();

  useEffect(() => {
    onApiReadyRef.current = onApiReady;
  }, [onApiReady]);

  const autoColumns = useMemo<ColumnDef[]>(() => {
    if (columns?.length) return columns;
    const keys = data?.length ? Object.keys(data[0]) : [];
    return keys.map((k) => ({ data: k, title: k }));
  }, [data, columns]);

  const resolvedColumnsRef = useRef<ColumnDef[] | null>(null);

  // INIT sekali
  useEffect(() => {
    let destroyed = false;

    async function boot() {
      if (!tableRef.current) return;

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
        columns: resolvedColumnsRef.current!,
        responsive: false,
        scrollX: true,
        autoWidth: false,
        deferRender: true,
        pageLength,
        lengthMenu: [
          [10, 25, 50, 100, -1],
          [10, 25, 50, 100, "All"],
        ],

        // === Layout: Buttons kiri, Search kanan. Pager kustom (tanpa 'p')
        dom:
          "<'dt-top-bar'<'dt-left'B><'dt-right'f>>" +
          "rt" +
          "<'dt-bottom'i<'dt-pager ml-auto'>>",

        // Hilangkan label 'Search:' dan pakai placeholder
        language: {
          search: "",
          searchPlaceholder: "Search…",
          emptyTable: "Tidak ada data.",
          info: "Menampilkan _START_–_END_ dari _TOTAL_ entri",
          infoEmpty: "Menampilkan 0 entri",
          lengthMenu: "Tampil _MENU_",
          paginate: { first: "«", last: "»", next: "›", previous: "‹" }, // (fallback jika suatu saat aktifkan 'p')
          processing: "Memuat…",
        },

        buttons: [
          { extend: "copy", text: "Copy" },
          { extend: "csv", text: "CSV" },
          { extend: "excel", text: "Excel" },
          { extend: "print", text: "Print" },
        ],

        order: [],

        // Render pager custom saat init & setiap draw
        initComplete: function () {
          const api = this.api();
          const wrapper: HTMLElement = api.table().container();
          const host = wrapper.querySelector(".dt-pager") as HTMLElement | null;
          mountCustomPager(api, host);
        },
        drawCallback: function () {
          const api = this.api();
          const wrapper: HTMLElement = api.table().container();
          const host = wrapper.querySelector(".dt-pager") as HTMLElement | null;
          mountCustomPager(api, host);
        },

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
      onApiReadyRef.current?.(dtRef.current);
    }

    boot();

    return () => {
      destroyed = true;
      if (dtRef.current) {
        onApiReadyRef.current?.(null);
      }
      if (dtRef.current) {
        dtRef.current.destroy(true);
        dtRef.current = null;
      }
    };
  }, []); // init sekali

  // Update data tanpa re-init
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
