# Panduan Penulisan Monitoring Next

Dokumen ini merangkum praktik penulisan halaman, API, penggunaan komponen, dan styling di proyek Monitoring Next. Tujuannya jadi acuan singkat saat menambah fitur baru (maksimal 8.000 karakter).

## 1. Prinsip Umum
- Pegang arsitektur **Next App Router**. Komponen client harus diawali `"use client"` dan tidak mengimpor modul server-only.
- Tempatkan helper lintas fitur di `src/lib`, `src/components/ui`, atau `src/hooks` supaya mudah diuji dan tidak duplikatif.
- Modul berat (DataTables, chart, dll.) dipanggil lewat `next/dynamic({ ssr: false })` agar tidak dieksekusi di server.
- Gunakan helper respons `ok`, `fail`, `err`, `badRequest`, `unauthorized`, `forbidden` dari `src/lib/http.ts` di semua API.
- Semua query Oracle harus melewati `execRows/execOne/execDml/withTransaction` (`src/lib/db.ts`) sehingga logging dan penutupan koneksi otomatis.
- Catat aktivitas penting memakai `Log.info/warn/error` (`src/lib/log.ts`). Logger ini sudah menuliskan JSON ringkas ke `logs/YYYY-MM/DD/log.txt`.

## 2. Penulisan Page (Client Component)
### 2.1 Struktur dasar
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { LayoutGrid, List as ListIcon, RefreshCcw } from "lucide-react";
import DateRangePopup from "@/components/ui/DateRangePopup";
// helper & konstanta
const ORDER_KEYS = ["KELURAHAN","KUA","PENGADILAN AGAMA","BIDAN","RUMAH SAKIT","RUMAH DUKA","HOTLINE EXTERNAL"] as const;
```
- Urutkan impor: React → Next → library eksternal → modul internal.
- Definisikan tipe (`type PemanfaatanRow`, `SummaryRow`) dan konstanta label/urutan di awal file (`src/app/master/pemanfaatan/page.tsx:11-75`).

### 2.2 Helper & hook
- Buat helper format tanggal, grouping, ekspor Excel di dekat atas file. Contoh:
```ts
const iso = (d: Date) => d.toISOString().slice(0, 10);
const rangeLabel = (s: string, e: string) => `(${toDisp(s)} - ${toDisp(e)})`;
const buildPemanfaatanGroups = (rows: PemanfaatanRow[]) => { /* map+sort */ };
```
- Untuk membaca tema gunakan hook kustom:
```tsx
function useThemeDark() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark")
      || (root.getAttribute("data-theme") || "").toLowerCase() === "dark");
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ["class","data-theme"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}
```

### 2.3 State & pemanggilan data
- Kelompokkan state per domain:
```tsx
const [tab, setTab] = useState<"master"|"excel">("master");
const [start, setStart] = useState(todayISO());
const [end, setEnd] = useState(todayISO());
const [rows, setRows] = useState<PemanfaatanRow[]>([]);
const [sumRows, setSumRows] = useState<SummaryRow[]>([]);
const [loading, setLoading] = useState(false);
const [sumLoading, setSumLoading] = useState(false);
const [error, setError] = useState<string|null>(null);
const [sumError, setSumError] = useState<string|null>(null);
```
- Bungkus fetch API agar reusable:
```tsx
async function load(s = start, e = end) {
  setLoading(true); setError(null);
  try {
    const res = await fetch(`/api/master/pemanfaatan?start=${s}&end=${e}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    setRows(json.data);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Gagal memuat data");
  } finally {
    setLoading(false);
  }
}
const loadSummary = async (s = start, e = end) => { /* pola sama, update sumRows */ };
const refreshBoth = () => { load(); loadSummary(); };
```
- Jalankan efek awal di `useEffect(() => { load(); loadSummary(); }, []);`.

### 2.4 Render dan memo
- Struktur umum:
  1. **Header**: judul, tombol tab (`master/excel`), tombol `Refresh`.
  2. **Toolbar**: `DateRangePopup`, label rentang (`useMemo(rangeLabel)`), chip preset (`Today`, `Yesterday`, `Last 7d`, `This Month`).
  3. **Summary Strip**: `<SummaryStrip rows={sumRows} loading={sumLoading} error={sumError} />`.
  4. **Konten utama**: conditional rendering.
```tsx
{tab === "master"
  ? (loading && firstLoad ? <MasterSkeletonGrid /> : <MasterCardGroups rows={rows} />)
  : <ExcelDataTable rows={rows} loading={loading} rangeLabel={label} />}
```
- Gunakan `useMemo` untuk `groups`, `orderedRows`, `tableData`, dan `label` supaya rerender cepat.
- Master view memanfaatkan `buildPemanfaatanGroups` untuk memetak kategori → kartu, sedangkan Excel view mengumpan `tableData` ke komponen DataTables dynamic (`const JQDataTable = dynamic(() => import("@/components/datatable/JQDataTable"), { ssr:false })`).

## 3. Penggunaan Page (Alur UI)
- **Toolbar Filter & Chip**  
  ```tsx
  <DateRangePopup start={start} end={end} onChange={(s,e)=>{setStart(s);setEnd(e);}} months={2} minWidth={700} />
  <Chip onClick={() => { const t = todayISO(); setStart(t); setEnd(t); }}>Today</Chip>
  ```
  Setiap chip cukup men-set state lalu memanggil `load()` jika ingin langsung fetch.
- **Perpindahan tampilan**  
  Beri gaya aktif berdasarkan `tab`:
  ```tsx
  <button className={`segbtn ${tab==="master" ? "is-active" : ""}`} onClick={() => setTab("master")}>Master View</button>
  ```
- **Summary Strip**  
  Susun array `order` kemudian map ke kartu ringkasan. Gunakan fallback angka nol saat data belum ada (`rows.map` + `Map`).
- **Kartu Master**  
  `MasterCardGroups` merender `<section>` per kategori, dengan header `.group-chip` dan daftar kartu:
  ```tsx
  <Image src={avatar} alt={row.NAMA_INSTANSI || "Instansi"} onError={(e)=>{e.currentTarget.src = placeholderByTheme(isDark);}} />
  <span className="master-card__nik-value">{row.NIK || "–"}</span>
  ```
- **Excel View**  
  `ExcelDataTable` menyiapkan `columns`, `options`, serta helper ekspor:
  ```ts
  const bodyCsvPemanfaatan = (data, _row, col) => col === 4 ? '="' + stripHtml(data) + '"' : stripHtml(data);
  const excelCustomizePemanfaatan = (xlsx) => { /* paksa kolom NIK jadi string */ };
  ```
  Pastikan overlay loading muncul saat `loading` true supaya user tahu refresh masih berjalan.

## 4. Penulisan API
Contoh `src/app/api/master/pemanfaatan/summary/route.ts`:
```ts
import { NextRequest } from "next/server";
import { ok, badRequest, err, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALIAS = "WEBDB";

export async function GET(req: NextRequest) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const { searchParams } = new URL(req.url);
    const start = (searchParams.get("start") || "").trim();
    const end = (searchParams.get("end") || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return badRequest("Invalid date range");
    }
    // tambah 1 hari untuk endExclusive
    const e = new Date(`${end}T00:00:00`); e.setDate(e.getDate() + 1);
    const endExclusive = iso(e);

    const whereRange = `(H.CREATED_AT >= TO_DATE(:b_start,'YYYY-MM-DD') AND H.CREATED_AT < TO_DATE(:b_end,'YYYY-MM-DD'))
      OR (H.UPDATED_AT >= TO_DATE(:b_start,'YYYY-MM-DD') AND H.UPDATED_AT < TO_DATE(:b_end,'YYYY-MM-DD'))`;

    const rows = await execRows(sqlText(whereRange), { b_start: start, b_end: endExclusive }, {}, ALIAS);
    const data = ORDER_KEYS.map((k) => ({
      kategori: k,
      ...(rows.find((r) => r.KATEGORI === k) ?? { TOTAL_INSTANSI: 0, BARU: 0, MELENGKAPI: 0, BATAL: 0, SUDAH_DIVERIFIKASI: 0, SELESAI: 0, JUMLAH: 0 }),
    }));
    return ok(data, "OK", data.length);
  } catch (e: any) {
    return err(e?.message || "Gagal memuat ringkasan pemanfaatan per kategori");
  }
}
```
- Pisahkan `whereRange` agar tidak menduplikasi klausa tanggal di seluruh CTE.
- Ubah parameter tanggal ke `endExclusive` untuk rentang inklusif.
- Selalu bungkus blok utama dengan `try/catch` supaya error server dikembalikan via `err()`.

## 5. Penggunaan Library Internal
- **HTTP (`src/lib/http.ts`)**
  ```ts
  if (!payloadIsValid) return fail("Data belum lengkap");
  return ok(resultData, "OK", 60);              // cache 60 detik
  return err("Terjadi kesalahan", 500);         // error tak terduga
  return unauthorized();                        // 401
  ```
- **Database (`src/lib/db.ts`)**
  ```ts
  const rows = await execRows<UserRow>("SELECT * FROM USERS WHERE ID = :id", { id }, {}, "WEBDB");
  const updated = await execDml("UPDATE USERS SET ...", binds);
  await withTransaction(async (conn) => {
    await conn.execute(SQL_A);
    await conn.execute(SQL_B);
  });
  ```
- **Session (`src/lib/session.ts`)**
  ```ts
  const sess = await readServerSession();
  if (!sess) return unauthorized();
  await setSessionCookie(sess, 60 * 60 * 4); // refresh masa aktif
  ```
- **Logging (`src/lib/log.ts`)**
  ```ts
  await Log.info({ scope: "API", msg: "GET /pemanfaatan", user: sess.S_USER_ID });
  await Log.error({ scope: "DB", msg: "SELECT error", err: { name: err.name, message: err.message } });
  ```

## 6. Panduan Styling
- **Base & Tailwind**  
  `src/app/globals.css` hanya menyertakan layer Tailwind + aturan universal (overflow, transition, prefers-reduced-motion). Tambahkan utilitas global baru di sini saja bila benar-benar universal.
- **Tema Gelap**  
  `src/styles/theme-dark.css` memakai selector `html:not([data-theme="light"])`. Contoh penambahan komponen baru:
  ```css
  html:not([data-theme="light"]) .pemanfaatan-table-panel__empty {
    border: 1px solid var(--border-subtle);
    background: rgba(4,8,20,.65);
    color: #dffaff;
  }
  ```
- **Tema Terang**  
  `src/styles/theme-light.css` mendefinisikan token warna (mis. `--bg`, `--ink`). Gunakan token ini ketimbang warna hex langsung supaya switching tema konsisten:
  ```css
  html[data-theme="light"] .master-card__footer {
    background: linear-gradient(90deg,#fff8e9,#fbe0b4);
    border: 1px solid rgba(212,172,98,.3);
  }
  ```
- **BEM & Komponen**  
  Kelas `summary-strip__*`, `group-chip__*`, `master-card__*`, `pemanfaatan-table-panel__*` sudah dipakai di kedua tema. Saat menambah elemen baru, ikuti pola tersebut lalu tambahkan rule di kedua file tema.
- **Pedoman**  
  - Hindari inline style untuk warna/border; gunakan custom property.
  - Kode CSS baru diletakkan di file tema sesuai mode untuk menjaga bundel tetap modular.

## 7. Referensi Cepat
- Halaman contoh lengkap: `src/app/master/pemanfaatan/page.tsx`
- API ringkasan kategori: `src/app/api/master/pemanfaatan/summary/route.ts`
- Komponen tanggal: `src/components/ui/DateRangePopup.tsx`
- Helper HTTP/DB/Session: `src/lib/http.ts`, `src/lib/db.ts`, `src/lib/session.ts`
- Logger: `src/lib/log.ts`
- Tema: `src/styles/theme-dark.css`, `src/styles/theme-light.css`

Ikuti panduan ini saat menambah modul baru agar UX, performa, dan standar kode tetap konsisten di seluruh proyek.
