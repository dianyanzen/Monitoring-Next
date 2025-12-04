# Panduan Umum Pembuatan Menu/Page Baru

## 0) Prinsip Inti

* **Next.js App Router + TypeScript.** Client component selalu diawali `"use client"`. Hindari impor modul server-only ke client.
* **Satu sumber kebenaran.** HTTP gunakan helper `ok/fail/err/badRequest/unauthorized/forbidden`; DB lewat `execRows/execOne/execDml/withTransaction`. *Jangan* ubah `lib/oracle.ts`, `lib/db.ts`, `lib/http.ts`, `.env`.
* **Audit-ready.** Aksi penting dicatat via `Log.info/warn/error` dengan `scope` jelas (`API/DB/SESSION/EXPORT`).
* **Kinerja & UX.** TTI < 2,5s; median API < 250ms; lazy/dynamic import untuk modul berat; skeleton & error state wajib.
* **Tema konsisten.** Pakai token & kelas yang sudah ada; jangan pakai warna *hex* langsung di komponen.

---

## 1) Struktur Folder & Penamaan

* Page per menu di bawah `src/app/<domain>/<feature>/page.tsx`.
* API untuk menu tersebut di `src/app/api/<domain>/<feature>/*`.
* Komponen reuse di `src/components/ui/*` (atomik) atau `src/components/<feature>/*` (spesifik).
* CSS tematik di `src/styles/*` (dark/light). Utilitas global hanya di `globals.css`.
* Nama tipe & variabel gunakan **SCREAMING_SNAKE** untuk kolom DB, **camelCase** untuk variabel TS.

---

## 2) Template Page (Client)

```tsx
// FILE: src/app/<domain>/<feature>/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { RefreshCcw } from "lucide-react";
import DateRangePopup from "@/components/ui/DateRangePopup";

type Row = { /* kolom minimum yang ditampilkan */ NAMA_INSTANSI: string; JUMLAH: number; NIK?: string };

const iso = (d: Date) => d.toISOString().slice(0,10);
const todayISO = () => iso(new Date());

export default function FeaturePage() {
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  async function load(s = start, e = end) {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/<domain>/<feature>?start=${s}&end=${e}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setRows(json.data ?? []);
    } catch (e:any) {
      setError(e?.message || "Gagal memuat data");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const total = useMemo(() => rows.reduce((a,r)=>a+(r.JUMLAH||0),0), [rows]);

  return (
    <main className="panel page-feature">
      {/* Header */}
      <header className="page-header">
        <h1 className="page-title">Judul Menu</h1>
        <div className="page-actions">
          <button className="segbtn" onClick={() => load()} aria-label="Refresh">
            <RefreshCcw className="icon-md" /> Refresh
          </button>
        </div>
      </header>

      {/* Toolbar Filter */}
      <section className="toolbar">
        <DateRangePopup start={start} end={end} onChange={(s,e)=>{setStart(s);setEnd(e);}} months={2} minWidth={680}/>
        <div className="chips">
          <button className="chip" onClick={()=>{const t=todayISO(); setStart(t); setEnd(t); load(t,t);}}>Today</button>
          <button className="chip" onClick={()=>{ /* contoh preset lain */}}>Last 7d</button>
        </div>
      </section>

      {/* Status bar */}
      <section className="summary-strip">
        <div className="summary-card"><span>Total</span><strong>{total}</strong></div>
        {/* tambah kartu lain sesuai kebutuhan */}
      </section>

      {/* Konten utama */}
      <section className="content">
        {loading && <div className="skeleton-panel">Memuat…</div>}
        {error && !loading && <div className="error-panel">{error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="empty-panel">Tidak ada data pada rentang tanggal ini.</div>
        )}
        {!loading && !error && rows.length > 0 && (
          <table className="tbl data-grid">
            <thead><tr><th>Instansi</th><th className="ta-right">Jumlah</th></tr></thead>
            <tbody>{rows.map((r,i)=>(
              <tr key={i}>
                <td>{r.NAMA_INSTANSI || "–"}</td>
                <td className="ta-right">{r.JUMLAH ?? 0}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </main>
  );
}
```

