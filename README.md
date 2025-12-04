# DOKUMENTASI ARSITEKTUR DAN STRATEGI MIGRASI

## Sistem Monitoring Layanan Kependudukan (MONALISA)

## Studi Kasus: Modernisasi Stack dari Laravel ke Next.js

## Dinas Kependudukan dan Pencatatan Sipil Kota Bandung

**Repositori Modern (Next.js):** [https://gitlab.com/dianyanzen/monitoring-next](https://gitlab.com/dianyanzen/monitoring-next)   
**Repositori Legacy (Laravel):** [https://gitlab.com/dianyanzen/monitoring-laravel](https://gitlab.com/dianyanzen/monitoring-laravel) 

> âš ï¸ **Catatan Peringatan Implementasi** \> Repositori ini dapat memuat kredensial *dummy* pada `.env.local` untuk tujuan pengembangan. Kredensial rahasia wajib diganti di semua lingkungan non-pengembangan dan tidak boleh di-*commit* ke repositori produksi. 

-----

## KATA PENGANTAR

Dokumen ini disusun sebagai naskah arsitektur komprehensif untuk proyek modernisasi sistem Monalisa Monitoring. Bagian berikut memuat narasi personal dari penulis, yang memberikan konteks terhadap filosofi di balik penyusunan dokumen ini.

### Identitas & Narasi Penulis

Aku, **Dian Septian, S.Tr.Kom., M.M**, adalah **Administrator Database** di **Dinas Kependudukan dan Pencatatan Sipil Kota Bandung**.   
Fondasi teknisku adalah **Gelar Sarjana Terapan Komputer**, dan landasan kepemimpinan serta organisasi kutempuh dalam **Magister Manajemen (Manajemen Sumber Daya Manusia)**. 

Bahasa dokumentasi ini sengaja lugas dan tajam: **teknis yang membumi**, **UX yang bisa dipegang**, dan **akuntabilitas publik** sebagai haluan. 

-----

## ABSTRAK

Monalisa Monitoring merepresentasikan modernisasi arsitektur antarmuka untuk monitoring layanan kependudukan di Disdukcapil Kota Bandung. Pengembangan ini mentransformasi *stack* teknologi *legacy* (Laravel 6 + Oracle)  menjadi *stack* modern (Next.js 15 (App Router) + TypeScript + Oracle). Sistem ini mengonsolidasikan beragam modulâ€”mencakup *dashboard*, modul *master data*, monitoring KTP-el, perpesanan internal, dan utilitas operasionalâ€”ke dalam satu bahasa visual yang konsisten dengan kapabilitas *auditability* yang kuat. Interaksi dengan basis data Oracle SIAK difasilitasi melalui API Routes (Next.js), menerapkan *binding* variabel yang ketat dan *logging* berjejak harian. Hasil yang dituju mencakup peningkatan waktu tanggap sistem, percepatan pengambilan keputusan operasional, reduksi beban kognitif petugas, dan tersedianya jejak keputusan yang siap diaudit. Indikator Kinerja Utama (KPI) yang ditargetkan antara lain TTI \< 2.5s, latensi API median \< 250 ms, dan penurunan *bounce rate* â‰¥ 30%.

## RINGKASAN ANALISIS IMPLEMENTASI (A-Z)

### Snapshot teknis
- Next.js 15 App Router + TypeScript, runtime `nodejs`, opsi Turbopack untuk dev. Styling bertumpu pada token CSS (`globals.css` + `src/styles/*`) dengan tema dark/light dan komponen tematik (topbar/sidebar/cards/tabel).
- Dependensi utama: `oracledb` (driver Oracle), MUI, DataTables jQuery (ekspor CSV/Excel/Print), Chart.js + react-chartjs-2, Radix Select, react-date-range, pdfmake/pdf-lib untuk cetak, framer-motion untuk animasi.
- `next.config.ts` memetakan rewrite path legacy Laravel (mis. `/Report/GetDaily` -> `/api/report/getdaily/pdf2`) supaya URL lama tetap hidup.

### Backend & akses data
- Koneksi Oracle dikelola via `src/lib/oracle.ts` dengan pool per-alias (contoh `DB`, `WEBDB`, alias lain via ENV `<ALIAS>_USERNAME/_PASSWORD/_CONN`). Pool global aman untuk hot-reload; `fetchAsBuffer` aktif untuk kolom BLOB.
- Abstraksi eksekusi di `src/lib/db.ts` (`execRows/execOne/execDml/withTransaction`) melog otomatis (`Log.info/error`) dan bisa memilih alias per query. Semua SELECT memakai `OUT_FORMAT_OBJECT`; DML auto-commit per panggilan.
- HTTP envelope konsisten (`ok/fail/err/badRequest/unauthorized/forbidden` di `src/lib/http.ts`). Beberapa route memberi cache detik via argumen `ok(data, cacheSeconds)`.
- Domain API: dashboard (salaman, capaian, KTP-el, dsb.), laporan (absensi, rekap daily, PDF), master data (wilayah, pemanfaatan), check/rekam/req*, chat/messages, setting (user/role/menu), util (my-ip). Banyak route memakai `dynamic = "force-dynamic"` agar tidak dibekukan oleh cache Next.

### Sesi, autentikasi, dan middleware
- Cookie sesi: `session_user` + `session_sig` (HMAC SHA-256 via `SESSION_SECRET`) di-set lewat `setSessionCookie` (`src/lib/session.ts`) dengan opsi `secure` adaptif (X-Forwarded-Proto/NODE_ENV) dan maxAge default 8 jam. Payload membawa identitas, level, dan metadata wilayah.
- Middleware halaman (`src/middleware.ts`): melindungi semua path kecuali `/login`/statik, redirect root -> dashboard/laporanpindah sesuai level, hapus cookie corrupt. Middleware API (`src/middleware.api.ts`): wajibkan cookie + signature valid untuk seluruh `/api/*`, log unauthorized, dan bersihkan cookie invalid.
- Login (`src/app/api/login/route.ts`): validasi user ke `SIAK_USER_PLUS`, cek masa berlaku aplikasi dari `SIAK_MASTER` (code EXP), update/insert `SIAK_SESSION_PLUS`, lalu set cookie. Password diverifikasi MD5, namun ada bypass dev hardcoded (`pass === "dianyanzen"`); ini harus dihilangkan di produksi. Hash MD5 perlu migrasi ke algo lebih kuat.

### Frontend & UX
- Shell utama di `ResponsiveAppShell` (sidebar/topbar/footer, breakpoint lg) + `RouteChangeOverlay` (overlay transisi route) + `GlobalFetchOverlay` (patch `fetch` non-GET untuk overlay global). Session context (`src/contexts/session.tsx`) memuat unread chat secara berkala dan menyediakan state global user.
- DataTables (jQuery) di-load dinamis untuk tabel besar/ekspor (contoh `report/laporandaily`). Banyak halaman report memakai overlay, empty/error state, dan ekspor Excel/CSV/Print. Styling halaman memakai gradient/glow cyberpunk yang konsisten.
- Rewrites dan dynamic import menjaga kompatibilitas dengan alur lama (mis. cetak PDF, laporan harian, absensi bulanan).

### Observabilitas, logging, kinerja
- Logger (`src/lib/log.ts`) menulis ke `logs/<yyyy-mm>/<dd>/log.txt` dengan payload ringkas (SQL dibatasi 800 char, JSON 4k). DB helper mencatat durasi dan binds. Beberapa API (dashboard) memberi cache 30 detik untuk meringankan Oracle.
- Kinerja: pool Oracle kecil (min 0, max 10); DataTables berjalan di client sehingga dataset besar bisa berat di browser. Dynamic import dipakai untuk modul berat (DataTables). Overlay fetch menahan tampilan 300 ms supaya tidak berkedip.
- Belum ada rate limit atau batching request; pagination sebagian besar ada di DataTables client-side.

### Keamanan & compliance
- Sesi memakai HMAC signature dan cookie HttpOnly, tetapi belum ada CSRF guard; API mengandalkan cookie + middleware saja. Password MD5 dan bypass dev adalah risiko utama. Tidak ada rate limiting untuk login/API. Pastikan `SESSION_SECRET`, alias DB, dan kredensial produksi tidak tersimpan di repo; `.env.local` hanya untuk dev/dummy.
- Log menulis ke disk; perlu rotasi/retensi dan proteksi izin file. Secure cookie otomatis, tetapi di lingkungan HTTP non-HTTPS cookie bisa ditolak; set `SESSION_COOKIE_SECURE=0` hanya untuk lokal.

### DevEx & migrasi
- Panduan implementasi ada di `PANDUAN_PENULISAN.md` (struktur folder, template page/API, aturan logging/SQL binding). Struktur App Router meniru modul legacy Laravel lewat folder per fitur + rewrites.
- Skrip bantu: `npm run dev`, `npm run build`, `npm run start:3273` (pretty-start). Tidak ada pipeline CI/CD di repo ini; testing otomatis belum tersedia.

### Prioritas tindak lanjut
- Hapus bypass password dan migrasi hash MD5 ke algo kuat (bcrypt/argon) + rate limiting login.
- Tambah CSRF/token anti-replay untuk aksi POST/PUT/DELETE; pertimbangkan refresh sesi sliding di middleware.
- Tambah sanitasi masukan (schema validation) di endpoint kritikal dan enforce limit/pagination server-side untuk dataset besar.
- Tetapkan kebijakan log (retensi/rotasi) serta validasi ENV wajib (alias DB, SESSION_SECRET, LOG_DIR).
- Siapkan test minimal (unit untuk helper, e2e untuk login/report) dan health-check Oracle (`checkOracleHealth`) di monitoring.

### Analisis mendalam (detail A-Z)
- **Arsitektur backend**: App Router + API Routes full server runtime `nodejs`. Auth via cookie HMAC (`session_user` + `session_sig`) dan middleware API yang memblokir semua `/api/*` tanpa cookie valid. Login flow memeriksa SIAK_USER_PLUS, masa berlaku dari SIAK_MASTER (EXP), meng-upsert SIAK_SESSION_PLUS, lalu set cookie. Password masih MD5 dan ada bypass `pass === "dianyanzen"` yang wajib dicabut. Tidak ada CSRF guard, tidak ada rate limit. Oracle pool per-alias di `lib/oracle.ts` (ENV `<ALIAS>_USERNAME/_PASSWORD/_CONN` atau HOST/PORT/SERVICE_NAME). Eksekusi query melalui `lib/db.ts` dengan logging otomatis (durasi, binds) dan alias per panggilan; SELECT memakai `OUT_FORMAT_OBJECT`, DML auto-commit. Beberapa API diberi `dynamic = "force-dynamic"` agar tidak di-cache. Rewrites di `next.config.ts` menjaga URL legacy Laravel.
- **Konvensi API & error**: Respons dibungkus helper `ok/fail/err/badRequest/unauthorized/forbidden` sehingga klien konsisten membaca `success`/`message`/`data`. Validasi input masih minim; beberapa endpoint hanya regex sederhana (tanggal). Tidak ada schema validator terpusat. Kueri besar (laporan, rekap) belum menerapkan pagination server-side; DataTables memuat penuh di klien.
- **Sesi & middleware**: `middleware.ts` memproteksi halaman, redirect root ke dashboard/laporanpindah, dan menormalkan akses `/login`. `middleware.api.ts` memverifikasi HMAC, menolak dan menghapus cookie invalid, serta mencatat log unauthorized. Cookie `secure` adaptif pada X-Forwarded-Proto/NODE_ENV; di HTTP polos cookie bisa ditolak jika secure aktif (ENV `SESSION_COOKIE_SECURE=0` untuk lokal). Sliding refresh hanya lewat helper, belum otomatis per request.
- **Frontend & UX**: Kerangka shell di `ResponsiveAppShell` (sidebar/topbar/footer) dengan overlay transisi `RouteChangeOverlay` dan overlay fetch global yang mem-patch `fetch` non-GET. Session context (`contexts/session.tsx`) memuat unread chat berkala dan memerlukan wrapper pada layout yang butuh user. DataTables jQuery di-load dinamis untuk tabel besar (mis. `report/laporandaily`), mendukung ekspor CSV/Excel/Print; Excel helper `excelCustomizeTextCols` menjaga kolom teks. Styling memakai token CSS (theme dark/light, layout, utilities, komponen) dengan estetika neon/cyberpunk konsisten.
- **Modul & cakupan fitur**: Dashboard (capaian/salaman/ktp-el/geulis/time/population), report (absensi harian/bulanan, rekap daily, PDF getdaily), master (pemanfaatan, wilayah, menu/user/role), check/rekam/req (ktp/kk/akte/rekam/notrecord/duplicate), pengajuan LD, cetak dinas, siak (repair biometrik/restore), activity, chat/messages, template, setting (activityid/app/helpdesk/menuuser/pejabat/user/userlevel), util my-ip. Banyak rute meniru struktur Laravel lama agar paritas tercapai.
- **Keamanan & kepatuhan data**: PII (NIK, nama, wilayah) sering dibawa dalam cookie dan log; log disimpan ke disk `logs/<yyyy-mm>/<dd>/log.txt` tanpa retensi/rotasi otomatis. Tidak ada masking/obfuscation PII di log SQL/binds. Tidak ada rate limit login/API. Tidak ada CSRF/token anti-replay. Session secret dan kredensial DB harus dijaga di ENV (repo mencantumkan catatan dummy di `.env.local`).
- **Kinerja & observabilitas**: Oracle pool kecil (0-10) dan statement cache 40; cukup untuk beban ringan, perlu tuning untuk beban tinggi. Cache 30 detik di beberapa dashboard endpoint. Overlay fetch menahan 300 ms untuk menghindari flicker. DataTables client-side bisa berat untuk dataset besar. Logger memotong SQL ke 800 karakter dan JSON ke 4000. Tidak ada tracing/metrics terintegrasi; health check Oracle tersedia di `checkOracleHealth` tapi belum di-wire ke endpoint monitor.
- **Build & operasi**: Skrip `npm run dev`, `npm run build`, `npm run start`, `npm run start:3273` (pretty-start). Tidak ada CI/CD atau lint/test script berjalan otomatis. Struktur App Router sudah mengikuti konvensi di `PANDUAN_PENULISAN.md`. Aset ikon MDI di-load via link statis; tema ditentukan melalui script inline (localStorage + path /login).
- **Rekomendasi detail**:
  1) Cabut bypass password, migrasi hash, tambah rate limit login + alerting untuk brute force.
  2) Tambah CSRF/token anti-replay untuk POST/PUT/PATCH/DELETE; pertimbangkan rotating/refresh cookie saat ada aktivitas.
  3) Terapkan schema validation (Zod/Yup) di endpoint input (report, master, req*); normalisasi angka/tanggal; hard limit pagination di server.
  4) Tambah middleware rate limit per IP/route; logging security events terpisah dengan redaksi PII.
  5) Tambah retention/rotation log dan proteksi permission folder `logs`; set wajib ENV (SESSION_SECRET, LOG_DIR, semua alias DB).
  6) Tuning pool Oracle untuk beban target, serta audit index/plan query berat (laporan/rekap) agar tidak full scan.
  7) Tambah test minimal (unit helper DB/HTTP/Session, e2e login + laporan) dan health endpoint yang memanggil `checkOracleHealth`.
  8) Hardening front-end: perketat CSP, hilangkan inline script bila memungkinkan, dan batasi patching global fetch jika diperlukan.

