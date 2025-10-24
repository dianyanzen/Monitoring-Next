# Monalisa Monitoring (Next.js)

Monalisa Monitoring adalah modernisasi antarmuka sistem monitoring layanan kependudukan Disdukcapil Kota Bandung. Aplikasi ini ditulis dengan Next.js 15 (App Router) dan TypeScript, menampilkan beragam dashboard, modul master, monitoring KTP-el, chat internal, serta utilitas operasional lain yang seluruhnya terhubung ke basis data Oracle SIAK melalui API internal.

**Repo:** [https://gitlab.com/dianyanzen/monitoring-next](https://gitlab.com/dianyanzen/monitoring-next)

> ⚠️ **Catatan penting**
> Repositori ini memuat *credentials* dummy pada `.env.local` untuk kebutuhan pengembangan lokal. Pastikan mengganti seluruh rahasia ketika menjalankan di lingkungan lain dan **jangan** commit file `.env` yang berisi data produksi.

---

## Isi Dokumen

* [Kerangka Analisa: Mengapa Proyek Ini Ada](#kerangka-analisa-mengapa-proyek-ini-ada)
* [Filosofi Desain: Data → Keputusan → Dampak](#filosofi-desain-data--keputusan--dampak)
* [Filosofi Palet Warna & Dua Tema](#filosofi-palet-warna--dua-tema)
* [Teknologi yang digunakan](#teknologi-yang-digunakan)
* [Struktur proyek](#struktur-proyek)
* [Prasyarat](#prasyarat)
* [Menyiapkan lingkungan pengembangan](#menyiapkan-lingkungan-pengembangan)
* [Konfigurasi environment](#konfigurasi-environment)
* [Menjalankan aplikasi](#menjalankan-aplikasi)
* [Build & deployment](#build--deployment)
* [Arsitektur & modul utama](#arsitektur--modul-utama)
* [Styling & Theming](#styling--theming)
* [Aksesibilitas (A11y) & Tipografi](#aksesibilitas-a11y--tipografi)
* [Keamanan & Data Governance](#keamanan--data-governance)
* [Kinerja & Observabilitas](#kinerja--observabilitas)
* [API internal](#api-internal)
* [Logging dan troubleshooting](#logging-dan-troubleshooting)
* [Panduan kontribusi & gaya penulisan](#panduan-kontribusi--gaya-penulisan)
* [Roadmap](#roadmap)
* [Checklist sebelum rilis produksi](#checklist-sebelum-rilis-produksi)
* [Sumber tambahan](#sumber-tambahan)

---

## Kerangka Analisa: Mengapa Proyek Ini Ada

**Masalah yang ingin dipecahkan**

1. **Fragmentasi tampilan & data**: Modul monitoring tersebar, gaya antarmuka tidak seragam, dan konteks sering hilang saat berpindah halaman.
2. **Beban kognitif petugas**: Banyak angka, sedikit narasi—sulit menangkap makna, prioritas, dan anomali.
3. **Audit & jejak keputusan**: Keputusan operasional butuh jejak data dan log yang rapi untuk akuntabilitas.
4. **Kecepatan situasional**: Kondisi lapangan berubah cepat (mis. status KTP-el), butuh antarmuka responsif yang mempermudah aksi, bukan sekadar menampilkan statistik.
5. **Koordinasi internal**: Komunikasi sering terjadi di luar aplikasi, tidak terhubung langsung dengan data yang sedang dipantau.

**Tujuan inti**

* **Satu bahasa visual** untuk semua modul (dashboard, master, chat, check KTP-el) agar ritme kerja tidak terganggu.
* **Mengubah data menjadi keputusan**: Visualisasi yang jujur, ringkas, dan dapat ditindaklanjuti (actionable).
* **Audit-ready by design**: Setiap aksi dan query penting tercatat; mudah ditelusuri kembali.
* **Rasa percaya**: Stabilitas teknis + konsistensi visual = kepercayaan pengguna.

**Indikator keberhasilan (contoh KPI)**

* Waktu muat halaman utama < 2,5 detik pada jaringan kantor.
* Penurunan **bounce antar-modul** (perpindahan yang gagal karena akses/UX) ≥ 30%.
* Peningkatan **aksi terarah** (mis. push KTP-el, tindak lanjut chat) ≥ 20% per triwulan.
* **Error rate API** (5xx) < 0,5% per minggu; **latensi median** < 250 ms untuk query standar.

---

## Filosofi Desain: Data → Keputusan → Dampak

**Prinsip**

1. **Clarity first**: Hierarki informasi yang jelas. Angka besar untuk status utama, teks pendukung seperlunya.
2. **Honest motion**: Animasi dipakai sebagai penanda konteks (masuk/keluar, perubahan state), bukan dekorasi berlebihan.
3. **Legibility over novelty**: Tipografi nyaman untuk sesi baca lama; kontras warna terjaga.
4. **Progressive disclosure**: Ringkas di awal, detail saat dibutuhkan (tooltip, expand, modal).
5. **Cognitive economy**: Satu pola, berulang. Komponen dan tata letak konsisten lintas halaman.
6. **Design as public service**: Estetika hadir untuk membantu pelayanan, bukan menutupi data.

**Pemetaan desain → perilaku pengguna**

* **Kartu metrik → tindakan cepat** (mis. tombol “Push Ulang” tepat di dekat indikator error).
* **Warna semantik konsisten** (status, peringatan, sukses) sehingga instan dikenali.
* **Empty state bermakna** (bukan halaman kosong): jelaskan “apa selanjutnya”.

---

## Filosofi Palet Warna & Dua Tema

Dua tema saling melengkapi: **Dark Neon** (operasional malam/ruang kendali) dan **Luxe Light** (presentasi, rapat, siang hari). Ini bukan sekadar light/dark; ini dua *rasa* visual untuk dua konteks kerja.

### 1) Dark Neon (default)

* **Tujuan**: Fokus dan stamina visual pada lingkungan redup.
* **Rasa**: Atmosfer “ops room” dengan aksen neon sebagai *accent* dan *state*.
* **Core tokens (contoh)**

  ```css
  :root {
    /* Surfaces */
    --bg-0: #0a0a0c;          /* kanvas */
    --bg-1: #0e0e14;          /* panel */
    --ink:  #e5e7eb;          /* teks utama */

    /* Accents - neon */
    --neon-1: #00e6c3;        /* cyan-mint */
    --neon-2: #36bffa;        /* azure */
    --warn-amber: #f5c26b;    /* peringatan lembut */
    --err-rose:   #ff5d73;    /* error */

    /* Stroke & shadow */
    --border-subtle: rgba(255,255,255,.08);
    --shadow-glow: 0 0 40px rgba(0, 230, 195, .25);
  }
  ```

### 2) Luxe Light (elegan)

* **Tujuan**: Narasi & presentasi; tampilan bersih dan mewah untuk rapat/ekspose publik.
* **Rasa**: Kertas marmer hangat, tinta pekat, garis halus, aksen emas.
* **Core tokens (contoh)**
  (mengikuti penamaan yang sudah kamu pakai)

  ```css
  :root {
    --pal-silk:       #EEE5D9;  /* base hangat */
    --pal-marble:     #EBEAE0;  /* abu-beige lembut */
    --pal-champagne:  #F6E7C9;  /* highlight */
    --lux-ink:        #1A1D21;  /* teks utama */
    --lux-border:     rgba(26,29,33,.12);
    --gold-1:         #D4AF37;  /* aksen emas */
    --gold-2:         #F6D365;  /* gradasi */
    --lux-gold-grad:  linear-gradient(90deg,#D4AF37, #F6D365 60%, #FFE8A3);
  }
  ```

**Aturan penggunaan ringkas**

* **Dark Neon**: gunakan neon untuk *state* (aktif, fokus, seleksi), bukan latar luas. Jaga rasio neon:neutral ≈ **1:4**.
* **Luxe Light**: gunakan **--lux-ink** untuk teks, **--lux-border** untuk garis; **--lux-gold-grad** hanya untuk detail prestige (underline halus, icon state premium), bukan *fill* besar.
* **Konsistensi semantik**:

  * Hijau/teal (neon) → “aktif/OK”.
  * Amber → “butuh atensi”.
  * Rose → “error/aksi perlu ulang”.
* **Kontras minimum**: WCAG AA untuk teks 14px regular atau 12px bold ke atas.

---

## Teknologi yang digunakan

* **Platform front-end**: Next.js 15 (App Router) + TypeScript, React 19.
* **Styling**: Tailwind CSS 3, `globals.css` kustom, Framer Motion; ikon Lucide & Material Design Iconic.
* **UI & chart**: MUI, Chart.js (`react-chartjs-2`), `gridjs`, DataTables, `react-date-range`.
* **State management**: Context React (`SessionProvider`) + hooks.
* **Back-end**: API Route Next.js → Oracle DB (`oracledb`), `lib/db` & `lib/oracle` (pool multi-alias).
* **Autentikasi**: Cookie tersigning HMAC (`session_user` + `session_sig`) via middleware.
* **Logging**: `lib/log` ke `logs/YYYY-MM/DD/log.txt`.
* **Bundler**: Turbopack.

---

## Struktur proyek

```
├── .env.local
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── public/
└── src/
    ├── app/
    │   ├── Activity/…
    │   ├── api/…
    │   ├── chat/…
    │   ├── check/ktpel/…
    │   ├── dashboard/…
    │   ├── login/…
    │   ├── master/…
    │   ├── template/…
    │   ├── globals.css
    │   └── layout.tsx
    ├── components/
    │   ├── dashboard/…
    │   ├── datatable/…
    │   ├── layout/…
    │   ├── system/…
    │   └── ui/…
    ├── contexts/session.tsx
    ├── hooks/…
    ├── lib/
    │   ├── auth.ts
    │   ├── db.ts
    │   ├── oracle.ts
    │   ├── log.ts
    │   ├── session.ts
    │   └── user.ts, http.ts, …
    ├── middleware.ts
    └── middleware.api.ts
```

Tambahan:

* **`logs/`** dibuat otomatis; pastikan izin tulis.
* **`public/assets/upload/pp/`** untuk avatar pegawai (fallback GIF jika tidak ada).

---

## Prasyarat

1. Node.js 18.18+ / 20.x
2. npm / pnpm / yarn / bun
3. Oracle Instant Client 19c+ (`PATH` atau `LD_LIBRARY_PATH` disetel)
4. Koneksi jaringan internal ke host Oracle
5. Opsional: Redis, SMTP, Pusher, FCM (env sudah disiapkan)

---

## Menyiapkan lingkungan pengembangan

```bash
git clone <repo-url> monitoring-next
cd monitoring-next
npm install
# jika perlu:
npm rebuild oracledb --force
```

Salin `.env.local` (ganti rahasia), verifikasi koneksi alias (`tnsping`/`sqlplus`).

---

## Konfigurasi environment

| Kunci                                                         | Deskripsi                                               |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| `APP_NAME`, `APP_ENV`, `APP_DEBUG`, `APP_URL`, `APP_TIMEZONE` | Metadata & mode                                         |
| `APP_KEY`                                                     | Simetris (legacy)                                       |
| `DB_*`, `DB222_*`, `DB221_*`, …                               | Alias Oracle (`_CONN` atau `_HOST/_PORT/_SERVICE_NAME`) |
| `LOG_DIR`                                                     | Lokasi log                                              |
| `SESSION_SECRET`                                              | Kunci HMAC cookie                                       |
| `SESSION_LIFETIME`, `SESSION_MAX_AGE`                         | Durasi sesi                                             |
| `QUEUE_CONNECTION`, `REDIS_*`                                 | Opsional                                                |
| `MAIL_*`                                                      | SMTP                                                    |
| `PUSHER_*`, `SOCKET_URL`, `E_SPASI_URL`                       | Realtime (opsional)                                     |
| `FCM_SERVER_KEY`, `FCM_SENDER_ID`                             | Notifikasi (opsional)                                   |

---

## Menjalankan aplikasi

**Development**

```bash
npm run dev
# http://localhost:3000
```

**Production Preview**

```bash
npm run build
npm run start
```

Catatan: jalankan `build` & `start` pada lingkungan yang sama.

---

## Arsitektur & modul utama

**Layout & Theme**

* `ResponsiveAppShell` mengelola sidebar, topbar, footer, overlay.
* `Sidebar` dari `/api/menu`, mendukung nested.
* `Topbar` berisi identitas, switcher tema, notifikasi, user menu.
* `RouteChangeOverlay` untuk loading antar-halaman.

**Autentikasi & Session**

* `middleware.ts` proteksi halaman (kecuali `/login`).
* `middleware.api.ts` validasi cookie `session_user` + `session_sig`.
* `lib/session.ts` utilitas set/verify/clear cookie.

**API & Database**

* Semua akses via `lib/db.ts` (`execRows`, `execOne`, `execDml`) → pool multi-alias `lib/oracle.ts`.
* Logger mengaudit query & error.
* Modul API: `login/logout/session/menu/dashboard/check/ktpel/master/chat/messages/activity/account/user`.

**Front-end Modules**

* `dashboard/` (kartu statistik + hooks)
* `master/` (list/request/contact/absensi/salaman)
* `chat/` (kontak, pencarian, group per tanggal, optimistic send)
* `check/ktpel/` (filter, tabel status, push massal, export)

---

## Styling & Theming

* **Tailwind v3** dengan entry `src/app/globals.css`.
* **Modular CSS** (opsional) di `src/styles/**`: `tokens.css`, `theme-dark.css`, `theme-light.css`, `layout.css`, `overlays.css`, `components/*.css`.
* **Kebijakan**: hindari `@apply` dalam selector bertingkat; tulis CSS biasa untuk stabilitas build.

**Contoh pemetaan token → utilitas**

```css
/* light */
html[data-theme="light"] .card {
  background: var(--pal-silk);
  color: var(--lux-ink);
  border: 1px solid var(--lux-border);
}

/* underline prestige */
html[data-theme="light"] .card > .gold-underline {
  background: var(--lux-gold-grad);
  height: 2px;
  opacity: .9;
}
```

---

## Aksesibilitas (A11y) & Tipografi

* **Font**: Inter (tampilan data padat, mudah dibaca).
* **Kontras**: target WCAG AA.
* **Keyboard-first**: fokus jelas, `:focus-visible`, *skip to content*.
* **Reduced Motion**: hormati `prefers-reduced-motion`.
* **Teks panjang**: batasi lebar paragraf (65–80 karakter) di halaman naratif.

---

## Keamanan & Data Governance

**Sesi & Cookie**

* HMAC-SHA256, httpOnly, `Secure` di produksi, `SameSite=Lax`.
* Masa hidup disesuaikan kebutuhan operasional.

**Akses DB (konvensi)**

1. Penamaan tabel/kolom: `UPPER_SNAKE_CASE`
2. Binding: **wajib** `:b_*` (tanpa string interpolation)
3. Waktu: `SYSDATE/SYSTIMESTAMP` untuk DML
4. Format hasil: `oracledb.OUT_FORMAT_OBJECT`
5. Transaksi: DML auto-commit per statement / transaksi eksplisit
6. Session tracking: `SIAK_SESSION_PLUS` (SESSION_ID, USER_ID, IP_ADDRESS, USER_AGENT, LAST_ACTIVITY, IS_ACTIVE)
7. Expiry: sumber `SIAK_MASTER` (INIT_SETING/EXP) → validasi di DB
8. Password legacy: MD5 (migrasi bertahap ke Argon2/BCrypt direkomendasikan)
9. Cookie: `session_user` hanya menyimpan SESSION_ID, profil diambil server-side
10. Keamanan tambahan: opsi verifikasi IP, rate limit login, audit gagal

**PII & Masking**

* Mask NIK pada tampilan publik/semi-publik.
* Export mematuhi kebutuhan tugas & otorisasi.

---

## Kinerja & Observabilitas

* **Target**: TTI < 2,5s halaman utama, latensi API median < 250 ms.
* **Strategi**: lazy load komponen berat, caching respons, *virtualized table* untuk data besar, hindari N+1 query, streaming di App Router bila relevan.
* **Logging**: struktur per hari (`logs/YYYY-MM/DD/log.txt`), level INFO/WARN/ERROR, payload dipangkas.
* **Health checks**: `/api/session/ping`, statistik ringan untuk pemantauan dini.

---

## API internal

| Modul                  | Endpoint contoh                                 | Deskripsi                      |
| ---------------------- | ----------------------------------------------- | ------------------------------ |
| `login`                | `POST /api/login`                               | Autentikasi, buat sesi         |
| `logout`               | `POST /api/logout`                              | Hapus cookie, nonaktifkan sesi |
| `session`              | `/api/session`, `/ping`, `/verify`              | Health-check & refresh         |
| `menu`                 | `GET /api/menu`                                 | Struktur menu dinamis          |
| `dashboard/*`          | `GET /api/dashboard/capaian`                    | Statistik utama                |
| `check/ktpel/*`        | `GET /api/check/ktpel`, `/kabupaten`, `/push`   | Monitoring KTP-el              |
| `master/*`             | `GET /api/master/list` dst.                     | Data master                    |
| `chat/*`, `messages/*` | `GET /api/chat/contacts`, `POST /api/chat/send` | Kontak & pesan                 |
| `activity/do_save`     | `POST /api/activity/do_save`                    | Simpan aktivitas               |
| `account/password`     | `POST /api/account/password`                    | Ganti sandi                    |
| `user`                 | `GET /api/user`                                 | Profil user                    |

Gunakan `fetch` dengan `credentials: "include"`.

---

## Logging dan troubleshooting

**Masalah umum**

* `DPI-1047`: Instant Client belum di-setup → setel PATH/LD_LIBRARY_PATH.
* `NJS-045`: rebuild modul → `npm rebuild oracledb --force`.
* Cookie tak terset: pastikan HTTPS & header `X-Forwarded-Proto`.
* Log tak muncul: cek izin `LOG_DIR`.
* Redirect `/login`: cek validitas `session_user/session_sig`, expiry, dan `SESSION_SECRET`.

---

## Panduan kontribusi & gaya penulisan

1. TypeScript, minimalkan `any`.
2. Path alias `@/…`.
3. Prioritas Tailwind; CSS modular bila perlu, beri komentar jelas.
4. `"use client"` hanya bila diperlukan.
5. Logging: panggil `Log.info/warn/error` di titik kritis.
6. API baru: `src/app/api/<modul>/route.ts`, gunakan helper DB & `try/catch`, respons `{ success, message }`.
7. Format: `npx prettier --write .` sebelum commit.
8. Komit & branch: gunakan konvensi deskriptif (`feat/…`, `fix/…`, `docs/…`).

---

## Roadmap

* **Short term**

  * Pusat notifikasi terpadu (errors, sukses, rekomendasi aksi).
  * Tema editor (switch + pratinjau token).
  * Perbaikan aksesibilitas fokus & kontras lintas komponen.
* **Mid term**

  * Realtime ringan (polling terukur / SSE) untuk beberapa metrik.
  * Audit viewer (UI untuk menelusuri jejak log berdasarkan scope).
  * Ekspor terjadwal (CSV/Excel) dengan kuota & peran.
* **Long term**

  * Integrasi pengingat tugas operasional dari indikator dashboard.
  * Lumbung metrik time-series untuk tren jangka panjang.

---

## Checklist sebelum rilis produksi

* [ ] `.env` produksi aman, berbeda dari dev.
* [ ] Instant Client terpasang & path benar.
* [ ] `LOG_DIR` tersedia & writable.
* [ ] Reverse proxy + HTTPS → cookie `Secure`.
* [ ] `npm run build` & `npm run start` di lingkungan sama.
* [ ] Uji regresi: login/logout, dashboard, master, chat, check KTP-el, aktivitas.
* [ ] Observasi log setelah rilis.

---

## Sumber tambahan

* [Dokumentasi Next.js](https://nextjs.org/docs)
* [Driver node-oracledb](https://oracle.github.io/node-oracledb/doc/api.html)
* [Tailwind CSS](https://tailwindcss.com/docs)
* [Chart.js](https://www.chartjs.org/docs/latest/)
* [DataTables](https://datatables.net/manual/)

**Repo:** [https://gitlab.com/dianyanzen/monitoring-next](https://gitlab.com/dianyanzen/monitoring-next)