**Catatan:**

* Komponen berat (DataTables, Chart) panggil via `dynamic(() => import(...), { ssr:false })`.
* Selalu tampilkan *loading*, *error*, *empty* state.

---

## 3) Template API Route

```ts
// FILE: src/app/api/<domain>/<feature>/route.ts
import type { NextRequest } from "next/server";
import { ok, badRequest, err, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALIAS = "WEBDB";

const sql = `
WITH HDR AS (
  SELECT ID, JENIS_PENGAJUAN, PROC_STAT, STAT_BERKAS, CREATED_AT, UPDATED_AT, FROM_USER_ID
  FROM PENGAJUAN_HEADER
  UNION ALL
  SELECT ID, JENIS_PENGAJUAN, PROC_STAT, STAT_BERKAS, CREATED_AT, UPDATED_AT, FROM_USER_ID
  FROM PENGAJUAN_HEADER_DELETE
)
SELECT /*+ opt */ A.NAMA_INSTANSI, COUNT(1) JUMLAH
FROM USERS A
JOIN HDR H ON H.FROM_USER_ID = A.ID
WHERE
  (H.CREATED_AT >= TO_DATE(:b_start,'YYYY-MM-DD') AND H.CREATED_AT < TO_DATE(:b_end,'YYYY-MM-DD'))
GROUP BY A.NAMA_INSTANSI
ORDER BY 1
`;

const iso = (d: Date) => d.toISOString().slice(0,10);

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
    const e = new Date(`${end}T00:00:00`); e.setDate(e.getDate() + 1);
    const endExclusive = iso(e);

    const rows = await execRows(sql, { b_start: start, b_end: endExclusive }, {}, ALIAS);
    return ok(rows, "OK", rows.length);
  } catch (e:any) {
    return err(e?.message || "Unexpected error");
  }
}
```

**Catatan:**

* Gunakan `endExclusive` agar rentang inklusif mudah dipahami UI.
* Semua **bind** wajib prefiks `:b_*`. *Tidak* ada string interpolation.

---

## 4) Pola Komponen UI Wajib

* **Header page:** judul + aksi (refresh/tab) dengan kelas yang sudah ada (`page-header`, `segbtn`, `icon-md`).
* **Toolbar filter:** `DateRangePopup` + chip preset; `onChange` hanya set state, *fetch* dipicu eksplisit (agar prediktif).
* **Summary strip:** kartu-kartu kecil secara berurutan; angka default 0.
* **Konten:** tabel/kartu. Semua gambar/foto harus punya `onError` → placeholder sesuai tema.

---

## 5) Styling & Tema

* **Jangan** tambah token baru tanpa kebutuhan kuat. Pakai var yang ada (`--bg`, `--ink`, `--border-subtle`, dsb).
* Kelas baru ikuti BEM ringan: `feature-panel__header`, `feature-panel__table`, dst; tambahkan **dua** aturan (dark & light).

```css
/* FILE: src/styles/ui-patterns.css */
/* contoh blok generik yang bisa dipakai ulang */
.feature-panel__empty{ border:1px solid var(--border-subtle); background:var(--surface-muted); color:var(--ink-soft); }
html[data-theme="light"] .feature-panel__empty{ background:rgba(250,247,240,.6); }
```

---

## 6) Performa & Aksesibilitas

* **Dynamic import** modul berat; **memoization** untuk derived state; gunakan `requestIdleCallback` untuk kerja non-kritis.
* Daftar besar → **virtualized** table/grid.
* Tautan & tombol punya **aria-label** bermakna; kontras minimal **AA**; hormati `prefers-reduced-motion`.

---

## 7) Logging, Audit, Ekspor

* Tulis jejak di titik aksi: filter berubah, ekspor, push/verify.

```ts
// FILE: src/app/api/<domain>/<feature>/export/route.ts
import { ok, err, unauthorized } from "@/lib/http";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
export async function GET() {
  const sess = await readServerSession();
  if (!sess?.S_USER_ID) return unauthorized();
  await Log.info({ scope:"EXPORT", msg:"Export <feature>", user:sess.S_USER_ID });
  // … generate file stream / buffer …
  return ok({/* meta */}, "OK");
}
```