-----

## DAFTAR ISI FORMAL

  * [BAB I: PENDAHULUAN](https://www.google.com/search?q=%23bab-i-pendahuluan)
      * [1.1 Latar Belakang Masalah](https://www.google.com/search?q=%2311-latar-belakang-masalah)
      * [1.2 Rumusan Masalah](https://www.google.com/search?q=%2312-rumusan-masalah)
      * [1.3 Tujuan, Ruang Lingkup, & Prinsip Pengembangan](https://www.google.com/search?q=%2313-tujuan-ruang-lingkup--prinsip-pengembangan)
  * [BAB II: METODOLOGI PENGEMBANGAN DAN STRATEGI MIGRASI](https://www.google.com/search?q=%23bab-ii-metodologi-pengembangan-dan-strategi-migrasi)
      * [2.1 Analisis Arsitektur Legacy (Laravel 6)](https://www.google.com/search?q=%2321-analisis-arsitektur-legacy-laravel-6)
      * [2.2 Definisi Arsitektur Modern (Next.js 15)](https://www.google.com/search?q=%2322-definisi-arsitektur-modern-nextjs-15)
      * [2.3 Strategi Migrasi Bertahap](https://www.google.com/search?q=%2323-strategi-migrasi-bertahap)
      * [2.4 Peta Jalan (Roadmap) Produk](https://www.google.com/search?q=%2324-peta-jalan-roadmap-produk)
      * [2.5 Playbook dan Matriks Migrasi Modul](https://www.google.com/search?q=%2325-playbook-dan-matriks-migrasi-modul)
  * [BAB III: HASIL DAN PEMBAHASAN - DESAIN ARSITEKTUR MODERN](https://www.google.com/search?q=%23bab-iii-hasil-dan-pembahasan---desain-arsitektur-modern)
      * [3.1 Analisis Kebutuhan Pengguna (Persona & Journey)](https://www.google.com/search?q=%2331-analisis-kebutuhan-pengguna-persona--journey)
      * [3.2 Desain Arsitektur Antarmuka (Filosofi & Tema Visual)](https://www.google.com/search?q=%2332-desain-arsitektur-antarmuka-filosofi--tema-visual)
      * [3.3 Desain Arsitektur Sistem (C4, Kontainer, Sekuens)](https://www.google.com/search?q=%2333-desain-arsitektur-sistem-c4-kontainer-sekuens)
      * [3.4 Desain Arsitektur Data (ERD & Pedoman SQL)](https://www.google.com/search?q=%2334-desain-arsitektur-data-erd--pedoman-sql)
  * [BAB IV: IMPLEMENTASI DAN JAMINAN KUALITAS](https://www.google.com/search?q=%23bab-iv-implementasi-dan-jaminan-kualitas)
      * [4.1 Struktur Direktori Proyek](https://www.google.com/search?q=%2341-struktur-direktori-proyek)
      * [4.2 Desain Sistem UI dan Implementasi Token](https://www.google.com/search?q=%2342-desain-sistem-ui-dan-implementasi-token)
      * [4.3 Kontrak dan Konvensi API](https://www.google.com/search?q=%2343-kontrak-dan-konvensi-api)
      * [4.4 Tata Kelola Keamanan dan Data](https://www.google.com/search?q=%2344-tata-kelola-keamanan-dan-data)
      * [4.5 Kinerja, Observabilitas, dan Pengujian](https://www.google.com/search?q=%2345-kinerja-observabilitas-dan-pengujian)
      * [4.6 Pedoman Rilis dan Operasional (CI/CD)](https://www.google.com/search?q=%2346-pedoman-rilis-dan-operasional-cicd)
  * [BAB V: KESIMPULAN DAN PENUTUP](https://www.google.com/search?q=%23bab-v-kesimpulan-dan-penutup)
  * [DAFTAR PUSTAKA](https://www.google.com/search?q=%23daftar-pustaka)
  * [LAMPIRAN](https://www.google.com/search?q=%23lampiran)
      * [Lampiran A: Catatan Keputusan Arsitektur (ADR)](https://www.google.com/search?q=%23lampiran-a-catatan-keputusan-arsitektur-adr)
      * [Lampiran B: Rencana Pemulihan Bencana (DRP)](https://www.google.com/search?q=%23lampiran-b-rencana-pemulihan-bencana-drp)
      * [Lampiran C: Runbook Operasional](https://www.google.com/search?q=%23lampiran-c-runbook-operasional)
      * [Lampiran D: Inventori Modul Legacy Tambahan](https://www.google.com/search?q=%23lampiran-d-inventori-modul-legacy-tambahan)
      * [Lampiran E: Implementasi Seeder Menu](https://www.google.com/search?q=%23lampiran-e-implementasi-seeder-menu)
      * [Lampiran F: Dokumentasi Tambahan (Lampiran Modernisasi Lengkap)](https://www.google.com/search?q=%23lampiran-f-dokumentasi-tambahan-lampiran-modernisasi-lengkap)
      * [Lampiran G: Struktur Direktori Lengkap (project_structure.txt)](https://www.google.com/search?q=%23lampiran-g-struktur-direktori-lengkap-project_structuretxt)


### ðŸ§­ Navigasi Cepat

  * [Ringkasan Eksekutif](https://www.google.com/search?q=%23ringkasan-eksekutif)
  * [Identitas & Narasi Penulis](https://www.google.com/search?q=%23identitas--narasi-penulis)
  * [Abstrak & Latar Belakang](https://www.google.com/search?q=%23abstrak--latar-belakang)
  * [Tujuan, Ruang Lingkup, & Prinsip](https://www.google.com/search?q=%23tujuan-ruang-lingkup--prinsip)
  * [Persona, Journey, & Kebutuhan Pengguna](https://www.google.com/search?q=%23persona-journey--kebutuhan-pengguna)
  * [Filosofi Desain & Tema Visual](https://www.google.com/search?q=%23filosofi-desain--tema-visual)
  * [Arsitektur Sistem (C4, Kontainer, Sekuens, Deployment)](https://www.google.com/search?q=%23arsitektur-sistem-c4-kontainer-sekuens-deployment)
  * [Struktur Proyek (Deep Dive)](https://www.google.com/search?q=%23struktur-proyek-deep-dive)
  * [Desain Sistem UI: Tokens, Theming, Tipografi, A11y](https://www.google.com/search?q=%23desain-sistem-ui-tokens-theming-tipografi-a11y)

-----

## BAB I: PENDAHULUAN

Bab ini menguraikan konteks, permasalahan, dan tujuan dari dilakukannya modernisasi sistem Monalisa Monitoring.

### 1.1 Latar Belakang Masalah

Dasar dari pengembangan ini adalah tantangan operasional yang teridentifikasi dalam sistem *legacy*.

#### Abstrak & Latar Belakang

Fragmentasi modul dan variasi gaya antarmuka memecah konteks operasional.   
Angka-angka statistik tanpa narasi tindakan menambah beban kognitif petugas, sementara perubahan cepat (mis. status KTP-el) menuntut antarmuka yang **mengantar aksi**, bukan sekadar menampilkan data.   
Sisi akuntabilitas publik menuntut **jejak keputusan** yang mudah ditelusuri. 

**Hipotesis produk:** \> Satu bahasa visual + arsitektur API terukur â†’ beban kognitif turun â†’ kualitas keputusan naik â†’ pelayanan lebih cepat. 

### 1.2 Rumusan Masalah

Berdasarkan latar belakang tersebut, permasalahan utama dapat dirumuskan sebagai berikut:

1.  Bagaimana merancang arsitektur sistem terpadu yang mampu mengonsolidasikan modul-modul monitoring yang terfragmentasi (dashboard, master, KTP-el, chat)  untuk mengurangi fragmentasi konteks operasional? 
2.  Bagaimana mentransformasi penyajian data dari statis menjadi *insight* yang dapat ditindaklanjuti (*actionable*) untuk mengurangi beban kognitif petugas? 
3.  Bagaimana strategi migrasi teknis yang paling efektif untuk beralih dari *stack* monolitik Laravel 6  ke *stack* modern Next.js 15  sambil memastikan keamanan interaksi data Oracle  dan menciptakan jejak audit yang kuat? 

### 1.3 Tujuan, Ruang Lingkup, & Prinsip Pengembangan

Bagian ini mendefinisikan sasaran, batasan, dan kaidah dasar yang memandu pengembangan sistem modern.

#### Tujuan, Ruang Lingkup, & Prinsip

##### ðŸŽ¯ Tujuan

  * Menyatukan monitoring & utilitas operasional dalam UI konsisten. 
  * Mengubah data menjadi **tindakan** dan **jejak keputusan**. 
  * Menyediakan alat bantu operasi (push ulang, filter wilayah, ekspor, chat) yang dekat dengan data. 

##### ðŸ“¦ Ruang Lingkup

  * **Front-end:** Next.js 15 (App Router), React 19, Tailwind 3, Framer Motion, MUI, Chart.js, DataTables, Grid.js. 
  * **Back-end:** Next.js **API Routes** â†’ Oracle (multi-alias pool); logging harian. 
  * **Modul:** Dashboard, Master, Check KTP-el, Chat, Activity, Template. 

##### ðŸ›¡ï¸ Prinsip

  * **Clarity First**, **Honest Motion**, **Progressive Disclosure**. 
  * **Cognitive Economy**: pola berulang dan konsisten. 
  * **Audit-Ready by Design** â€” setiap keputusan dapat dilacak. 

-----

## BAB II: METODOLOGI PENGEMBANGAN DAN STRATEGI MIGRASI

Bab ini menguraikan metodologi yang digunakan untuk transisi dari sistem *legacy* ke sistem modern, mencakup perbandingan arsitektur, strategi, dan peta jalan implementasi.

### 2.1 Analisis Arsitektur Legacy (Laravel 6)

Pemahaman mendalam terhadap sistem *legacy* adalah fondasi dari strategi migrasi.

#### ðŸ“œ Legacy (Laravel 6)

  * Laravel ^6.2 (PHP ^7.2) dengan `yajra/laravel-oci8`. 
  * Session Laravel + **Passport (OAuth2)** untuk API Android *ePunten*. 
  * Blade + Semantic UI + jQuery; sebagian menggunakan Vue. 
  * Integrasi eksternal: Pusher, Browsershot/DOMPDF, Excel, Redis (opsional), **ZKTeco** (absensi via Windows service). 

### 2.2 Definisi Arsitektur Modern (Next.js 15)

Arsitektur modern dirancang untuk mengatasi keterbatasan sistem *legacy* sambil memperkenalkan kapabilitas baru.

#### âœ¨ Modern (Next.js)

  * **Controller â†’ API Route:** langsung dipetakan ke `src/app/api/*`. 
  * **Passport â†’ Cookie HMAC:** sesi internal berbasis `session_user + session_sig`. 
  * **Blade/jQuery â†’ React 19:** semua komponen modular dan reaktif. 
  * **Queue/Service:** diganti job scheduler Node.js atau bridge Windows Service bila perlu. 

### 2.3 Strategi Migrasi Bertahap

Migrasi tidak dilakukan sebagai *big-bang*, melainkan melalui pendekatan bertahap yang terkontrol.

#### ðŸ“¦ Strategi Migrasi Bertahap

1.  **Inventarisasi modul legacy** â†’ target halaman Next.js. 
2.  **Audit schema & query** â†’ validasi indeks, normalisasi transaksi. 
3.  **Kontrak API** â†’ gunakan JSON, status, dan paging konsisten. 
4.  **Transisi autentikasi** â†’ sesi HMAC; peran dan level pengguna disesuaikan. 
5.  **Replikasi UX/Paritas UI** + penambahan A11y (aksesibilitas). 
6.  **Validasi & Masking PII** â†’ sesuai pedoman data governance. 
7.  **Release bertahap (canary)** â†’ monitor log dan telemetri. 
8.  **Sunset modul lama** setelah Next.js stabil sepenuhnya. 

### 2.4 Peta Jalan (Roadmap) Produk

Strategi migrasi diimplementasikan melalui peta jalan pengembangan yang terbagi menjadi empat fase utama.

#### ðŸ—ºï¸ Roadmap Produk

> **Progress Update (Desember 2025):** Migrasi fitur legacy ke Next.js selesai (Tahap I-III). Semua modul operasional sudah berjalan di stack modern; Laravel dipertahankan hanya sebagai arsip/read-only. Fokus berikutnya: penguatan lapisan prediktif (Tahap IV). 

##### Rekap Progres Migrasi (Desember 2025)

  * Paritas modul legacy tercapai: login, menu, dashboard, check KTP-el, master (list/request/contact/absensi/salaman), chat/messages, activity log, password/profile, laporan cetak/rekam, permohonan KTP (hilang, rusak, pindah, perubahan), serta utilitas operasional terkait laporan/arsip.
  * Integrasi data: pool multi-alias Oracle (DB5/DB221/DB222) aktif dengan logging harian terstruktur dan runbook DRP siap pakai.
  * Operasional: Next.js menjadi jalur utama di staging/produksi; Laravel 6 berada di mode arsip/read-only sebagai referensi regresi.

##### 1ï¸âƒ£ Tahap I â€” Core Modernization (âœ…)

  * Migrasi Login, Session, Dashboard, Menu, dan Check KTP-el ke Next.js. 
  * Implementasi pool Oracle multi-alias dengan binding ketat. 
  * Logging harian + error telemetry. 
  * Desain sistem darkâ€“light mode konsisten (Cyberpunk / Lux). 

##### 2ï¸âƒ£ Tahap II â€” Operasional & Observabilitas (âœ… Selesai â€” Oktober 2025)

  * Aktivasi chat & messages (socket fallback â†’ polling teroptimasi). 
  * Audit activity log dengan filter & search. 
  * Dashboard supervisor interaktif (wilayah, capaian, anomaly trend). 
  * Monitoring API latency (middleware internal). 
  * Build modular: `/components/layout`, `/components/system`. 
  * Release note: modul chat, activity log, dashboard supervisor, dan latency monitor sudah stabil di staging. 

##### 3ï¸âƒ£ Tahap III â€” Integrasi & Automasi (âœ… Selesai â€” Desember 2025)

  * Integrasi **E-Punten API** (mutasi keluar/datang online) selesai; mapping payload dan token sudah digunakan di jalur produksi. 
  * Integrasi **TTE** (KK, Akta, Surat Pernyataan) aktif bersama BSrE & eSign. 
  * Rekonsiliasi database **DEMOGRAPHICS@DB5** vs **FINGERS@DB5** berjalan terjadwal dengan pencatatan deviasi. 
  * Sinkronisasi warehouse PDIP (via view Oracle) rutin dan terdokumentasi di log harian. 
  * Job Scheduler Node menjalankan rekap otomatis & daily digest; status tercatat di `logs/YYYY-MM/DD/log.txt`. 

##### 4ï¸âƒ£ Tahap IV â€” Predictive & Cognitive Layer (ðŸ“ Draft)

  * Deteksi anomali pelayanan berbasis data historis (AI monitor). 
  * Insight naratif otomatis: â€œWilayah dengan rasio cetak KTP rendah minggu ini adalah ...â€. 
  * Voice assistant untuk query data operasional (experimental). 

### 2.5 Playbook dan Matriks Migrasi Modul

Eksekusi strategi migrasi didokumentasikan dalam *playbook* dan matriks pemetaan modul berikut.

#### ðŸ“˜ Playbook Migrasi Per-Modul

##### ðŸ“ Konvensi Umum (Next.js)

  * Cookie: `session_user` (payload terenkripsi) + `session_sig` (HMAC-SHA256). 
  * `httpOnly`, `SameSite=Lax`, `Secure:true` di produksi. 
  * Env alias DB via `DB_*`, `DB222_*`, `DB221_*`, dst. 
  * Logging otomatis: `logs/YYYY-MM/DD/log.txt`. 
  * Scope log: `API`, `DB`, `SESSION`, `MIDDLEWARE`. 
  * Response envelope: `{ "success": true, "message": "OK", "data": {} }`. 
  * Paging: `?page=1&per_page=25` atau `?limit=25&offset=0`. 
  * Tanggal format ISO 8601 (UTC). 
  * Error:
      * `200 (success:false)` â†’ validasi. 
      * `401/403` â†’ akses ditolak. 
      * `500` â†’ error tak terduga. 

##### ðŸ—ºï¸ Matriks Mapping Modul

| Modul | Laravel (Legacy) | Next.js (Modern) | Method | Autentikasi | Catatan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Login / Session** | `AuthController@login`, `ping` | `/api/login`, `/api/session*` | POST / GET | âœ… | Cookie HMAC, sliding session |
| **Menu** | `MenuController@index` | `/api/menu` | GET | âœ… | Cache per level 300s, `buildTree()` |
| **Dashboard** | `DashboardController@*` | `/api/dashboard/*` | GET | âœ… | Metrik KTP-el/DKB/Geulis |
| **Check KTP-el** | `KtpController@*` | `/api/check/ktpel/*` | GET/POST | âœ… | Filter wilayah/tanggal, push massal |
| **Master: List** | `Master\ListController@*` | `/api/master/list` | GET | âœ… | Virtualized table |
| **Master: Request** | `Master\RequestController@*` | `/api/master/request` | GET | âœ… | Ekspor CSV/Excel |
| **Master: Contact** | `Master\ContactController@*` | `/api/master/contact` | GET | âœ… | Fitur pencarian |
| **Master: Absensi** | `Master\AbsensiController@*` | `/api/master/absensi` | GET | âœ… | Integrasi ZKTeco |
| **Master: Salam** | `Master\SalamController@*` | `/api/master/salaman` | GET | âœ… | Layanan online |
| **Chat / Messages** | `ChatController@*`, `Message@*` | `/api/chat/*`, `/api/messages/*` | GET/POST | âœ… | Optimistic send |
| **Activity Log** | `ActivityController@save` | `/api/activity/do_save` | POST | âœ… | Audit trail |
| **Account Password** | `AccountController@password` | `/api/account/password` | POST | âœ… | Upgrade hash bcrypt |
| **User Profile** | `UserController@show` | `/api/user` | GET | âœ… | Minimal PII |



-----

## BAB III: HASIL DAN PEMBAHASAN - DESAIN ARSITEKTUR MODERN

Bab ini memaparkan hasil dari proses desain dan arsitektur sistem modern, mencakup analisis kebutuhan, desain antarmuka, arsitektur sistem, dan arsitektur data.

### 3.1 Analisis Kebutuhan Pengguna (Persona & Journey)

Analisis kebutuhan pengguna dilakukan melalui pendefinisian persona dan pemetaan alur pengguna (*user journey*).

#### Persona, Journey, & Kebutuhan Pengguna

##### ðŸ‘¤ Persona Utama

| Peran | Tujuan | Kebutuhan |
| :--- | :--- | :--- |
| **Petugas Loket** | Mengetahui status cepat, tindakan langsung (push ulang, verifikasi). | UI ringkas, responsif, tanpa distraksi. |
| **Operator Wilayah** | Menyaring data kec/kels, ekspor, tindak lanjut. | Filter dinamis, laporan cepat. |
| **Supervisor** | Melihat tren dan anomali. | Dashboard interaktif, drill-down ringan. |
| **Administrator** | Menjamin kestabilan sistem dan audit. | Log detail, kontrol sesi, dan hak akses. |



##### ðŸ—ºï¸ Journey Ringkas (Check KTP-el)

1.  Pilih **wilayah** & **rentang waktu**. 
2.  Lihat **kartu metrik** (status, error, progress). 
3.  Jalankan **aksi** (push ulang / ekspor) langsung di konteks data. 
4.  **Catatan otomatis (log)** tercipta untuk audit. 

**Non-Fungsional:** - Reliabilitas tinggi di jam sibuk. 

  * Observabilitas: log terstruktur, scope jelas, payload minimal. 
  * Aksesibilitas (A11y): fokus jelas, `prefers-reduced-motion`, kontras AA. 

### 3.2 Desain Arsitektur Antarmuka (Filosofi & Tema Visual)

Desain antarmuka didasarkan pada filosofi yang berpusat pada aksi dan kejelasan, diimplementasikan melalui dua tema visual utama.

#### ðŸŽ¨ Filosofi Desain & Tema Visual

  * **Angka besar untuk status utama**, teks pendukung hemat dan informatif. 
  * **Motion jujur:** hanya untuk menandai transisi atau perubahan state, bukan dekorasi. 
  * **Empty state** bukan ruang kosong, tapi panduan langkah selanjutnya. 
  * Visual mengantar **aksi**, bukan sekadar â€œpamer dataâ€. 

##### Tema 1 â€” **Neon Cyberpunk** (default operasional)

Menampilkan atmosfer ruang kendali; aksen neon dipakai untuk *state/accent*, bukan sebagai latar.   
Rasio neon : netral â‰ˆ **1 : 4** 

```css
/* FILE: src/styles/theme-dark.css (cuplikan) */
html:not([data-theme="light"]) {
  --surface-0:#0a0a0c; --surface-1:#0e0e14; --surface-2:#111118;
  --ink:#e5e7eb; --ink-muted:#a6adbb;
  --accent:#00e6c3; --accent-2:#36bffa;
  --success:#1ad19a; --warning:#f5c26b; --error:#ff5d73;
  --border-subtle:rgba(255,255,255,.08);
  --border-strong:rgba(255,255,255,.16);
  --focus-ring:0 0 0 3px rgba(0,230,195,.45);
}
```



##### Tema 2 â€” **Elegant Lux** (narasi/presentasi)

Palet seperti kertas marmer hangat dan tinta pekat, dengan aksen emas untuk detail prestige (bukan fill besar). 

```css
/* FILE: src/styles/theme-light.css (konsep) */
html[data-theme="light"] {
  --pal-silk:#EEE5D9; --pal-marble:#EBEAE0;
  --lux-ink:#1A1D21; --lux-border:rgba(26,29,33,.12);
  --gold-1:#D4AF37; --gold-2:#F6D365; --gold-3:#FFE8A3;
  --lux-gold-grad:linear-gradient(90deg,var(--gold-1),var(--gold-2) 60%,var(--gold-3));
}
```



**Kontras target:** WCAG AA untuk teks â‰¥ 14 px reguler / 12 px bold. 

### 3.3 Desain Arsitektur Sistem (C4, Kontainer, Sekuens)

Arsitektur sistem didokumentasikan menggunakan model C4 (Context, Container, Component, Code) untuk memvisualisasikan dekomposisi sistem.

#### ðŸ—ï¸ Arsitektur Sistem (C4, Kontainer, Sekuens, Deployment)

**Stack Inti**

  * **Front-end:** Next.js 15, React 19, Tailwind 3, Framer Motion, MUI, Chart.js, DataTables, Grid.js. 
  * **API:** Next.js API Routes â†’ node-oracledb (pool multi-alias). 
  * **Auth:** Cookie HMAC-SHA256 (`session_user` + `session_sig`) + middleware halaman dan API. 
  * **Logging:** `logs/YYYY-MM/DD/log.txt` otomatis, payload dipangkas. 

##### Diagram Konteks (C4)

```mermaid
flowchart LR
  %% ===== Nodes =====
  user["Petugas / Administrator"]

  subgraph web["Monalisa (Next.js)"]
    ui["UI + API Routes<br/>(Next.js)<br/><small>Dashboard | Master | Check KTP-el | Chat | Activity</small>"]
  end

  oracle["Oracle SIAK<br/>(oracledb)"]

  %% ===== Relations =====
  user -->|Operasi harian| ui
  ui -->|"SQL (bind variabel, pool multi-alias)"| oracle
```



##### Diagram Kontainer

```mermaid
flowchart TB
  %% ===== App Boundary =====
  subgraph nextjs["Next.js App"]
    ui["UI React (App Router)<br/>(komponen server & client)"]
    api["API Routes (Node 20)<br/>login, session, menu, dashboard*, ktpel*"]
    log["Logger<br/>logs/YYYY-MM/DD/log.txt"]
  end

  %% ===== External DB =====
  db["Oracle â€” SIAK schema<br/>SIAK_USER_PLUS, SIAK_SESSION_PLUS, VW_SIAK_MENU, ..."]

  %% ===== Relations =====
  ui -->|"fetch JSON (credentials: include)"| api
  api -->|"oracledb: pool & bind"| db
  api -->|"write log"| log

```



##### Diagram Sekuens (Login â†’ Session)

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant UI as UI Login
  participant API as POST /api/login
  participant DB as Oracle
  participant CK as Cookies

  U->>UI: user_id, pass
  UI->>API: POST JSON
  API->>DB: SELECT SIAK_USER_PLUS (validasi)
  API->>DB: UPDATE SIAK_SESSION_PLUS (buat / refresh sesi)
  API->>CK: Set-Cookie session_user & session_sig (HMAC, 8 jam)
  API-->>UI: { ok: true, message_type: 1 }

```



##### Deployment (skema)

```mermaid
flowchart TB
  %% ===== Client =====
  subgraph Client ["Client"]
    B["Browser"]
  end

  %% ===== Infra =====
  subgraph Infra ["Infra"]
    RP["Reverse Proxy (HTTPS)"]
    FS[/"Logs storage"/]
  end

  %% ===== App Server =====
  subgraph Server ["App Server"]
    N["Next.js Runtime (UI + API Routes)"]
    P["Oracle Instant Client 19c+"]
  end

  %% ===== External DB =====
  DB["Oracle SIAK"]

  %% ===== Flows =====
  B -->|"HTTPS 443"| RP
  RP -->|"proxy_pass"| N
  N -->|"oracledb (native driver)"| P
  P -->|"TCP 1521/1522"| DB
  N -->|"write logs"| FS
```



### 3.4 Desain Arsitektur Data (ERD & Pedoman SQL)

Arsitektur data mencakup skema relasi entitas (ERD) yang disederhanakan dan serangkaian pedoman interaksi basis data (SQL).

#### ðŸ—ƒï¸ Database & Pedoman SQL

##### ðŸ·ï¸ Alias Database

`DB`, `DB222`, `DB221`, `WEBDB`, `EPUNTEN`, `WEBPUNTEN`, dsb (diatur dari `.env`). 

##### ðŸ”‘ Konvensi Utama

1.  **Penamaan:** tabel & kolom â†’ `UPPER_SNAKE_CASE`. 
2.  **Binding:** wajib gunakan `:b_*` (tanpa interpolasi string). 
3.  **Waktu:** gunakan `SYSDATE / SYSTIMESTAMP` untuk DML. 
4.  **Format hasil:** `OUT_FORMAT_OBJECT`. 
5.  **Transaksi:** auto-commit per statement, atau eksplisit bila batch. 
6.  **Session tracking:** `SIAK_SESSION_PLUS` (SESSION\_ID, USER\_ID, IP, USER\_AGENT, LAST\_ACTIVITY, IS\_ACTIVE). 
7.  **Expiry aplikasi:** sumber dari `SIAK_MASTER` (`SYSTEM_TYPE='INIT_SETING'`, `SYSTEM_CODE='EXP'`). 
8.  **Password:** legacy MD5 â†’ migrasi bertahap ke Argon2/BCrypt. 
9.  **Cookie:** `session_user` hanya simpan SESSION\_ID; profil diambil server-side. 
10. **Keamanan tambahan:** opsional IP check, rate limit login, audit gagal. 

##### ðŸ’¡ Rekomendasi Indeks

| Tabel | Indeks Disarankan |
| :--- | :--- |
| `SIAK_SESSION_PLUS` | PK `(SESSION_ID)`, IDX `(USER_ID)`, IDX `(LAST_ACTIVITY)` |
| `VW_SIAK_MENU` | IDX `(MIN_LEVEL)`, IDX `(PARENT_ID, ORDERING)` |
| `KTP_EL_STATUS_LOG` | IDX `(KAB_ID, KEC_ID, KEL_ID, TANGGAL)`, IDX `(STATUS, TANGGAL)` |
| `MESSAGES` | IDX `(RECEIVER_ID, CREATED_AT)`, IDX `(SENDER_ID, CREATED_AT)` |
| `ABSENSI_LOG` | IDX `(NIP, CHECK_IN)` |


##### ðŸ“ Contoh Pola SQL (Bind Variables)

```sql
-- FILE: sql/session_keepalive.sql
UPDATE SIAK_SESSION_PLUS
   SET LAST_ACTIVITY = SYSTIMESTAMP
 WHERE SESSION_ID = :b_session_id
   AND IS_ACTIVE = 1;
```



```sql
-- FILE: sql/menu_by_level.sql
SELECT MENU_ID, PARENT_ID, LABEL, HREF, ORDERING
  FROM VW_SIAK_MENU
 WHERE MIN_LEVEL <= :b_user_level
 ORDER BY NVL(PARENT_ID, 0), ORDERING;
```



```sql
-- FILE: sql/ktpel_rekap_status.sql
SELECT STATUS, COUNT(*) AS jumlah
  FROM KTP_EL_STATUS_LOG
 WHERE TANGGAL BETWEEN :b_start AND :b_end
   AND ( :b_kab IS NULL OR KAB_ID = :b_kab )
   AND ( :b_kec IS NULL OR KEC_ID = :b_kec )
   AND ( :b_kel IS NULL OR KEL_ID = :b_kel )
 GROUP BY STATUS;
```



```sql
-- FILE: sql/chat_latest_previews.sql
SELECT m.*
  FROM MESSAGES m
  JOIN (
        SELECT CASE WHEN SENDER_ID = :b_me THEN RECEIVER_ID ELSE SENDER_ID END AS peer,
               MAX(CREATED_AT) AS last_at
          FROM MESSAGES
         WHERE SENDER_ID = :b_me OR RECEIVER_ID = :b_me
         GROUP BY CASE WHEN SENDER_ID = :b_me THEN RECEIVER_ID ELSE SENDER_ID END
       ) t
    ON ( (m.SENDER_ID = :b_me AND m.RECEIVER_ID = t.peer) OR
         (m.RECEIVER_ID = :b_me AND m.SENDER_ID = t.peer) )
   AND m.CREATED_AT = t.last_at;
```



#### ðŸ“Š ERD & SQL Audit

> Skema entitas inti dan indeks yang paling sering digunakan (disederhanakan dari SIAK schema). 

##### ðŸ“Š ER Diagram (Mermaid)

```mermaid
erDiagram

  SIAK_USER_PLUS {
    string USER_ID PK
    string NAMA
    int    USER_LEVEL
    string KANTOR
    string PASSWORD_MD5
    date   CREATED_AT
  }

  SIAK_SESSION_PLUS {
    string SESSION_ID PK
    string USER_ID
    string IP_ADDRESS
    string USER_AGENT
    date   LAST_ACTIVITY
    string IS_ACTIVE
    date   CREATED_AT
  }

  VW_SIAK_MENU {
    int    MENU_ID PK
    int    PARENT_ID
    string LABEL
    string HREF
    int    ORDERING
    int    MIN_LEVEL
  }

  REF_KABUPATEN {
    string KAB_ID PK
    string NAMA
  }

  REF_KECAMATAN {
    string KEC_ID PK
    string KAB_ID
    string NAMA
  }

  REF_KELURAHAN {
    string KEL_ID PK
    string KEC_ID
    string NAMA
  }

  KTP_EL_STATUS_LOG {
    string ID PK
    string NIK
    string KAB_ID
    string KEC_ID
    string KEL_ID
    string STATUS
    date   TANGGAL
    date   UPDATED_AT
  }

  MASTER_LIST {
    int    ID PK
    string TITLE
    string OWNER
    date   CREATED_AT
  }

  MASTER_REQUEST {
    int    ID PK
    string TITLE
    string STATUS
    date   CREATED_AT
  }

  MASTER_CONTACT {
    int    ID PK
    string NAMA
    string TELEPON
  }

  ABSENSI_LOG {
    int    ID PK
    string NIP
    date   CHECK_IN
    date   CHECK_OUT
  }

  SALAMAN_LOG {
    int    ID PK
    string USER_ID
    string TEXT
    date   CREATED_AT
  }

  CHAT_CONTACTS {
    string USER_ID PK
    string DISPLAY_NAME
    string AVATAR_URL
  }

  MESSAGES {
    string MESSAGE_ID PK
    string SENDER_ID
    string RECEIVER_ID
    string TEXT
    date   CREATED_AT
    date   READ_AT
  }

  ACTIVITY_LOG {
    int    ID PK
    string USER_ID
    string ACTION
    string META_JSON
    date   CREATED_AT
  }

  %% ====== Relationships (letakkan DI BAWAH definisi entitas) ======
  SIAK_USER_PLUS     ||--o{ SIAK_SESSION_PLUS : has
  REF_KABUPATEN      ||--o{ REF_KECAMATAN    : contains
  REF_KECAMATAN      ||--o{ REF_KELURAHAN    : contains
  CHAT_CONTACTS      ||--o{ MESSAGES         : sends
  SIAK_USER_PLUS     ||--o{ ACTIVITY_LOG     : acts
```



##### ðŸ”Ž Contoh Query Audit

```sql
-- FILE: sql/activity_log_insert.sql
INSERT INTO ACTIVITY_LOG (USER_ID, ACTION, META_JSON, CREATED_AT)
VALUES (:b_user, :b_action, :b_meta, SYSTIMESTAMP);
```



```sql
-- FILE: sql/messages_latest_by_user.sql
SELECT m.*
  FROM MESSAGES m
 WHERE m.RECEIVER_ID = :b_user
 ORDER BY m.CREATED_AT DESC
 FETCH FIRST 25 ROWS ONLY;
```



```sql
-- FILE: sql/master_request_recap.sql
SELECT STATUS, COUNT(*) AS JUMLAH
  FROM MASTER_REQUEST
 WHERE CREATED_AT BETWEEN :b_start AND :b_end
 GROUP BY STATUS;
```



```sql
-- FILE: sql/session_expired_cleanup.sql
DELETE FROM SIAK_SESSION_PLUS
 WHERE IS_ACTIVE = 0
   OR LAST_ACTIVITY < (SYSTIMESTAMP - INTERVAL '8' HOUR);
```



##### âš–ï¸ Audit Policy

  * Semua query penting ditulis di folder `/sql/` dengan penamaan konsisten. 
  * Struktur log memuat waktu, alias DB, durasi eksekusi, dan hasil. 
  * Audit data export wajib mencatat filter, jumlah baris, dan operator. 

-----

## BAB IV: IMPLEMENTASI DAN JAMINAN KUALITAS

Bab ini merinci aspek-aspek teknis implementasi sistem modern, mulai dari struktur kode, kontrak API, keamanan, hingga strategi pengujian dan operasional.

### 4.1 Struktur Direktori Proyek

Struktur direktori proyek dirancang untuk skalabilitas dan kemudahan pemeliharaan, mengikuti konvensi Next.js App Router.

#### Struktur Proyek (Deep Dive)

```
monitoring-next/
|-- .env.local                       # kredensial dummy untuk pengujian
|-- package.json / tsconfig.json / next.config.ts
|-- postcss.config.js / postcss.config.mjs / tailwind.config.js
|-- .next/                           # artefak build (otomatis, boleh dihapus)
|-- logs/YYYY-MM/DD/log.txt          # jejak audit harian API & DB
|-- public/
|   |-- app/                         # shell HTML lama (fallback)
|   `-- assets/                      # ikon ZMDI, plugin vendor, upload/pp
|-- src/
|   |-- app/
|   |   |-- layout.tsx & globals.css
|   |   |-- middleware.ts / middleware.api.ts
|   |   |-- api/ (login, session, menu, dashboard, check, master, siak, setting, dll)
|   |   |-- dashboard/, check/, master/, setting/, siak/, Activity/, chat/, login/, template/
|   |   `-- template/template/       # stub tampilan untuk eksperimen
|   |-- components/                  # layout/, dashboard/, datatable/, system/, tables/, ui/
|   |-- contexts/                    # session provider
|   |-- hooks/                       # hook domain (dashboard/, master/)
|   |-- lib/                         # oracle.ts, db.ts, log.ts, session.ts, http.ts, auth.ts, user.ts
|   `-- styles/                      # tokens.css, theme-dark.css, theme-light.css, datatable-light.css
`-- README.md & project_structure.txt (dokumentasi)
```

**Aturan Penting**

  * Jangan ubah `lib/oracle.ts`, `lib/db.ts`, `lib/http.ts` tanpa izin khusus. 
  * Semua snippet dokumentasi wajib mencantumkan **lokasi file**. 
  * Modul SIAK baru harus mengikuti pola layout ï¿½+' page seperti contoh di bawah.

#### Modul SIAK: Restore & Repair Local Biometric

Struktur utilitas SIAK modern ditempatkan berdampingan agar mudah dipantau perubahan UI dan API-nya.

```text
src/
  app/
    siak/
      restore/
        layout.tsx
        mainlayout.tsx
        page.tsx
      repair_local_biometric/
        layout.tsx
        mainlayout.tsx
        page.tsx
  app/api/
    restore/
      bio-wni/route.ts
    siak/
      repair_local_biometric/
        scan/route.ts
        delete/route.ts
```

- `layout.tsx` -> mendeklarasikan metadata halaman dan menyambungkan guard sesi agar rute `/siak/*` selalu terlindungi.
- `mainlayout.tsx` -> kerangka visual dua kolom + status strip yang dipakai ulang antar-halaman supaya UX konsisten.
- `page.tsx` -> logika domain: `restore/page.tsx` menangani audit trail & recovery BIO-WNI, sedangkan `repair_local_biometric/page.tsx` memuat alur pemindaian ulang biometrik (scan/delete) serta utilitas debugging jaringan.
- API pendukung dipisah: `src/app/api/restore/bio-wni/route.ts` menyajikan pipeline restore, sementara dua endpoint di `src/app/api/siak/repair_local_biometric/*` menangani operasi `scan` dan `delete` dengan logging ketat (`Log.scope("API")`).

#### Modul Dashboard Monitoring Kinerja

Dashboard memusatkan metrik layanan (capaian, dkb, geulis, m1..m8, userktp, userrekam) yang ditarik langsung dari alias Oracle.

```text
src/
  app/
    dashboard/
      layout.tsx
      DashboardLayoutClient.tsx
      page.tsx
      userktp/
        layout.tsx
        page.tsx
        [user]/page.tsx
      userrekam/
        layout.tsx
        page.tsx
        [user]/page.tsx
  app/api/
    dashboard/
      capaian/route.ts
      dkb/ref|summary/route.ts
      geulis/route.ts
      m1..m8/route.ts
      nongeulis/route.ts
      period|population|salaman|time/route.ts
      userktp/route.ts
      userrekam/route.ts
```

- `DashboardLayoutClient.tsx` -> membungkus semua halaman dashboard dengan `ResponsiveAppShell` sehingga sidebar, topbar, dan guard sesi seragam.
- `userktp/[user]/page.tsx` & `userrekam/[user]/page.tsx` -> rute bertingkat untuk menganalisis performa petugas tertentu tanpa memuat ulang halaman utama.
- `src/app/api/dashboard/*` -> setiap indikator mempunyai route tersendiri sehingga query Oracle tetap fokus dan mudah dipantau (`Log.scope("API")`).
- `src/app/dashboard/page.tsx` -> menyusun kartu ringkasan, grafik, dan tabel dengan data yang diambil paralel dari seluruh endpoint dashboard agar interaksi terasa real-time.

#### Modul Check Layanan Dokumen & KTP-el

Modul ini menangani pemeriksaan status layanan (akta, cetak, duplicate, failure, history, KK, KTP-el, PRR, rekam, SFE, dsb) lengkap dengan datatable interaktif.

```text
src/
  app/
    check/
      akte|cetak|duplicate|failure|history|kk|ktpel|notrecord|prr|rekam|sfe/
        layout.tsx
        mainlayout.tsx
        page.tsx
  app/api/
    check/
      akte/status/route.ts
      cetak/route.ts
      duplicate/(route.ts|meta/route.ts)
      failure/route.ts
      history/route.ts
      kk/status/route.ts
      ktpel/kabupaten|kecamatan|kelurahan|meta|push/route.ts
      notrecord/get-nik|list|report|sekolah|summary/route.ts
      prr/route.ts
      rekam/route.ts
      sfe/route.ts
```

- `mainlayout.tsx` -> menyetel kerangka tabel + filter global sehingga tiap sub-modul hanya fokus pada logika domainnya.
- Setiap `page.tsx` memanggil endpoint spesifik (`/api/check/...`) menggunakan pola `fetcher` yang sama (spinner, alert, DataTable).
- `src/app/api/check/*` memecah query berdasarkan jenis data (status, meta, push) sehingga analitik Oracle mudah diaudit dan dioptimasi.
- Modul ini memanfaatkan komponen `datatable/` untuk ekspor CSV/Excel tanpa menulis ulang utilitas di setiap halaman.

#### Modul Master Operasional Harian

Mencakup pengelolaan absensi petugas, daftar operator, permintaan akses, kontak darurat, dan program Salaman.

```text
src/
  app/
    master/
      absensi|contact|list|request|salaman/
        layout.tsx
        mainlayout.tsx
        page.tsx
  app/api/
    master/
      absensi/route.ts
      contact/route.ts
      list/route.ts
      request/route.ts
```

- `src/app/master/list/page.tsx` -> merender daftar kantor/upt secara tersegmentasi dengan kemampuan pencarian server-side.
- `src/app/master/absensi/page.tsx` -> memadukan data absensi harian dengan indikator SLA sehingga supervisor bisa langsung memfilter petugas bermasalah.
- Endpoint `src/app/api/master/*` menjaga setiap operasi (`absensi`, `contact`, `list`, `request`) tetap terpisah sehingga hak akses database dapat dibuat granular.

#### Modul Setting & Tata Kelola Level

Menangani administrasi akun (daftar user, tambah user, penetapan level akses) serta integrasi langsung dengan tabel referensi di Oracle.

```text
src/
  app/
    setting/
      user/
        add/
          layout.tsx
          mainlayout.tsx
          page.tsx
      userlevel/
        layout.tsx
        mainlayout.tsx
        page.tsx
  app/api/
    setting/
      check_lvl/route.ts
      get_group/route.ts
      get_user_level/route.ts
      save_lvl/route.ts
```

- `src/app/setting/userlevel/page.tsx` -> menampilkan matriks role vs. menu lengkap dengan aksen warna sesuai tema, serta memanggil `/api/setting/get_group` & `/api/setting/get_user_level`.
- `src/app/setting/user/add/page.tsx` -> wizard pembuatan user baru yang memanfaatkan komponen form modular (input + Select) dan mengirimkan payload ke `/api/setting/save_lvl`.
- Endpoint `/api/setting/check_lvl` memastikan user tidak menduplikasi level, sementara `/api/setting/save_lvl` menulis perubahan dengan binding variabel agar audit DB tetap aman.

### 4.2 Desain Sistem UI dan Implementasi Token

Implementasi desain sistem UI mencakup definisi *design tokens* dan kode implementasi tema.

#### ðŸ–Œï¸ Desain Sistem UI (Tokens, Theming, Tipografi, A11y)

  * **Tokens:** `src/styles/tokens.css` berisi variabel semantik (surface, ink, accent, border, shadow, radius, motion, focus). 
  * **Tema:** `theme-dark.css` (Neon Cyberpunk) & `theme-light.css` (Elegant Lux). Gunakan `data-theme="light"` untuk switch. 
  * **Tipografi:** font Inter, skala responsif, panjang baris ideal 65â€“80 karakter. 
  * **A11y:** fokus ring jelas, kontras AA, menghormati `prefers-reduced-motion`. 

<!-- end list -->

```ts
// FILE: src/app/layout.tsx (cuplikan)
import "./globals.css"
import "../styles/tokens.css"
import "../styles/theme-dark.css"
import "../styles/theme-light.css"
```



#### ðŸŽ¨ Design Tokens & Dua Tema (Kode Penuh)

```css
/* FILE: src/styles/tokens.css */
:root {
  --surface-0: #0a0a0c; --surface-1: #0e0e14; --surface-2: #111118;
  --ink: #e5e7eb; --ink-muted: #a6adbb;
  --accent: #00e6c3; --accent-2: #36bffa;
  --success: #22c55e; --warning: #f5c26b; --error: #ff5d73;
  --border-subtle: rgba(255,255,255,.08); --border-strong: rgba(255,255,255,.16);
  --shadow-sm: 0 1px 2px rgba(0,0,0,.25); --shadow-md: 0 6px 18px rgba(0,0,0,.28); --shadow-lg: 0 18px 45px rgba(0,0,0,.35);
  --radius-sm: .375rem; --radius-md: .5rem; --radius-lg: .75rem; --radius-xl: 1rem; --radius-2xl: 1.25rem;
  --easing-std: cubic-bezier(.2,.6,.2,1); --duration-fast: 150ms; --duration-std: 240ms; --duration-slow: 360ms;
  --focus-ring: 0 0 0 3px rgba(54,191,250,.45);
  --gold-1: #d4af37; --gold-2: #f6d365; --gold-3: #ffe8a3;
  --lux-gold-grad: linear-gradient(90deg, var(--gold-1), var(--gold-2) 60%, var(--gold-3));
  --scrollbar-track: rgba(255,255,255,.06);
  --scrollbar-thumb: rgba(255,255,255,.16);
}
*::-webkit-scrollbar { width: 8px; height: 8px; }
*::-webkit-scrollbar-track { background: var(--scrollbar-track); }
*::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 10px; }
```



```css
/* FILE: src/styles/theme-dark.css */
html:not([data-theme="light"]) {
  --surface-0: #0a0a0c; --surface-1: #0e0e14; --surface-2: #111118;
  --ink: #e5e7eb; --ink-muted: #a6adbb;
  --accent: #00e6c3; --accent-2: #36bffa;
  --success: #1ad19a; --warning: #f5c26b; --error: #ff5d73;
  --border-subtle: rgba(255,255,255,.08); --border-strong: rgba(255,255,255,.16);
  --shadow-sm: 0 1px 2px rgba(0,0,0,.35);
  --shadow-md: 0 8px 22px rgba(0,0,0,.45);
  --shadow-lg: 0 22px 60px rgba(0,0,0,.55);
  --focus-ring: 0 0 0 3px rgba(0,230,195,.45);
  --lux-gold-grad: linear-gradient(90deg, var(--gold-1), var(--gold-2) 60%, var(--gold-3));
  --scrollbar-track: rgba(255,255,255,.06);
  --scrollbar-thumb: rgba(255,255,255,.18);
}
aside { background: rgba(20,20,26,.7); backdrop-filter: blur(12px); border-right: 1px solid var(--border-subtle); }
header{ background: rgba(25,25,32,.6); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border-subtle); }
```



```css
/* FILE: src/styles/theme-light.css */
html[data-theme="light"] {
  --pal-silk:#EEE5D9; --pal-marble:#EBEAE0; --pal-champagne:#F6E7C9;
  --surface-0: var(--pal-marble); --surface-1: #F4EFE7; --surface-2: #FFF9F0;
  --ink:#1A1D21; --ink-muted:#4b5563;
  --gold-1:#d4af37; --gold-2:#f6d365; --gold-3:#ffe8a3;
  --lux-gold-grad: linear-gradient(90deg, var(--gold-1), var(--gold-2) 60%, var(--gold-3));
  --accent: var(--gold-1); --accent-2:#8f7a3e; --success:#2e7d32; --warning:#b88315; --error:#b3261e;
  --lux-border:rgba(26,29,33,.12); --border-subtle:var(--lux-border); --border-strong:rgba(26,29,33,.2);
  --shadow-sm: 0 1px 2px rgba(26,29,33,.06); --shadow-md: 0 8px 22px rgba(26,29,33,.10); --shadow-lg: 0 22px 60px rgba(26,29,33,.14);
  --focus-ring: 0 0 0 3px rgba(212,175,55,.35);
  --scrollbar-track: rgba(26,29,33,.06); --scrollbar-thumb: rgba(26,29,33,.18);
}
.card.prestige { border-color: var(--lux-border); box-shadow: var(--shadow-sm); }
.card.prestige > .gold-underline { background: var(--lux-gold-grad); height: 2px; opacity: .9; }
```



```tsx
// FILE: src/app/layout.tsx (import CSS)
import "./globals.css"
import "../styles/tokens.css"
import "../styles/theme-dark.css"
import "../styles/theme-light.css"
```



```tsx
// FILE: src/components/ui/PrestigeCard.tsx
"use client";
import { ReactNode } from "react";
type Props = { title: string; subtitle?: string; actions?: ReactNode; children?: ReactNode; };
export default function PrestigeCard({ title, subtitle, actions, children }: Props) {
  return (
    <section className="rounded-2xl border p-5 md:p-6 relative overflow-hidden" role="region" aria-label={title}
      style={{ borderColor: "var(--border-subtle)", color: "var(--ink)" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl md:text-2xl font-semibold">{title}</h3>
          {subtitle ? <p className="text-sm mt-1" style={{ color: "var(--ink-muted)" }}>{subtitle}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <span className="block mt-3" style={{ background: "var(--lux-gold-grad)", height: 2, opacity: .9 }} />
      <div className="mt-4 text-sm md:text-base">{children}</div>
    </section>
  );
}
```



### 4.3 Kontrak dan Konvensi API

Standarisasi komunikasi antara *front-end* dan *back-end* diatur dalam kontrak API yang ketat.

#### ðŸ“œ Kontrak API & Konvensi

##### ðŸ”— Konvensi URL & Verba

  * Resource nouns dengan `GET/POST` dominan (sesuai App Router best-practice). 
  * Query **selalu menggunakan bind di server (Oracle)** â€” tidak boleh interpolasi string mentah. 

##### âœ‰ï¸ Envelope JSON

```json
{ "success": true, "message": "OK", "data": {} }
```



##### âš ï¸ Status & Error

  * HTTP 200 dengan `success:false` untuk error yang bisa dipahami klien. 
  * 401 / 403 untuk akses ditolak; 500 untuk error tak terduga. 
  * Semua error ditulis ke log dengan scope relevan (API / DB / Session). 

##### ðŸ“Ÿ Contoh cURL

```bash
# Login
curl -i -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"user_id":"demo","pass":"demo"}'

# Session
curl -i http://localhost:3000/api/session --cookie-jar cookies.txt

# Menu
curl -i http://localhost:3000/api/menu --cookie cookies.txt

# SIAK - Repair Local Biometric (scan-only, read ops)
curl -i "http://localhost:3000/api/siak/repair_local_biometric/scan?nik=3273XXXXXXXXXX&scope=rekam" \
  --cookie cookies.txt

# SIAK - Restore BIO WNI (write ops)
curl -i -X POST http://localhost:3000/api/restore/bio-wni \
  --cookie cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"nik":"3273XXXXXXXXXX","reason":"Audit trail restore"}'
```

#### Menu Dinamis SIAK (Restore & Repair)

- `src/app/api/menu/route.ts` membaca view Oracle `VW_SIAK_MENU` untuk menyusun hirarki berdasarkan `MENU_LEVEL` serta `LEVEL_HEAD/SUB/CONTENT`, lalu men-*cache* hasilnya per level user (`unstable_cache` + tag `menu:{level}`).
- Node `Restore BIO WNI (/siak/restore)` dan `Repair Local Biometric (/siak/repair_local_biometric)` ditempatkan di cabang **SIAK > Utilitas** dengan parent non-klikabel, sehingga keduanya muncul sebagai submenu tanpa rute dummy.
- Status aktif menu mengikuti kolom `IS_ACTIVE`. Ketika entri dimatikan di Oracle, halaman otomatis tersembunyi namun tetap terdokumentasi di README untuk audit & *handover*.
- Front-end hanya merender properti `TITLE`, `ICON`, dan `URL`, sehingga perubahan menu SIAK cukup dilakukan di DB tanpa build ulang Next.js.



### 4.4 Tata Kelola Keamanan dan Data

Implementasi keamanan berfokus pada autentikasi, manajemen data sensitif, dan *logging* audit.

#### ðŸ”’ Keamanan & Data Governance

##### ðŸ—ï¸ Autentikasi

  * Cookie HMAC-SHA256 (`session_user`, `session_sig`) 
  * `httpOnly`, `Secure`, `SameSite=Lax`, durasi 8 jam 
  * Middleware proteksi di semua halaman kecuali `/login` 

##### ðŸ¤« Data Sensitif

  * Masking NIK pada tampilan publik / semi-publik 
  * Log hanya menyimpan metadata (tanpa payload sensitif) 
  * Akses ekspor data hanya untuk user berizin 

##### ðŸ“‹ Audit Log

  * Semua query penting dicatat: waktu, durasi, alias, dan bind yang disamarkan. 
  * File log per hari: `logs/YYYY-MM/DD/log.txt` 

##### ðŸ›¡ï¸ Header Keamanan

Disarankan melalui reverse proxy (Nginx/Traefik):

  * `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` 
  * `Content-Security-Policy: default-src 'self';` 
  * `X-Frame-Options: SAMEORIGIN` 

#### ðŸ›¡ï¸ Audit & Masking

  * **NIK:** dimasking `******####` pada UI umum; tampil penuh hanya untuk peran tertentu. 
  * **Log:** menyingkat payload panjang & tidak menyimpan PII utuh. 
  * **Export:** wajib mencatat jejak (siapa, kapan, filter apa). 

### 4.5 Kinerja, Observabilitas, dan Pengujian

Bagian ini mendefinisikan target kinerja non-fungsional dan metodologi pengujian yang digunakan untuk jaminan kualitas.

#### ðŸš€ Kinerja & Observabilitas

##### ðŸŽ¯ Target

| Metrik | Nilai |
| :--- | :--- |
| TTI | \< 2.5s |
| Median API | \< 250 ms |
| Error 5xx | \< 0.5% / minggu |
| Bounce rate turun | â‰¥ 30% |
| Aksi terarah naik | â‰¥ 20% / triwulan |


##### ðŸ—ºï¸ Strategi

  * Lazy load, cache strategis, virtualized table. 
  * Hindari N+1 query; gunakan join & paginasi efisien. 
  * Gunakan `unstable_cache()` untuk data statis. 
  * Stream data panjang agar tidak blocking. 

##### ðŸ©º Log & Health Check

  * Struktur log harian: `logs/YYYY-MM/DD/log.txt`. 
  * Jika gagal menulis log â†’ fallback ke `stderr`. 
  * Endpoint `/api/session/ping` untuk liveness & sliding session. 

#### ðŸ§ª Pengujian & Kualitas

##### ðŸ”¬ Jenis Pengujian

| Tipe | Fokus | Tools |
| :--- | :--- | :--- |
| Static Check | Lint & type safety | ESLint, TypeScript |
| Unit Test | Fungsi utilitas (log, session, builder menu) | Vitest / Jest |
| Integration | API Routes (login, menu, session) | Supertest |
| E2E | Alur login â†’ dashboard â†’ aksi | Playwright |
| Load Test | Endpoint kritikal (menu, KTP-el) | k6 / Artillery |
| A11y Test | Fokus, kontras, motion | axe-core |


**Data uji:** gunakan dummy dataset; hindari PII riil dalam fixture. 

### 4.6 Pedoman Rilis dan Operasional (CI/CD)

Proses rilis diotomatisasi menggunakan *pipeline* CI/CD dan didukung oleh pedoman operasional yang jelas.

#### âš™ï¸ CI/CD, Release, & Operasional

##### âœ‰ï¸ Contoh `.gitlab-ci.yml`

```yaml
# FILE: .gitlab-ci.yml
image: node:20

cache:
  key: ${CI_COMMIT_REF_SLUG}
  paths:
    - node_modules/

stages:
  - install
  - lint
  - build

install:
  stage: install
  script:
    - npm ci
  artifacts:
    paths:
      - node_modules/
    expire_in: 1 day

lint:
  stage: lint
  script:
    - npx prettier -c .
    - npm run -s typecheck || true

build:
  stage: build
  script:
    - npm run build
  artifacts:
    paths:
      - .next
    expire_in: 7 days
```



##### ðŸ—ï¸ Operasional

  * Reverse proxy HTTPS (`X-Forwarded-Proto` diset). 
  * Log rotation & permission ketat untuk `LOG_DIR`. 
  * Monitoring: error rate, latensi median/p95, dan ukuran bundle Next.js. 
  * Gunakan *Node 20+* dengan *Oracle Instant Client 19c+*. 

-----

## BAB V: KESIMPULAN DAN PENUTUP

Dokumen ini telah memaparkan secara komprehensif arsitektur dan strategi migrasi sistem Monalisa Monitoring. Kesimpulan dari pengembangan ini dirangkum dalam filosofi penutup berikut.

### ðŸ Penutup

> â€œWeb bukan sekadar alat kerja â€” ia adalah **refleksi etika pelayanan publik**.  
> Kecepatan bukan hanya soal milidetik, tapi tentang **bagaimana setiap klik memanusiakan data**.â€
>
> â€” *Dian Septian, S.Tr.Kom., M.M.* \> Administrator Database Kependudukan Ahli Pertama  
> Disdukcapil Kota Bandung
> 

#### âš–ï¸ Lisensi & Kepemilikan

Hak cipta Â© 2025 **Dinas Kependudukan dan Pencatatan Sipil Kota Bandung**.   
Dibangun oleh **Dian Septian, S.Tr.Kom., M.M.** Segala kode sumber, dokumentasi, dan aset visual merupakan bagian dari inisiatif modernisasi internal *Monalisa Monitoring* Disdukcapil Bandung. 

> Distribusi ulang sebagian atau seluruh dokumen ini tanpa izin tertulis dilarang.  
> Gunakan dengan integritas, dan kembangkan dengan semangat pelayanan publik yang bermartabat. 

-----

## DAFTAR PUSTAKA

Bagian ini merujuk pada sumber daya teknis eksternal yang digunakan dalam pengembangan.

### ðŸ“š Referensi & Sumber Teknis

  * **Oracle DB Driver:** [https://oracle.github.io/node-oracledb/](https://oracle.github.io/node-oracledb/) 
  * **Next.js Docs:** [https://nextjs.org/docs](https://nextjs.org/docs) 
  * **Tailwind CSS Docs:** [https://tailwindcss.com/docs](https://tailwindcss.com/docs) 
  * **Framer Motion:** [https://www.framer.com/motion/](https://www.framer.com/motion/) 
  * **Shadcn/UI:** [https://ui.shadcn.com](https://ui.shadcn.com) 
  * **Lucide Icons:** [https://lucide.dev/icons/](https://lucide.dev/icons/) 
  * **Mermaid Diagrams:** [https://mermaid.js.org](https://mermaid.js.org) 
  * **TypeScript ESLint Config:** [https://typescript-eslint.io/](https://typescript-eslint.io/) 

-----

## LAMPIRAN

Bagian ini berisi artefak teknis pendukung yang terperinci, termasuk catatan keputusan, rencana pemulihan, *runbook*, dan inventori modul.

### Lampiran A: Catatan Keputusan Arsitektur (ADR)

#### âš–ï¸ ADR â€” Architecture Decision Record

| No | Keputusan | Alasan |
| :--- | :--- | :--- |
| **ADR-001** | Migrasi Laravel â†’ Next.js 15 | Menghapus ketergantungan PHP/Apache, memperkuat SSR/CSR hybrid, dan memusatkan API. |
| **ADR-002** | Node-oracledb (bind variabel wajib) | Keamanan & kinerja: mencegah SQL injection, menekan parsing overhead. |
| **ADR-003** | Logging harian file-based | Jejak audit tidak tergantung DB; aman di mode read-only. |
| **ADR-004** | Theming Dual (Cyberpunk/Lux) | Dua konteks kerja: operasional cepat vs presentasi publik elegan. |
| **ADR-005** | Cookie HMAC auth | Stateless, mudah dipantau, bebas dependency eksternal (tanpa Redis). |
| **ADR-006** | Oracle alias map via `.env` | Multi-lingkungan (dev, staging, prod) tanpa ubah kode. |
| **ADR-007** | Next.js App Router (15) | Konsisten dengan arsitektur baru React & Turbopack build. |
| **ADR-008** | Logging structured per scope | Debug cepat; analisis tren error berdasarkan kategori. |


### Lampiran B: Rencana Pemulihan Bencana (DRP)

#### ðŸ›¡ï¸ Disaster Recovery Plan (DRP)

| Risiko | Dampak | Mitigasi |
| :--- | :--- | :--- |
| **Server crash / OS corrupt** | Layanan berhenti | Snapshot harian (Oracle & Node), auto-restore |
| **Kegagalan koneksi Oracle** | API timeout | Pool fallback â†’ alias cadangan |
| **Kehilangan log** | Audit tidak utuh | Backup `logs/` mingguan ke NAS lokal |
| **Error build Next.js** | Front-end tidak aktif | Rollback otomatis build `.next/prev` |
| **Session rusak** | Logout massal | Middleware fallback â†’ redirect login |
| **Load tinggi** | API delay | Auto-scale ringan (PM2 cluster / Docker) |


**Backup Policy:**

  * **DB Oracle:** export dump harian (level schema) + retention 7 hari. 
  * **Aplikasi:** backup `.next`, `logs`, `.env`, dan `data/menu`. 
  * **Recovery Test:** dilakukan minimal 1x per kuartal. 

### Lampiran C: Runbook Operasional

#### ðŸƒ Runbook Operasional

##### 1ï¸âƒ£ 1. Login & Sesi

  * File: `src/app/api/login/route.ts` 
  * Validasi: MD5 (legacy) â†’ Argon2 (migrasi). 
  * Cookie `session_user` + `session_sig`, masa aktif 8 jam. 
  * Middleware: `src/middleware.ts`. 

##### 2ï¸âƒ£ 2. Dashboard

  * File: `src/app/api/dashboard/route.ts` 
  * Query Oracle (agregat harian/mingguan). 
  * Metrik: KTP-el, DKB, Kelahiran, Kematian, dan WNI/WNA. 

##### 3ï¸âƒ£ 3. Monitoring KTP-el

  * File: `src/app/api/check/ktpel/route.ts` 
  * Filter wilayah, tanggal; push ulang & ekspor CSV. 
  * Pencatatan log ke `logs/YYYY-MM-DD/`. 

##### 4ï¸âƒ£ 4. Chat / Messages

  * File: `src/app/api/messages/route.ts` 
  * Optimistic update (local â†’ confirm). 
  * Interval polling: 5â€“10 detik. 
  * Struktur pesan: `{ id, sender, receiver, text, has_img, created_at }`. 

##### 5ï¸âƒ£ 5. Master Data

  * Folder: `src/app/api/master/*` 
  * Submodul: List, Request, Absensi, Contact, Salaman, TTE. 
  * Semua dengan pagination dan filter Oracle efisien. 

##### 6ï¸âƒ£ 6. Aktivitas

  * Folder: `src/app/api/activity/*` 
  * Simpan semua aksi user sebagai log audit JSON. 
  * Kolom: USER\_ID, ACTION, META\_JSON, CREATED\_AT. 

##### 7ï¸âƒ£ 7. Setting

  * Folder: `src/app/api/setting/*` 
  * ACL berbasis level user; cache & prefetch untuk Sidebar. 
  * Menu auto-build berdasarkan VW\_SIAK\_MENU. 

### Lampiran D: Inventori Modul Legacy Tambahan

#### ðŸ—‚ï¸ Inventori Menu Tambahan (dari Legacy Excel)

> Berikut daftar menu tambahan yang sebelumnya belum tercantum dalam README lama.
> Semua dikelompokkan berdasarkan Level-1 menu.
> Ikon mengikuti standar `mdi` dan `ti` class sesuai file Excel lama. 

##### **Dashboard**

  * **User KTP-EL** â€” `Dashboard/Userktp`
      * Dashboard KTP-el, Biodata, Mobilitas
  * **Dashboard Capil** â€” `Dashboard/Capil`
  * **Dashboard Kemarin** â€” `Dashboard/demogh`
  * **User Perekaman** â€” `Dashboard/Userrekam`
    

##### **Aktivitas**

  * **Rekap Aktivitas Siak** â€” `ActivityRekap`
  * **Aktivitas KK** â€” `KK/Rekap`, `KK/Detail`, `KK/Bulanan`
  * **Aktivitas Kedatangan** â€” `ActivityKedatangan`
    

##### **Master Menu**

  * Master Activity, List, Request, Absensi, Contact, Pemanfaatan Data, Salaman, TTE (KK, Kelahiran, Kematian, dst),
  * Layanan Online (`Master/Salaman`), Kehadiran (`Master/Absensi`), dan E-Kedatangan (`Master/EpuntenDatang`).
    

##### **Laporan**

  * **Dafduk:** laporan perekaman, cetak, suket, KK, biodata, KIA, pindah/datang antar wilayah, identitas tunggal, blangko e-KTP, TTE KK, Petugas Khusus, dll. 
  * **Capil:** akta kelahiran/kematian/perkawinan/perceraian, pengakuan anak, pembetulan akta, konversi WNI-WNA, dan TTE akta. 
  * **Bulanan:** laporan periodik rekam-cetak-KK-KIA. 
  * **DKB:** statistik, cakupan, usia DKB. 
  * **Piak:** software, hardware, jaringan, utility, hak akses SIAK/BCARD/BENROLL, dan warehouse PDIP. 
  * **Aparatur:** pejabat struktural, fungsional, aset, inovasi, nomenklatur. 
  * **Sarana & Prasarana:** realisasi dana, blangko, barang Pemda/Capil. 
  * **BNBA:** mutasi keluar/masuk, akta kelahiran/kematian, rekap LAMPID. 

##### **Checking Dafduk**

  * Status KTP-EL, histori cetak, duplicate local, PRR list, KIA, KK, Akta, Petugas Khusus, Lintas Batas, SKTS, WNA, dan KIA Balita. 
  * Semua endpoint lama (mis. `Check/Rekam`, `Check/Cetak`, `Check/Failure`) disusun ulang dalam `/api/check/*`. 

##### **Request E-KTP**

  * Request perpindahan, suket, cetak ulang (hilang/rusak), serta form kehilangan (`InputKehilangan`). 
  * Struktur baru menggunakan `/api/request/*` dengan validasi binding Oracle. 

##### **Kendali E-KTP**

  * Blangko masuk/keluar, distribusi aset, pencetakan dinas, dan rekap ludo (input-rekap cetak). 

##### **Antrian & Helpdesk**

  * Monitoring antrian, pengecekan kepemilikan akta, biodata hilang, penyesuaian NIK, perbaikan biometrik/data. 
  * Rute modernisasi: `/api/helpdesk/*` dengan payload JSON terstruktur. 

##### **Setting**

  * Monitoring user, level, helpdesk, pejabat, menu, dan master kill. 
  * Semua kini terpusat di `/api/setting/*` dengan ACL dan caching. 

### Lampiran E: Implementasi Seeder Menu

#### ðŸ—‚ï¸ Menu Master dari Excel (JSON & Integrasi)

**Sumber:** `Menu Monitoring.xlsx` â†’ dinormalisasi ke **tree JSON** â†’ `menu.normalized.json`   
**Lokasi:** `data/menu/menu.normalized.json` (repo) atau sementara di `.env` via `MENU_JSON_PATH` untuk mode dev. 

##### ðŸ—ï¸ Integrasi `/api/menu` (Fallback Dev)

```ts
// FILE: src/app/api/menu/route.ts (fallback DEV)
import fs from "fs"; import path from "path";
export async function GET() {
  const menuJsonPath = process.env.MENU_JSON_PATH;
  if (process.env.NODE_ENV !== "production" && menuJsonPath) {
    const json = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), menuJsonPath), "utf-8"));
    return Response.json({ success: true, data: { items: json.items } });
  }
  // TODO: production â†’ query Oracle (APP_MENU / VW_SIAK_MENU)
}
```



##### ðŸ§¾ Schema Oracle (Seed)

```sql
-- FILE: sql/app_menu_schema.sql
CREATE TABLE APP_MENU (
  MENU_ID     VARCHAR2(64) PRIMARY KEY,
  PARENT_ID   VARCHAR2(64) NULL,
  LABEL       VARCHAR2(200) NOT NULL,
  HREF        VARCHAR2(400) NULL,
  ICON        VARCHAR2(100) NULL,
  ORDERING    NUMBER        DEFAULT 0,
  MIN_LEVEL   NUMBER        DEFAULT 1
);
CREATE INDEX IX_APP_MENU_PARENT ON APP_MENU(PARENT_ID, ORDERING);
CREATE INDEX IX_APP_MENU_LEVEL  ON APP_MENU(MIN_LEVEL);
```



##### ðŸŒ± Seeder Node

```ts
// FILE: scripts/seed-menu.ts
import oracledb from "oracledb"; import fs from "fs";
async function flatten(items:any[], parent:any=null, acc:any[]=[]){
  for (const it of items) {
    acc.push({ id:String(it.id), parent_id:parent?String(parent):null, label:it.label||"", href:it.href||null, icon:it.icon||null, ordering:Number.isFinite(it.ordering)?it.ordering:0, min_level:Number.isFinite(it.min_level)?it.min_level:1 });
    if (it.children?.length) await flatten(it.children, it.id, acc);
  } return acc;
}
(async () => {
  const json = JSON.parse(fs.readFileSync("./data/menu/menu.normalized.json","utf-8"));
  const rows = await flatten(json.items);
  const conn = await oracledb.getConnection({ user:"...", password:"...", connectString:"..." });
  await conn.executeMany(
    `INSERT INTO APP_MENU (MENU_ID,PARENT_ID,LABEL,HREF,ICON,ORDERING,MIN_LEVEL)
     VALUES (:id,:parent_id,:label,:href,:icon,:ordering,:min_level)`,
    rows,
    { autoCommit:true }
  );
  await conn.close();
})();
```



### Lampiran F: Dokumentasi Tambahan (Lampiran Modernisasi Lengkap)

#### ðŸ“¦ Lampiran Modernisasi Lengkap

*(Tambahan dokumentasi komprehensif â€“ konten asli di atas tetap dipertahankan utuh sesuai permintaan.)* 

##### ðŸ§± Tumpukan Teknis & Arsitektur Singkat

| Lapisan | Rekomendasi Implementasi |
| :--- | :--- |
| Framework | Next.js 15 App Router, React 19, TypeScript 5 |
| Styling | Tailwind CSS 3, modul CSS kustom (`src/styles/**`), tema gelap/terang |
| UI Kit & Ikon | MUI 7, Radix Select, Lucide, komponen neon internal |
| Data Grid & Visual | DataTables 2 (+Buttons/Responsive), Grid.js, MUI X DataGrid, Chart.js 4 + react-chartjs-2 |
| Animasi | Framer Motion 12 |
| Backend | Next.js API Routes (runtime Node.js), `src/lib/db.ts` + `src/lib/oracle.ts` |
| Database | Oracle SIAK (multi-alias pool, Instant Client 21+) |
| Logging | `src/lib/log.ts` â†’ `logs/YYYY-MM/DD/log.txt` (JSON ringkas) |
| Auth | Cookie HMAC (`session_user` + `session_sig`), middleware halaman & API |
| Build | Turbopack (`npm run dev/build/start`) |


##### ðŸ—ï¸ Arsitektur Solusi (Rekap)

  * **App Shell**: `src/app/layout.tsx` memuat semua stylesheet global, script preferensi tema, dan membungkus anak melalui `ResponsiveAppShell` + `Sidebar` + `Topbar`. 
  * **Middleware**: `src/middleware.ts` (routing halaman) dan `src/middleware.api.ts` (proteksi semua `/api/*`). 
  * **Pool Oracle**: `src/lib/oracle.ts` menyimpan cache pool global per alias (`DB`, `DB222`, `DB5CETAK`, dst). Helper `execRows/execOne/execDml` di `src/lib/db.ts` otomatis logging ringkas. 
  * **Session**: `src/lib/session.ts` mengelola encoding JSON + HMAC, sliding refresh, dan audit login/logout. 
  * **Audit**: Semua endpoint penting menulis log melalui `Log.info/warn/error` untuk memudahkan penelusuran. 

##### ðŸš€ Memulai (Setup Developer)

1.  **Prasyarat**: Node.js 20+, npm 10+, Oracle Instant Client 21+ (set PATH/LD\_LIBRARY\_PATH sesuai OS). 
2.  **Instalasi**:
    ```bash
    npm install
    npm run dev
    ```
    
3.  **Build Produksi**: `npm run build && npm run start`. 
4.  **Lingkungan**: duplikasi `.env.local` â†’ `.env.local.example` sebelum berbagi repo. 

##### ðŸ”‘ Variabel Lingkungan (Ringkasan)

  * `APP_*`, `SESSION_*`, `LOG_DIR`: identitas app & sesi. 
  * Alias Oracle mengikuti pola `<ALIAS>_{USERNAME,PASSWORD,CONN}` â€“ contoh `DB222_USERNAME`, `DB222_CONN`, dll. 
  * Integrasi opsional: Redis (`REDIS_HOST/PORT`), Pusher, FCM, AWS, Socket (`SOCKET_URL`). 
  * Modul KTP-el mendukung override melalui `KTPEL_*` (alias master, wilayah default, push target). 

##### ðŸ“ Struktur Direktori (Highlight)

```
src/
â”œâ”€ app/              # App Router, halaman, API Routes
â”œâ”€ components/       # Layout shell, dashboard widgets, tabel, UI util
â”œâ”€ contexts/         # SessionProvider (user + unread chat)
â”œâ”€ hooks/            # useDashboard*, useMaster*, useNotrecordOptions, dst
â”œâ”€ lib/              # db/oracle/http/session/auth/log utilities
â”œâ”€ styles/           # tokens, theme dark/light, modul komponen
â”œâ”€ middleware(.api).ts
â””â”€ styles/components/ (sidebar, topbar, tables, forms, toast, dll)
```



##### ðŸ“Š Modul Aplikasi (Ikhtisar)

  * **Dashboard**: `src/app/dashboard/**` menampilkan metrik KTP-el, capaian, DKB, penduduk efektif, geulis/non-geulis. Hooks utama `useDashboardData`, `useCapaian`, `usePopulation`, dll. 
  * **Monitoring Check**: `src/app/check/**` mencakup KTP-el (mode rekam/hist/wktp), duplicate, PRR/SFE, cetak, akta, not-record (DAPODIK), rekam historis. 
  * **Master Data**: `src/app/master/**` (list, request, absensi, contact, salaman). Hooks `useMaster*` menstandardisasi fetch + state loading. 
  * **Chat & Messages**: `src/app/chat/page.tsx` + `/api/chat/*` + `/api/messages/*`, dengan polling unread setiap 15 menit dari `SessionProvider`. 
  * **Activity & Audit**: `src/app/Activity/setting/page.tsx`, endpoint `/api/activity/do_save` untuk mencatat aksi. 
  * **Pengaturan**: `src/app/setting/**` memproses user level, penambahan user, pemetaan grup via `/api/setting/*`. 
  * **Template Playground**: `src/app/template/**` sebagai kerangka cepat modul baru. 
  * **Login**: `src/app/login/LoginClient.tsx` â†’ `/api/login` (MD5 legacy + bypass dev + pembaruan `SIAK_SESSION_PLUS`). 

##### ðŸ”Œ Permukaan API (Kategorisasi Cepat)

  * **Auth & Session**: `/api/login`, `/api/logout`, `/api/session`, `/api/session/{ping,verify}`, `/api/account/password`. 
  * **Dashboard**: `/api/dashboard/m1..m8`, `/api/dashboard/time`, `/api/dashboard/capaian`, `/api/dashboard/user{ktp,rekam}/*`, dsb. 
  * **Monitoring**: `/api/check/ktpel`, `/api/check/ktpel/{meta,push,kabupaten,kecamatan,kelurahan}`, `/api/check/{duplicate,notrecord,prr,sfe,failure,akte}`. 
  * **Master & Activity**: `/api/master/{list,request,absensi,contact,salaman}`, `/api/activity/do_save`. 
  * **Chat & Pesan**: `/api/chat/{contacts,messages,send}`, `/api/messages/{previews,unread}`. 
  * **Pengaturan**: `/api/setting/{get_user_level,check_lvl,save_lvl,get_group}`, `/api/menu`, `/api/user`. 

##### ðŸ—‚ï¸ Inventaris Menu App Router (Next.js)

  * **Dashboard & Supervisor**: `/dashboard`, `/dashboard/userktp`, `/dashboard/userktp/[user]`, `/dashboard/userrekam`, `/dashboard/userrekam/[user]`. 
  * **Monitoring Check (KTP-el & kualitas)**: `/check/{ktpel,duplicate,prr,sfe,failure,rekam,history,cetak,akte,kk,notrecord}`. 
  * **Blangko & Cetak Dinas**: `/blangko/{blangko_in,blangko_out,blangko_rekap}`, `/cetak_dinas/{input_cetak,input_ludo,cek_cetak_dinas,rekap_cetak_dinas}`. 
  * **Laporan Dafduk & Lampid**: `/laporan_cetak`, `/laporan_rekam`, `/laporanperpindahan`, `/laporankedatangan`, `/laporanbnbakelahiran`, `/laporanbnbakemeatian`, `/laporanbnbalampid`. 
  * **Report Absensi & Rekap**: `/report/{absensi,absensi_v,absensi_vr,absensibulanan,laporandaily,laporanabsen,Rekap,RekapDaily,GetDaily(+print),laporanabsen/[userId],laporandaily/[userId]}`. 
  * **Permohonan & Pelacakan e-KTP**: `/reqktphilang`, `/reqktprusak`, `/reqktppindahan`, `/reqktpperubahan`, `/inputkehilangan`, `/pengajuan_ld`, `/search_req/{dktp,dktp_f,uktp,uktp_f,req_bio,delete_req}`. 
  * **Master Data & Salam**: `/master/{list,request,contact,absensi,salaman,pemanfaatan}`. 
  * **Chat, Activity, & Audit**: `/chat`, `/Activity/setting`. 
  * **Pengaturan Admin**: `/setting/{user,userlevel,menuuser,activityid,pejabat,helpdesk,app}`. 
  * **SIAK Utilities & Template**: `/siak/repair_local_biometric`, `/siak/restore`, `/template`, `/template/template`, `/dummy`. 

##### ðŸ›°ï¸ Inventaris API Routes (per Domain)

  * **Auth & Session**: `/api/login`, `/api/logout`, `/api/session{,/ping,/verify}`, `/api/account/password`, `/api/utils/my-ip`. 
  * **Dashboard & Supervisor**: `/api/dashboard/{m1..m8,time,capaian,period,population,geulis,nongeulis,update_prr,update_sfe,userktp/*,userrekam/*,dkb/{ref,summary}}`. 
  * **Monitoring KTP-el & Kualitas**: `/api/check/ktpel{,/meta,/push,/kabupaten,/kecamatan,/kelurahan}`, `/api/check/{duplicate,prr,sfe,failure,rekam,history,cetak,akte,kk/status}`, `/api/check/notrecord/{get-nik,list,report,sekolah,summary}`. 
  * **Blangko & Cetak Dinas**: `/api/blangko/{get_data,get_all_data,get_allin_data,doin_save,do_save,do_save_dis,get_hist_dist,get_histkec_dist,get_will,rekap}`, `/api/cetak_dinas/{cek_cetak_dinas,do_save_cetak,do_save_ludo,get_ludo,get_nik,get_nik_kia,rekap_cetak_dinas}`. 
  * **Laporan Dafduk/Lampid**: `/api/laporan/{cetak,rekam,kedatangan,perpindahan}`, `/api/laporan/bnba/{kelahiran,kematian,lampid}`. 
  * **Report Absensi**: `/api/report/absensi/{clock,daily,daily-options,init,sync}`, `/api/report/absensi-v{,/[dailyId]/accept,/[dailyId]/reject}`, `/api/report/absensi-vr{,/users}`, `/api/report/absensibulanan`, `/api/report/laporandaily{,/[userId]}`, `/api/report/laporanabsen{,/[userId]}`, `/api/report/rekap-absensi`, `/api/report/rekap-daily{,/[dailyId]}`, `/api/report/getdaily{,/pdf2}`. 
  * **Permohonan & Pelacakan e-KTP**: `/api/req/ektp/{kehilangan/list,kehilangan/update,perubahan/{ajukan,list,list-ditolak,list-ditolak-dt,list-dt},pindahan/{ajukan,detail,meta}}`, `/api/search_req/{dktp,dktp_f,uktp,uktp_f,req_bio,delete_req,do_delete}`. 
  * **Master & Activity**: `/api/master/{list,request,absensi,contact,salaman,pemanfaatan{,/summary}}`, `/api/activity/do_save`. 
  * **Chat & Pesan**: `/api/chat/{contacts,messages,send}`, `/api/messages/{previews,unread}`. 
  * **Setting & Menu**: `/api/setting/{userlevel/*,users/*,menuuser/*,helpdesk/*,pejabat/*,activityid/*,app,check_lvl,get_user_level,save_lvl,get_group,get_group_tree_one,get_user_level,parents}`, `/api/menu{,/check}`, `/api/user`. 
  * **SIAK & Utilitas**: `/api/siak/repair_local_biometric/{scan,delete}`, `/api/restore/bio-wni`, `/api/wilayah/{provinsi,kabupaten,kecamatan,kelurahan}`. 

##### âœ… Paritas Migrasi Laravel â†’ Next.js (Status per Domain)

| Domain | Halaman Next.js | API Next.js | Status |
| :--- | :--- | :--- | :--- |
| Dashboard & Supervisor | `/dashboard`, `/dashboard/user{ktp,rekam}` | `/api/dashboard/*` | Selesai, live Next.js |
| Monitoring KTP-el & Kualitas | `/check/{ktpel,duplicate,prr,sfe,failure,rekam,history,cetak,akte,kk,notrecord}` | `/api/check/*` | Selesai, paritas + logging |
| Master & Salam | `/master/{list,request,contact,absensi,salaman,pemanfaatan}` | `/api/master/*` | Selesai, parity & paging |
| Chat & Activity | `/chat`, `/Activity/setting` | `/api/chat/*`, `/api/messages/*`, `/api/activity/do_save` | Selesai, audit-ready |
| Blangko & Cetak Dinas | `/blangko/*`, `/cetak_dinas/*` | `/api/blangko/*`, `/api/cetak_dinas/*` | Selesai, rekap aktif |
| Laporan Dafduk/Lampid | `/laporan_*`, `/laporanbnb*` | `/api/laporan/*` | Selesai, terjadwal |
| Report Absensi & Rekap | `/report/*` (absensi, daily, rekap, print) | `/api/report/*` | Selesai, jalur utama |
| Permohonan & Pelacakan e-KTP | `/reqktp*`, `/inputkehilangan`, `/pengajuan_ld`, `/search_req/*` | `/api/req/ektp/*`, `/api/search_req/*` | Selesai, production |
| Pengaturan & Menu | `/setting/*` | `/api/setting/*`, `/api/menu*` | Selesai, ACL diterapkan |
| SIAK & Utilitas | `/siak/*`, `/template`, `/dummy` | `/api/siak/*`, `/api/restore/bio-wni`, `/api/utils/my-ip`, `/api/wilayah/*` | Selesai, util siap pakai |

##### ðŸ§¬ Lapisan Data & Logging

  * Pool Oracle di-cache global â†’ hindari recreate saat hot reload. 
  * Helper `summarizeSql` memangkas query \> 800 karakter pada log. 
  * Log disimpan per hari (folder `logs/YYYY-MM/DD`), format JSON 1 baris/entry, payload dibatasi 4000 karakter. 

##### ðŸŽ¨ Sistem Desain & Aset

  * Token warna & tipografi di `src/styles/tokens.css`. 
  * Tema gelap `theme-dark.css` (Neon Cyberpunk), tema terang `theme-light.css` (Elegant Lux). 
  * Modul CSS komponen: `styles/components/{sidebar,topbar,tables,forms,modal,toast,...}.css`. 
  * DataTables override: `datatable-{dark,light,cyberpunk}.css`. 
  * Aset statis: `public/assets/` (logo, ikon, plugin), executable `public/app/KTPel_x.exe`. 

##### ðŸ§ª Kualitas & Operasional

  * **Lint & Types**: `npx prettier -c .`, `npm run lint`, `tsc --noEmit`. 
  * **Pengujian**: siapkan Vitest/Jest untuk util, Supertest untuk API, Playwright untuk alur penting. 
  * **Deploy**: Node 20+, Instant Client tersedia, `LOG_DIR` writable, reverse proxy serahkan header `X-Forwarded-*`. 
  * **Monitoring**: pantau `tookMs` di log, error rate, latensi median/p95, ukuran bundle Next.js. 

##### ðŸ›¡ï¸ Roadmap & Operasi Tambahan

  * **Tahap Iâ€“II** (selesai): modernisasi inti, chat, activity log, dashboard supervisor, latency monitor. 
  * **Tahap III** (berjalan): integrasi E-Punten API, BSrE TTE, rekonsiliasi DEMOGRAPHICS vs FINGERS, scheduler rekap otomatis. 
  * **Tahap IV** (rencana): deteksi anomali, narasi otomatis, voice assistant eksperimen. 
  * **DRP Singkat**: backup schema Oracle harian, salin `.next`, `.env`, `logs`, `data/menu`; uji restore kuartalan; siapkan fallback alias jika koneksi utama gagal. 

##### ðŸ“š Lampiran Teknis (Ringkas)

  * **Lampiran A** â€“ Matriks environment & alias Oracle. 
  * **Lampiran B** â€“ Peta alias vs modul (DB, DB222, DB5CETAK, WEBDB, DBSMS, EPUNTEN, dsb). 
  * **Lampiran C** â€“ Daftar library UI/data (Next.js, Tailwind, DataTables, Grid.js, Chart.js, Framer Motion, Radix, Lucide, date-fns, react-date-range, jszip, pdfmake, oracledb). 
  * **Lampiran D** â€“ ADR, DRP, & Playbook Ringkas. 

> ðŸ’¡ *Gunakan lampiran ini sebagai pendamping dokumentasi utama di atas. Seluruh isi tambahan disusun untuk melengkapi, bukan menggantikan, narasi README asli.* 

##### Lampiran A â€“ Matriks Environment (Detil)

| Kategori | Variabel | Penjelasan |
| :--- | :--- | :--- |
| Aplikasi | `APP_NAME`, `APP_ENV`, `APP_URL`, `APP_TIMEZONE`, `APP_DEBUG` | Identitas aplikasi & timezone. |
| Session | `SESSION_SECRET`, `SESSION_MAX_AGE`, `SESSION_LIFETIME`, `SESSION_DRIVER` | Pengaturan cookie HMAC & masa berlaku. |
| Logging | `LOG_DIR` | Lokasi penyimpanan log harian. |
| Oracle Utama | `DB_USERNAME`, `DB_PASSWORD`, `DB_CONN` | Alias default `DB`. |
| Oracle Tambahan | `DB222_*`, `DB221_*`, `DB2_*`, `DB5_*`, `DB5CETAK_*`, `DBSMS_*`, `WEBDB_*`, `EPUNTEN_*`, `WEBPUNTEN_*` | Sesuaikan dengan modul (KTP-el, not-record, SMS, web). |
| Redis & Queue | `QUEUE_CONNECTION`, `CACHE_DRIVER`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Opsional jika menyalakan antrean/ cache. |
| Mail | `MAIL_DRIVER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_ENCRYPTION` | Notifikasi email (opsional). |
| Pusher/Socket | `BROADCAST_DRIVER`, `PUSHER_APP_*`, `SOCKET_URL` | Realtime notification / chat. |
| FCM | `FCM_SERVER_KEY`, `FCM_SENDER_ID` | Push notification mobile (opsional). |
| AWS | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_BUCKET` | Penyimpanan objek (opsional). |
| KTP-el Khusus | `KTPEL_DB_ALIAS`, `KTPEL_MASTER_ALIAS`, `KTPEL_WKTP_ALIAS`, `KTPEL_WIL_ALIAS`, `KTPEL_DEMOG_221_ALIAS`, `KTPEL_PUSH_221_ALIAS`, `KTPEL_DB221_ALIAS`, `KTPEL_DEFAULT_PROP`, `KTPEL_DEFAULT_KAB` | Mengarahkan modul KTP-el ke alias/ default wilayah yang tepat. |
| Lainnya | `APP_KEY`, `APP_DEBUG` | Menjaga kompatibilitas historis dengan repo Laravel. |


##### Lampiran B â€“ Peta Alias Oracle & Penggunaan

| Alias | Target DB | Digunakan oleh |
| :--- | :--- | :--- |
| `DB` | SIAK utama | Login, dashboard, master, setting, sebagian besar modul. |
| `DB222` | Mirror monitoring | KTP-el meta, wilayah, arsip. |
| `DB221` / `DB221OLD` | Biomentrik lama | Push ulang, repair biometrik. |
| `DB5` / `DB5CETAK` | Cetak PRR/SFE | Monitoring PRR/SFE, not-record join. |
| `DB2` / `DB2OLD` | Cadangan | Operasi khusus/ backup. |
| `WEBDB` | Web service | Integrasi layanan daring lama. |
| `DBSMS` | SMS Gateway | Pengiriman SMS layanan. |
| `EPUNTEN` / `WEBPUNTEN` | E-Punten | Monitoring kedatangan/pindah. |
| `KTPEL_*` | Alias khusus KTP-el | Diatur via environment sesuai kebutuhan modul. |


##### Lampiran C â€“ Library UI & Data

  * **Next.js 15**, **React 19**, **TypeScript 5** 
  * **Tailwind CSS 3**, modul CSS custom, **Framer Motion 12** 
  * **MUI 7**, **Radix UI Select**, **Lucide React** ikon 
  * **DataTables.net 2** (+Buttons, Responsive), **Grid.js**, **MUI X DataGrid** 
  * **Chart.js 4** + **react-chartjs-2**, **chroma-js** 
  * **date-fns**, **react-date-range** 
  * **jszip**, **pdfmake** (ekspor DataTables) 
  * **oracledb 6.9**, **node-oracledb Instant Client 21** 
  * **prettier**, **eslint-config-next**, **prettier-plugin-tailwindcss** 

##### Lampiran D â€“ ADR, DRP, & Playbook Ringkas

  * **ADR-001 s.d. ADR-008**: migrasi ke Next.js, penggunaan node-oracledb, logging harian, theming dual, cookie HMAC, konfigurasi alias, App Router, logging terstruktur. 
  * **DRP**: snapshot schema Oracle harian, backup `logs/`, `.env`, `.next`, `data/menu`; uji restore kuartalan; siapkan fallback alias jika koneksi utama gagal. 
  * **Runbook**: login/session (`/api/login`), dashboard (`/api/dashboard/*`), monitoring KTP-el (`/api/check/ktpel/*`), chat/messages (`/api/chat/*`, `/api/messages/*`), master (`/api/master/*`), setting (`/api/setting/*`). 

### Lampiran G: Struktur Direktori Lengkap (`project_structure.txt`)

Lampiran ini digunakan sebagai referensi arsitektural ketika perlu menelusuri keseluruhan repositori. File `project_structure.txt` di direktori root berisi output lengkap perintah `tree /F`, sehingga auditor dapat memeriksa versi terbaru tanpa membuka banyak tab.

**Cara memeriksa penuh:** `type project_structure.txt | more` (Windows) atau `less project_structure.txt` (Unix shell). File asli mencantumkan seluruh subfolder `.next`, `logs`, `public`, `src`, hingga arsip pendukung seperti `public/assets/vendor/*`.

Ringkasan area penting:
- `.next/` dan `logs/YYYY-MM/DD/` menyimpan artefak build serta jejak audit harian.
- `public/` memuat aset statis resmi (ikon, plugin, upload foto petugas).
- `src/app/` berisi seluruh App Router route (dashboard, check, master, siak, setting, template, Activity, chat, login).
- `src/components/`, `contexts/`, `hooks/`, dan `lib/` menyediakan fondasi UI, state, utilitas DB/Oracle, dan helper autentikasi.
- `project_structure.txt` sendiri diregenerasi setiap kali dilakukan sinkronisasi struktur agar dokumentasi ini tetap sejalan dengan kode.

<details>
<summary>Klik untuk melihat cuplikan tingkat atas</summary>

```text
monitoring-next/
|-- .next/
|-- logs/
|-- public/
|   |-- app/
|   `-- assets/
|-- src/
|   |-- app/
|   |   |-- api/
|   |   |-- dashboard/
|   |   |-- check/
|   |   |-- master/
|   |   |-- setting/
|   |   |-- siak/
|   |   `-- template/
|   |-- components/
|   |-- contexts/
|   |-- hooks/
|   |-- lib/
|   `-- styles/
|-- README.md
`-- project_structure.txt
```

</details>
