# Monalisa Monitoring (Next.js)

Monalisa Monitoring adalah modernisasi antarmuka sistem monitoring layanan kependudukan Disdukcapil Kota Bandung. Aplikasi ini ditulis dengan Next.js 15 (App Router) dan TypeScript, menampilkan beragam dashboard, modul master, monitoring KTP-el, chat internal, serta utilitas operasional lain yang seluruhnya terhubung ke basis data Oracle SIAK melalui API internal.

> ⚠️ **Catatan penting**  
> Repositori ini memuat _credentials_ dummy pada `.env.local` untuk kebutuhan pengembangan lokal. Pastikan mengganti seluruh rahasia ketika menjalankan di lingkungan lain dan **jangan** commit file `.env` yang berisi data produksi.

---

## Isi Dokumen

- [Teknologi yang digunakan](#teknologi-yang-digunakan)
- [Struktur proyek](#struktur-proyek)
- [Prasyarat](#prasyarat)
- [Menyiapkan lingkungan pengembangan](#menyiapkan-lingkungan-pengembangan)
- [Konfigurasi environment](#konfigurasi-environment)
- [Menjalankan aplikasi](#menjalankan-aplikasi)
- [Build & deployment](#build--deployment)
- [Arsitektur & modul utama](#arsitektur--modul-utama)
- [API internal](#api-internal)
- [Logging dan troubleshooting](#logging-dan-troubleshooting)
- [Panduan kontribusi & gaya penulisan](#panduan-kontribusi--gaya-penulisan)
- [Checklist sebelum rilis produksi](#checklist-sebelum-rilis-produksi)

---

## Teknologi yang digunakan

- **Platform front-end**: Next.js 15 (App Router) + TypeScript, React 19.
- **Styling**: Tailwind CSS 3, file `globals.css` kustom, Framer Motion untuk animasi, ikon dari Lucide & Material Design Iconic.
- **UI & chart**: MUI (`@mui/material`, `@mui/x-data-grid`), Chart.js (`react-chartjs-2`), `gridjs`, DataTables (`datatables.net`) untuk tabel dinamis, `react-date-range` untuk pemilih tanggal rentang.
- **State management**: Context React (`SessionProvider`) dan hook kustom.
- **Back-end**: API Route Next.js yang mengakses Oracle DB lewat driver resmi `oracledb`, utilitas `lib/db` dan `lib/oracle` dengan connection pooling multi-alias.
- **Autentikasi**: Cookie tersigning HMAC (`session_user` + `session_sig`) dengan middleware proteksi pada App Router & API.
- **Logging**: Logger kustom (`lib/log`) menulis ke struktur folder `logs/YYYY-MM/DD/log.txt`.
- **Bundler**: Turbopack (`next dev --turbopack`, `next build --turbopack`).

---

## Struktur proyek

```
├── .env.local                # Variabel lingkungan (jangan commit ke produksi)
├── package.json              # Skrip npm dan dependensi
├── tailwind.config.js
├── tsconfig.json
├── public/                   # Aset statis (ikon, wallpaper, avatar)
└── src/
    ├── app/
    │   ├── Activity/…        # Modul Activity Setting
    │   ├── api/…             # Semua endpoint API Next.js (Oracle)
    │   ├── chat/…            # Halaman chat internal
    │   ├── check/ktpel/…     # Monitoring & push status KTP-el
    │   ├── dashboard/…       # Dashboard utama + per-user
    │   ├── login/…           # Halaman login
    │   ├── master/…          # Modul master list/request/contact/absensi/salaman
    │   ├── template/…        # Contoh layout/template
    │   ├── globals.css       # Styling global (heavy theme management)
    │   └── layout.tsx        # Root layout (theme bootstrap + font)
    ├── components/
    │   ├── dashboard/…       # Komponen dashboard (Chart, cards, dsb)
    │   ├── datatable/…       # Wrapper DataTables (jQuery)
    │   ├── layout/…          # ResponsiveAppShell, Sidebar, Topbar, Footer
    │   ├── system/…          # Overlay, dialogs, helpers
    │   └── ui/…              # Komponen UI kecil (DateRangePopup, dsb)
    ├── contexts/session.tsx  # SessionProvider & hook
    ├── hooks/…               # Hooks untuk dashboard/master/chat
    ├── lib/
    │   ├── auth.ts           # Helper autentikasi tambahan
    │   ├── db.ts             # Helper query Oracle
    │   ├── oracle.ts         # Pool Oracle multi-alias
    │   ├── log.ts            # Logger ke file
    │   ├── session.ts        # Manajemen cookie sesi HMAC
    │   └── user.ts, http.ts, dsb
    ├── middleware.ts         # Proteksi halaman (redirect login)
    └── middleware.api.ts     # Proteksi eksplisit /api/*
```

Tambahan penting:

- **`logs/`** (otomatis dibuat) menyimpan log harian. Pastikan proses punya izin tulis.
- **`public/assets/upload/pp/`** menyimpan avatar pegawai (fallback akan menggunakan GIF statis jika foto tidak ditemukan).

---

## Prasyarat

1. **Node.js 18.18+ atau 20.x** (mengikuti requirement Next.js 15). Gunakan `nvm` bila perlu.
2. **npm** (atau pnpm/yarn/bun sesuai preferensi skrip).
3. **Oracle Instant Client 19c+** terpasang di host:
   - Unduh dari [Oracle Instant Client Downloads](https://www.oracle.com/database/technologies/instant-client/downloads.html).
   - Ekstrak dan tambahkan path library ke `PATH` (Windows) / `LD_LIBRARY_PATH` (Linux/Unix).
   - Pastikan `sqlplus` atau `tnsping` bisa terhubung ke server yang sama untuk memverifikasi jaringan.
4. **Jaringan internal** yang dapat menjangkau host Oracle (mis. `10.32.73.x`) seperti pada `.env.local`.
5. Opsional namun disiapkan: Redis, SMTP, Pusher, FCM. (Belum semuanya diintegrasikan di UI, namun env-nya sudah disediakan.)

---

## Menyiapkan lingkungan pengembangan

1. **Kloning repositori**
   ```bash
   git clone <repo-url> monitoring-next
   cd monitoring-next
   ```
2. **Install dependensi Node**
   ```bash
   npm install
   # atau pnpm install / yarn install
   ```
   Jika build `oracledb` gagal, pastikan Instant Client sudah tersedia lalu jalankan:
   ```bash
   npm rebuild oracledb --force
   ```
3. **Salin konfigurasi environment**
   - Gunakan `.env.local` sebagai acuan (ganti seluruh nilai rahasia sebelum dipakai di server lain).
   - Jangan commit file tersebut.
4. **Verifikasi akses database**
   - Coba `tnsping` atau `sqlplus` ke alias yang digunakan (`DB`, `DB221`, dst).
   - Pastikan firewall atau VPN internal aktif.

---

## Konfigurasi environment

| Kunci                      | Deskripsi                                                                                           |
|---------------------------|-----------------------------------------------------------------------------------------------------|
| `APP_NAME`, `APP_ENV`, `APP_DEBUG`, `APP_URL`, `APP_TIMEZONE` | Metadata aplikasi & penentu mode debug (memengaruhi logging dan cookie secure).        |
| `APP_KEY`                 | Kunci simetris (base64) untuk enkripsi internal legacy (tidak dipakai langsung di Next.js, tetapi disiapkan). |
| `DB_*`, `DB222_*`, `DB221_*`, ... | Kredensial Oracle untuk tiap alias. Format koneksi dapat memakai `_CONN` (`host:port/service`) atau kombinasi `_HOST`, `_PORT`, `_SERVICE_NAME`. |
| `LOG_DIR`                 | Folder akar penulisan log (`./logs` secara default). Pastikan punya izin tulis di produksi.        |
| `SESSION_SECRET`          | Kunci HMAC cookie (`session_sig`). Wajib diganti untuk setiap lingkungan.                           |
| `SESSION_LIFETIME`, `SESSION_MAX_AGE` | Durasi sesi (detik). Sesi diperpanjang oleh utilitas `maybeRefreshSession`.            |
| `QUEUE_CONNECTION`, `REDIS_*` | Disiapkan untuk integrasi queue/Redis (belum dipakai langsung).                                 |
| `MAIL_*`                  | Konfigurasi SMTP (mailtrap sebagai default dev).                                                    |
| `PUSHER_*`, `SOCKET_URL`, `E_SPASI_URL` | Endpoint realtime/push (opsional, integrasi belum penuh).                              |
| `FCM_SERVER_KEY`, `FCM_SENDER_ID` | Kredensial Firebase Cloud Messaging apabila notifikasi push diperlukan.                    |

> Gunakan `.env.local` untuk pengembangan. Untuk staging/produksi buat file `.env.production` yang memuat nilai berbeda dan aman.

---

## Menjalankan aplikasi

### Development

```bash
npm run dev
# atau pnpm dev / yarn dev / bun dev
```

- Server akan hidup di [http://localhost:3000](http://localhost:3000).
- Turbopack (`--turbopack`) mempercepat HMR dan compile.
- Pastikan koneksi Oracle tersedia; jika tidak, sebagian API akan gagal.

### Production Preview (build + start)

```bash
npm run build
npm run start
```

- Jalankan `npm run build` di lingkungan yang sama dengan `npm run start` karena Next.js 15 menghasilkan output `.next`.
- Gunakan `APP_ENV=production` dan `SESSION_SECRET` unik.
- Letakkan di balik reverse proxy (Nginx/Apache) dengan HTTPS agar cookie `secure` disetel otomatis.

---

## Arsitektur & modul utama

### 1. Layout & Theme

- **`ResponsiveAppShell`** (src/components/layout/ResponsiveAppShell.tsx) adalah kerangka global:
  - Menangani state sidebar pinned vs overlay (breakpoint `min-width: 1280px`).
  - Mengunci scroll body saat overlay terbuka & menutup via ESC / klik backdrop.
  - Menempatkan `Topbar`, `Footer`, dan `<main>` kontainer.
- **`Sidebar`** memperoleh menu dari `/api/menu`, mendukung nested menu dan auto-close saat overlay.
- **`Topbar`** menampilkan identitas Monalisa, tombol toggle sidebar, notifikasi, theme switcher (dark/light), menu user, dan integrasi session context.
- **`RouteChangeOverlay`** memberi loading overlay global (tersambung ke event klik <a> dan programmatic via `triggerRouteOverlay`).
- Root layout (`src/app/layout.tsx`) menyuntik script awal untuk menerapkan theme sebelum paint.

### 2. Autentikasi & Session

- Middleware (`src/middleware.ts`) memaksa login untuk semua halaman kecuali `/login`. Rute root `/` diarahkan otomatis ke `/dashboard` atau `/laporanpindah` tergantung level user.
- Middleware API (`src/middleware.api.ts`) memvalidasi cookie `session_user` + `session_sig` untuk setiap request `/api/*`.
- Session cookie:
  - Dikelola melalui `lib/session.ts` (`setSessionCookie`, `clearSessionCookie`, `verifyPayload`).
  - Payload diserialisasi JSON + `encodeURIComponent`, signature HMAC-SHA256 menggunakan `SESSION_SECRET`.
  - Menyimpan atribut user (ID, NIK, kantor, level, dsb).
- `SessionProvider` (`src/contexts/session.tsx`) menyuplai data user, unread mail, dan preview chat ke komponen client.

### 3. API & Database

- Semua akses DB melalui `lib/db.ts` (`execRows`, `execOne`, `execDml`, dsb.) yang memanfaatkan pool multi-alias dari `lib/oracle.ts`.
- Pool memetakan alias environment: `DB`, `DB222`, `WEBDB`, dst. Ganti di `.env` jika topologi berubah.
- Logger `lib/log.ts` dipanggil otomatis di helper DB untuk setiap query (baik sukses maupun error) sehingga ada audit trace.
- Folder `src/app/api` berisi modul:
  - `login`, `logout`, `session/*`: autentikasi / heartbeat.
  - `menu`: struktur menu dinamis sesuai hak akses.
  - `dashboard/*`: statistik (KTP-EL, capaian, DKB, Geulis/non-Geulis, per user, salaman, populasi).
  - `check/ktpel/*`: metadata wilayah, daftar status KTP-el, aksi push ulang, export.
  - `master/*`: data master (list user, request, contact, absensi, salaman).
  - `chat/*` dan `messages/*`: konten chat, daftar kontak, pengiriman pesan.
  - `activity/do_save`, `account/password`, `user`: fungsi pendukung modul lain.

Semua handler mengikuti pola:

1. Validasi session (otomatis oleh middleware).
2. Baca input/body/query.
3. Query Oracle menggunakan alias sesuai kebutuhan.
4. Kembalikan JSON (`{ success, data }`) dengan logging otomatis.

### 4. Front-end Modules

- **Dashboard (`src/app/dashboard`)**  
  Menampilkan berbagai kartu statistik. Setiap komponen `components/dashboard/*` menggunakan hook di `hooks/dashboard/*` untuk memanggil API terkait.

- **Master Modules (`src/app/master/*`)**  
  - `list`, `request`, `contact`, `absensi`, `salaman` masing-masing memiliki UI grid card + DataTables (`JQDataTable`) sebagai view alternatif.  
  - Menggunakan fetch ke `/api/master/...`.

- **Chat (`src/app/chat`)**  
  Aplikasi chat internal dengan daftar kontak, pencarian, grouping tanggal, pengiriman pesan (optimistic update). Memanfaatkan API `chat/*` dan `messages/*`.

- **Check KTP-el (`src/app/check/ktpel`)**  
  Form filter dan tabel status KTP-el, action push massal, export CSV. Layout memanfaatkan modul layout bersama `SessionProvider`.

- **Activity & Template**  
  Contoh layout lain dan halaman pengaturan (Activity Setting). Menggunakan `ResponsiveAppShell`.

## 5. Styling & Theming

Proyek ini memakai **Tailwind v3** + CSS modular.

- **Entry Tailwind:** `src/app/globals.css` (satu-satunya file yang berisi `@tailwind base/components/utilities`).
- **Modular CSS:** `src/styles/**` berisi:
  - `tokens.css` — CSS variables global (palet, radii, shadow).
  - `theme-dark.css` — animasi & dekorasi neon dark.
  - `theme-light.css` — baseline variabel mode light (ink, surface, border, shadow).
  - `layout.css`, `overlays.css` — penyesuaian header/aside/footer/overlay (termasuk selector untuk utilitas Tailwind tertentu).
  - `components/*.css` — gaya komponen khusus (mis. salaman-card).
- **Kebijakan Tailwind:** jangan pakai `@layer` di file modular untuk menghindari error urutan build; tulis CSS biasa. Jika perlu `@apply`, hindari di dalam nesting.

### Urutan impor (App Router)
Urutan impor di `src/app/layout.tsx`:
1. `./globals.css`
2. `../styles/tokens.css` → `theme-dark.css` → `theme-light.css`
3. `layout.css`, `overlays.css`, `utilities.css`, `components/**`

> Catatan: kami menggunakan `@tailwindcss/postcss` (lihat `postcss.config.mjs`) agar kompatibel dengan Next.js 15 + Turbopack.


## API internal

Ringkasan direktori utama di bawah `/api`:

| Modul | Endpoint contoh | Deskripsi |
|-------|-----------------|-----------|
| `login` | `POST /api/login` | Autentikasi user ke `SIAK_USER_PLUS`, membuat `SIAK_SESSION_PLUS` & cookie sesi. |
| `logout` | `POST /api/logout` | Menghapus cookie, menandai sesi non-aktif. |
| `session` | `/api/session`, `/api/session/ping`, `/api/session/verify` | Health-check dan refresh sesi. |
| `menu` | `GET /api/menu` | Memuat struktur menu dinamis berdasarkan level user. |
| `dashboard/*` | `GET /api/dashboard/capaian`, `.../population`, `.../userktp/summary`, dsb. | Statistik utama dashboard, memanfaatkan beberapa alias DB. |
| `check/ktpel/*` | `GET /api/check/ktpel`, `/kabupaten`, `/push` | Monitoring status KTP-el, detail wilayah, trigger ulang push. |
| `master/*` | `GET /api/master/list`, `/request`, `/contact`, `/absensi`, `/salaman` | Data master untuk modul list, request, contact, absensi, salut salam. |
| `chat/*`, `messages/*` | `GET /api/chat/contacts`, `POST /api/chat/send`, `GET /api/messages/previews` | Data kontak & pesan chat. |
| `activity/do_save` | `POST /api/activity/do_save` | Penyimpanan aktivitas/log modul Activity. |
| `account/password` | `POST /api/account/password` | Ganti password user. |
| `user` | `GET /api/user` | Detail profil user dari cookie/session. |

Semua endpoint mengembalikan JSON standar dan me-log setiap akses (INFO/WARN/ERROR). Gunakan `fetch` dengan `credentials: "include"` dari frontend agar cookie dikirimkan.

---

## Logging dan troubleshooting

- **Lokasi log**: Default `./logs/<YYYY-MM>/<DD>/log.txt`. Set `LOG_DIR` apabila ingin menempatkan pada folder lain (contoh `/var/log/monalisa`).
- **Format**: `[timestamp] [LEVEL] [SCOPE] message {json payload}` dengan payload dipangkas agar tidak terlalu besar.
- **Scope umum**:
  - `DB`: Query ke Oracle (`execRows`, `execDml`, transaksi).
  - `API`: Route API Next.js.
  - `SESSION`: Aktivitas login/logout.
  - `MIDDLEWARE`: Pelanggaran akses.
  - `SYSTEM`: Event sistem (pembuatan pool, dsb).

### Troubleshooting umum

- **`Error: DPI-1047: 64-bit Oracle Client library cannot be loaded`**  
  Oracle Instant Client belum terinstal atau belum ada di `PATH`. Tambahkan path library, restart shell.

- **`NJS-045: cannot load a node-oracledb binary for Node.js`**  
  Jalankan `npm rebuild oracledb --force` setelah memastikan Instant Client tersedia.

- **Cookie tidak terset di production**  
  Pastikan reverse proxy meneruskan header `X-Forwarded-Proto: https` atau set `APP_ENV=production` sehingga `shouldUseSecureCookie` mengembalikan `true`.

- **Log tidak muncul**  
  Periksa izin tulis folder `LOG_DIR`. Logger akan fallback ke `stderr` bila gagal menulis file.

- **Halaman redirect ke /login**  
  Cookie `session_user`/`session_sig` mungkin invalid. Cek timestamp expiry (`SESSION_MAX_AGE`) dan kesesuaian `SESSION_SECRET` di semua instance.

---

## Panduan kontribusi & gaya penulisan

1. **Bahasa**: Gunakan TypeScript. Hindari `any` bila memungkinkan (tsconfig saat ini `strict: false`, namun usahakan tetap menjaga tipe).
2. **Import**: Manfaatkan path alias `@/` (mis. `import { execRows } from "@/lib/db";`).
3. **Styling**: Prioritaskan Tailwind; jika perlu styling kompleks, tambahkan di `globals.css` dengan komentar yang jelas.
4. **Komponen client vs server**: Default App Router adalah server component. Tambahkan `"use client";` hanya pada file yang memerlukan state, event handler, atau akses browser API.
5. **Logging**: Untuk modul baru, panggil `Log.info/warn/error` sesuai kebutuhan agar audit trail tetap lengkap.
6. **API baru**:
   - Letakkan di `src/app/api/<modul>/route.ts`.
   - Gunakan helper `execRows/execDml` dengan alias DB yang sesuai.
   - Tangani error `try/catch` dan kembalikan JSON `{ success, message }`.
7. **Testing manual**: Belum ada test otomatis. Lakukan uji manual pada modul terkait sebelum merge.
8. **Formatting**: Jalankan `npx prettier --write .` sebelum commit (plugin Tailwind sudah terpasang).

---

## Checklist sebelum rilis produksi

- [ ] Semua rahasia `.env` diganti dengan nilai produksi dan tidak mengandung kredensial dummy.
- [ ] Oracle Instant Client terpasang pada host produksi dan environment path telah disetel.
- [ ] Folder `LOG_DIR` tersedia dan memiliki permission tulis yang aman.
- [ ] Reverse proxy/HTTPS sudah dikonfigurasi sehingga cookie bertanda `Secure`.
- [ ] Jalankan `npm run build` di lingkungan yang sama dengan `npm run start`.
- [ ] Lakukan uji regresi manual pada modul: login/logout, dashboard, master list/request/contact/absensi/salaman, chat, halaman check KTP-el, aktivitas.
- [ ] Monitor folder `logs/` untuk memastikan log terbentuk pasca rilis.

---

## Sumber tambahan

- [Dokumentasi Next.js](https://nextjs.org/docs)
- [Driver node-oracledb](https://oracle.github.io/node-oracledb/doc/api.html)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Chart.js](https://www.chartjs.org/docs/latest/)
- [DataTables](https://datatables.net/manual/)

Apabila ada modul atau integrasi baru yang ditambahkan ke dalam project, tambahkan penjelasan singkat di README ini supaya seluruh tim memahami dependensi & cara menjalankannya. Selamat berkarya! 🎉