---

## 8) Pengujian & Kualitas

* ESLint/TS harus bersih; unit util sederhana; *integration test* untuk API (respons envelope dan validasi parameter).
* Cek **loading/error/empty** state secara visual.
* Pastikan query Oracle dieksekusi di alias yang benar (lihat map alias env), dan *latency* di log wajar.

---

## 9) Checklist Menu Baru (copy–paste)

1. Buat folder `src/app/<domain>/<feature>/` + `page.tsx`, `loading.tsx` (opsional), `error.tsx` (opsional).
2. Buat API `src/app/api/<domain>/<feature>/route.ts` (GET minimal). Bind semua parameter (`:b_*`).
3. Page: header, toolbar (DateRangePopup + chip), summary strip, konten, state `loading/error/empty`.
4. Dynamic import bila pakai DataTables/Chart. Jangan lupa fallback UI.
5. Styling: tambah kelas BEM di `ui-patterns.css` bila perlu; tambahkan aturan dark & light.
6. Logging: minimal satu `Log.info` per API (scope+aksi+user).
7. Uji preset tanggal & `endExclusive`. Uji data kosong & error DB.
8. Lint/type-check pass; ukuran bundle tidak melonjak; tidak ada warna *hardcoded*.

---

## 10) Referensi Cepat

* Helper HTTP/DB/Session: `src/lib/http.ts`, `src/lib/db.ts`, `src/lib/session.ts`
* Logger: `src/lib/log.ts`
* Komponen tanggal: `src/components/ui/DateRangePopup.tsx`
* Tema: `src/styles/theme-dark.css`, `src/styles/theme-light.css`, `src/styles/ui-patterns.css`
* Contoh halaman lengkap: `src/app/master/pemanfaatan/page.tsx`

> Ikuti pola di atas saat menambah menu baru. Dengan begitu, struktur, UX, performa, dan jejak audit tetap seragam di seluruh aplikasi—tanpa perlu mengulang keputusan desain untuk setiap page.

---

# Quick Start — Example-First Guide (General)

## A. Fundamental (ringkas)

* **Arsitektur**: Next.js App Router + TypeScript. Client component wajib `"use client"`.
* **HTTP & DB**: Semua API pakai helper `ok/fail/err/badRequest/unauthorized/forbidden` dan `execRows/execOne/execDml/withTransaction`. **Selalu bind** `:b_*`.
* **Tema & CSS**: Gunakan token/kelas yang sudah ada. Jangan hardcode warna hex di komponen.
* **UX & Performa**: dynamic import untuk modul berat, tampilkan *loading/error/empty*, minim rerender dengan `useMemo`.
* **Audit**: catat aksi penting via `Log.info/warn/error` (`scope` jelas).
* **File terlarang diubah**: `.env`, `lib/oracle.ts`, `lib/db.ts`, `lib/http.ts` (kecuali kamu minta eksplisit untuk mengubah).

---

## 1) Page Minimal — *Tulang punggung semua menu*

```tsx
// FILE: src/app/<domain>/<feature>/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { RefreshCcw } from "lucide-react";
import DateRangePopup from "@/components/ui/DateRangePopup";

type Row = { NAMA: string; JUMLAH: number; [k: string]: unknown };

const iso = (d: Date) => d.toISOString().slice(0,10);
const todayISO = () => iso(new Date());

export default function FeaturePage() {
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(todayISO());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  async function load(s = start, e = end) {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/<domain>/<feature>?start=${s}&end=${e}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setRows(json.data ?? []);
    } catch (e: any) {
      setError(e?.message || "Gagal memuat data");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);
  const total = useMemo(() => rows.reduce((a,r)=>a+(Number(r.JUMLAH)||0),0), [rows]);

  return (
    <main className="panel page-feature">
      <header className="page-header">
        <h1 className="page-title">Judul Menu</h1>
        <div className="page-actions">
          <button className="segbtn" onClick={()=>load()} aria-label="Refresh">
            <RefreshCcw className="icon-md" /> Refresh
          </button>
        </div>
      </header>

      <section className="toolbar">
        <DateRangePopup start={start} end={end} onChange={(s,e)=>{setStart(s);setEnd(e);}} months={2} minWidth={680}/>
        <div className="chips">
          <button className="chip" onClick={()=>{const t=todayISO(); setStart(t); setEnd(t); load(t,t);}}>Today</button>
          <button className="chip" onClick={()=>{ const d=new Date(); d.setDate(d.getDate()-6);
            const s=iso(d); setStart(s); setEnd(todayISO()); load(s,todayISO()); }}>Last 7d</button>
        </div>
      </section>

      <section className="summary-strip">
        <div className="summary-card"><span>Total</span><strong>{total}</strong></div>
      </section>

      <section className="content">
        {loading && <div className="skeleton-panel">Memuat…</div>}
        {error && !loading && <div className="error-panel">{error}</div>}
        {!loading && !error && rows.length === 0 && <div className="empty-panel">Tidak ada data.</div>}

        {!loading && !error && rows.length > 0 && (
          <table className="tbl data-grid">
            <thead><tr><th>Nama</th><th className="ta-right">Jumlah</th></tr></thead>
            <tbody>{rows.map((r,i)=>(
              <tr key={i}><td>{r.NAMA ?? "–"}</td><td className="ta-right">{r.JUMLAH ?? 0}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </main>
  );
}
```

**Gunakan ini untuk semua menu**: ganti `<domain>/<feature>`, kolom, dan judul saja. Sisanya biarkan.

---

## 2) API GET — *General: date range + paging + sort*

```ts
// FILE: src/app/api/<domain>/<feature>/route.ts
import type { NextRequest } from "next/server";
import { ok, badRequest, err, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALIAS = "WEBDB"; // gunakan alias env-map yang sudah ada

const SQL = `
SELECT NAMA, SUM(JUMLAH) JUMLAH
FROM SOME_SOURCE_VIEW
WHERE (CREATED_AT >= TO_DATE(:b_start,'YYYY-MM-DD') AND CREATED_AT < TO_DATE(:b_end,'YYYY-MM-DD'))
GROUP BY NAMA
ORDER BY NAMA
OFFSET :b_offset ROWS FETCH NEXT :b_limit ROWS ONLY
`;

const iso = (d: Date) => d.toISOString().slice(0,10);

export async function GET(req: NextRequest) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const url = new URL(req.url);
    const start = (url.searchParams.get("start") || "").trim();
    const end = (url.searchParams.get("end") || "").trim();
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit")||"50"),1),1000);
    const offset = Math.max(parseInt(url.searchParams.get("offset")||"0"),0);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return badRequest("Invalid date range");
    }
    const e = new Date(`${end}T00:00:00`); e.setDate(e.getDate()+1);
    const endExclusive = iso(e);

    const rows = await execRows(SQL, { b_start: start, b_end: endExclusive, b_limit: limit, b_offset: offset }, {}, ALIAS);
    return ok(rows, "OK", rows.length);
  } catch (e:any) {
    return err(e?.message || "Unexpected error");
  }
}
```

**Pola umum**: rentang tanggal inklusif dengan **endExclusive**, paging defensif, **bind `:b_*`**.

---

## 3) API POST/PUT — *Validasi & transaksi (umum)*

```ts
// FILE: src/app/api/<domain>/<feature>/save/route.ts
import type { NextRequest } from "next/server";
import { ok, badRequest, err, unauthorized } from "@/lib/http";
import { withTransaction } from "@/lib/db";
import { readServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const body = await req.json().catch(()=>null);
    if (!body || typeof body.NAMA !== "string" || typeof body.JUMLAH !== "number") {
      return badRequest("Invalid payload");
    }

    await withTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO GENERIC_TABLE (NAMA, JUMLAH, CREATED_BY, CREATED_AT)
         VALUES (:b_nama, :b_jumlah, :b_user, SYSTIMESTAMP)`,
        { b_nama: body.NAMA, b_jumlah: body.JUMLAH, b_user: sess.S_USER_ID },
        { autoCommit: false }
      );
    });

    return ok({ saved: true }, "OK");
  } catch (e:any) {
    return err(e?.message || "Failed to save");
  }
}
```

**Pola umum**: validasi minimal, transaksi aman, tanpa interpolasi.

---

## 4) Komponen Reusable — *Toolbar & Summary generik*

```tsx
// FILE: src/components/ui/FilterToolbar.tsx
"use client";
import DateRangePopup from "@/components/ui/DateRangePopup";

export default function FilterToolbar({ start, end, onChange, onPreset }:{
  start:string; end:string;
  onChange:(s:string,e:string)=>void;
  onPreset:(type:"today"|"last7")=>void;
}) {
  return (
    <section className="toolbar">
      <DateRangePopup start={start} end={end} onChange={onChange} months={2} minWidth={680}/>
      <div className="chips">
        <button className="chip" onClick={()=>onPreset("today")}>Today</button>
        <button className="chip" onClick={()=>onPreset("last7")}>Last 7d</button>
      </div>
    </section>
  );
}
```

```tsx
// FILE: src/components/ui/SummaryStrip.tsx
"use client";
export default function SummaryStrip({ items }:{ items:{ label:string; value:number|string }[] }) {
  return (
    <section className="summary-strip">
      {items.map((it,i)=>(
        <div key={i} className="summary-card"><span>{it.label}</span><strong>{it.value}</strong></div>
      ))}
    </section>
  );
}
```

---

## 5) Styling — *Aturan generik dua tema*

```css
/* FILE: src/styles/ui-patterns.css */
.page-feature { display:flex; flex-direction:column; gap:1rem; }
.page-header { display:flex; justify-content:space-between; align-items:center; }
.toolbar { display:flex; gap:.75rem; flex-wrap:wrap; }
.chips .chip { border:1px solid var(--border-subtle); background:var(--surface-muted); padding:.35rem .7rem; border-radius:9999px; }
.summary-strip { display:grid; grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap:.75rem; }
.summary-card { border:1px solid var(--border-subtle); background:var(--surface); padding:.75rem; border-radius:.75rem; }
.tbl.data-grid { width:100%; border-collapse:separate; border-spacing:0; }
.tbl.data-grid th, .tbl.data-grid td { padding:.6rem .75rem; border-bottom:1px solid var(--border-subtle); }
.skeleton-panel, .error-panel, .empty-panel { border:1px dashed var(--border-subtle); padding:1rem; border-radius:.75rem; }

html[data-theme="light"] .summary-card { background: linear-gradient(90deg,#fffdf7,#f8f3ea); }
html:not([data-theme="light"]) .summary-card { background: rgba(10,16,24,.55); }
```

> Tambah kelas baru di sini, lalu beri *override* light/dark pakai selector tema yang sudah dipakai proyek.

---

## 6) Ekspor Data — *CSV generik (bisa dipakai semua tabel)*

```ts
// FILE: src/app/api/<domain>/<feature>/export/route.ts
import type { NextRequest } from "next/server";
import { ok, err, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SQL = `SELECT NAMA, JUMLAH FROM SOME_SOURCE_VIEW WHERE CREATED_AT >= TO_DATE(:b_start,'YYYY-MM-DD') AND CREATED_AT < TO_DATE(:b_end,'YYYY-MM-DD')`;

export async function GET(req: NextRequest) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();

    const url = new URL(req.url);
    const start = (url.searchParams.get("start")||"").trim();
    const end = (url.searchParams.get("end")||"").trim();
    const e = new Date(`${end}T00:00:00`); e.setDate(e.getDate()+1);

    const rows = await execRows(SQL, { b_start: start, b_end: e.toISOString().slice(0,10) }, {}, "WEBDB");
    await Log.info({ scope:"EXPORT", msg:"Export CSV <feature>", user: sess.S_USER_ID, count: rows.length });

    const header = ["NAMA","JUMLAH"].join(",");
    const body = rows.map(r => [String(r.NAMA??""), String(r.JUMLAH??0)].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const csv = header + "\n" + body;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="export-${start}_to_${end}.csv"`
      }
    });
  } catch (e:any) {
    return err(e?.message || "Export failed");
  }
}
```

Client trigger (opsional, reusable di mana pun):

```ts
// FILE: src/components/ui/useDownload.ts
"use client";
export default function useDownload() {
  return async function download(url:string, filename?:string){
    const res = await fetch(url, { cache: "no-store" });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || "download";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  }
}
```

---

## 7) Loading & Error Boundary — *Page standar*

```tsx
// FILE: src/app/<domain>/<feature>/loading.tsx
export default function Loading(){ return <div className="skeleton-panel">Memuat…</div>; }
```

```tsx
// FILE: src/app/<domain>/<feature>/error.tsx
"use client";
export default function Error({ error }:{ error: Error & { digest?: string } }){
  return <div className="error-panel">Terjadi kesalahan: {error.message || "Unknown"}</div>;
}
```

---

## 8) Setelan Penting (umum & praktis)

**API Route**

* Tambahkan di setiap API:

  ```ts
  export const runtime = "nodejs";       // Hindari edge utk koneksi Oracle
  export const dynamic = "force-dynamic"; // Selalu fresh untuk data operasional
  ```
* Gunakan `fetch(..., { cache: "no-store" })` di client untuk data live.

**Paging & Limit**

* `limit` default **50**, maksimum **1000**; `offset` ≥ 0. Semua via **bind**.

**Tanggal**

* UI kirim `YYYY-MM-DD`. Di API, jadikan **endExclusive** (tambah 1 hari) agar rentang inklusif mudah dipahami.

**Logging**

* Minimal 1 log / endpoint:

  ```ts
  // FILE: anywhere
  await Log.info({ scope:"API", msg:"GET <feature>", user:sess.S_USER_ID, params:{ start, end } });
  ```

**Keamanan**

* Jangan tampilkan NIK penuh di daftar umum; jika perlu, masking di UI (`******1234`).
* Cookie otentikasi tetap `httpOnly`, `Secure`, `SameSite=Lax`.

**Build & Node**

* Gunakan Node LTS modern (≥ 20). Jalankan typecheck & lint sebelum build.

  ```json
  // FILE: package.json (cuplikan)
  { "engines": { "node": ">=20" }, "scripts": { "lint": "eslint .", "typecheck": "tsc --noEmit", "build": "next build --turbopack" } }
  ```

**next.config.js (umum)**

```js
// FILE: next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: true },
  images: { domains: ["localhost","127.0.0.1"] },
  headers: async () => ([
    { source: "/(.*)", headers: [{ key:"X-Frame-Options", value:"DENY" }, { key:"X-Content-Type-Options", value:"nosniff" }] }
  ])
};
module.exports = nextConfig;
```

**Konvensi API Envelope**

* Semua respons:

  ```json
  { "success": true, "message": "OK", "data": [...], "total": 123 }
  ```

**Alias DB (ENV)**

* Gunakan alias yang sudah dimap (mis. `WEBDB`, `DB5CETAK`, dll.). **Jangan** simpan kredensial di kode.

**Aksesibilitas**

* Tambahkan `aria-label` pada ikon tombol; pastikan kontras **AA**; hormati `prefers-reduced-motion`.

---

## 9) Checklist Satu Halaman (copy–paste)

1. Buat `page.tsx` (header, toolbar, summary, tabel) — tampilkan **loading/error/empty**.
2. Buat `api/route.ts` (GET; date range inklusif pakai endExclusive; **bind** `:b_*`; paging defensif).
3. Tambah **log** pada API (scope & user).
4. Jika perlu simpan/update, buat `save/route.ts` dengan `withTransaction`.
5. Styling pakai kelas generik di `ui-patterns.css`; tambah aturan light/dark bila perlu.
6. Ekspor CSV opsional via endpoint `/export`.
7. Lint & typecheck ok; uji preset tanggal, paging, data kosong, dan error DB.

---

Dengan paket contoh di atas, kamu bisa menyalin pola yang sama untuk **menu apa pun** (dashboard, master, monitoring, activity, dll.) tanpa mengikat ke tabel/kolom spesifik—cukup ganti **path**, **SQL sumber**, dan **kolom tampilan**. Konvensi HTTP/DB, tema, performa, dan audit akan tetap konsisten di seluruh aplikasi.
