# DOKUMENTASI ARSITEKTUR DAN STRATEGI MIGRASI

## Sistem Monitoring Layanan Kependudukan (MONALISA)

## Studi Kasus: Modernisasi Stack dari Laravel ke Next.js

## Dinas Kependudukan dan Pencatatan Sipil Kota Bandung

[cite\_start]**Repositori Modern (Next.js):** [https://gitlab.com/dianyanzen/monitoring-next](https://gitlab.com/dianyanzen/monitoring-next) [cite: 1]  
[cite\_start]**Repositori Legacy (Laravel):** [https://gitlab.com/dianyanzen/monitoring-laravel](https://gitlab.com/dianyanzen/monitoring-laravel) [cite: 1]

> ⚠️ **Catatan Peringatan Implementasi** \> Repositori ini dapat memuat kredensial *dummy* pada `.env.local` untuk tujuan pengembangan. [cite\_start]Kredensial rahasia wajib diganti di semua lingkungan non-pengembangan dan tidak boleh di-*commit* ke repositori produksi. [cite: 1]

-----

## KATA PENGANTAR

Dokumen ini disusun sebagai naskah arsitektur komprehensif untuk proyek modernisasi sistem Monalisa Monitoring. Bagian berikut memuat narasi personal dari penulis, yang memberikan konteks terhadap filosofi di balik penyusunan dokumen ini.

### Identitas & Narasi Penulis

[cite\_start]Aku, **Dian Septian, S.Tr.Kom., M.M**, adalah **Administrator Database** di **Dinas Kependudukan dan Pencatatan Sipil Kota Bandung**. [cite: 1]  
[cite\_start]Fondasi teknisku adalah **Gelar Sarjana Terapan Komputer**, dan landasan kepemimpinan serta organisasi kutempuh dalam **Magister Manajemen (Manajemen Sumber Daya Manusia)**. [cite: 1]

[cite\_start]Bahasa dokumentasi ini sengaja lugas dan tajam: **teknis yang membumi**, **UX yang bisa dipegang**, dan **akuntabilitas publik** sebagai haluan. [cite: 1]

-----

## ABSTRAK

Monalisa Monitoring merepresentasikan modernisasi arsitektur antarmuka untuk monitoring layanan kependudukan di Disdukcapil Kota Bandung. [cite\_start]Pengembangan ini mentransformasi *stack* teknologi *legacy* (Laravel 6 + Oracle) [cite: 1] [cite\_start]menjadi *stack* modern (Next.js 15 (App Router) + TypeScript + Oracle)[cite: 1]. [cite\_start]Sistem ini mengonsolidasikan beragam modul—mencakup *dashboard*, modul *master data*, monitoring KTP-el, perpesanan internal, dan utilitas operasional—ke dalam satu bahasa visual yang konsisten dengan kapabilitas *auditability* yang kuat[cite: 1]. [cite\_start]Interaksi dengan basis data Oracle SIAK difasilitasi melalui API Routes (Next.js), menerapkan *binding* variabel yang ketat dan *logging* berjejak harian[cite: 1]. [cite\_start]Hasil yang dituju mencakup peningkatan waktu tanggap sistem, percepatan pengambilan keputusan operasional, reduksi beban kognitif petugas, dan tersedianya jejak keputusan yang siap diaudit[cite: 1]. [cite\_start]Indikator Kinerja Utama (KPI) yang ditargetkan antara lain TTI \< 2.5s, latensi API median \< 250 ms, dan penurunan *bounce rate* ≥ 30%[cite: 1].

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

*(Navigasi Cepat orisinal dipertahankan untuk referensi internal)*

### 🧭 Navigasi Cepat (Orisinal)

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

#### Abstrak & Latar Belakang (Orisinal)

[cite\_start]Fragmentasi modul dan variasi gaya antarmuka memecah konteks operasional. [cite: 1]  
[cite\_start]Angka-angka statistik tanpa narasi tindakan menambah beban kognitif petugas, sementara perubahan cepat (mis. status KTP-el) menuntut antarmuka yang **mengantar aksi**, bukan sekadar menampilkan data. [cite: 1]  
[cite\_start]Sisi akuntabilitas publik menuntut **jejak keputusan** yang mudah ditelusuri. [cite: 1]

[cite\_start]**Hipotesis produk:** \> Satu bahasa visual + arsitektur API terukur → beban kognitif turun → kualitas keputusan naik → pelayanan lebih cepat. [cite: 1]

### 1.2 Rumusan Masalah

Berdasarkan latar belakang tersebut, permasalahan utama dapat dirumuskan sebagai berikut:

1.  [cite\_start]Bagaimana merancang arsitektur sistem terpadu yang mampu mengonsolidasikan modul-modul monitoring yang terfragmentasi (dashboard, master, KTP-el, chat) [cite: 1] [cite\_start]untuk mengurangi fragmentasi konteks operasional? [cite: 1]
2.  [cite\_start]Bagaimana mentransformasi penyajian data dari statis menjadi *insight* yang dapat ditindaklanjuti (*actionable*) untuk mengurangi beban kognitif petugas? [cite: 1]
3.  [cite\_start]Bagaimana strategi migrasi teknis yang paling efektif untuk beralih dari *stack* monolitik Laravel 6 [cite: 1] [cite\_start]ke *stack* modern Next.js 15 [cite: 1] [cite\_start]sambil memastikan keamanan interaksi data Oracle [cite: 1] [cite\_start]dan menciptakan jejak audit yang kuat? [cite: 1]

### 1.3 Tujuan, Ruang Lingkup, & Prinsip Pengembangan

Bagian ini mendefinisikan sasaran, batasan, dan kaidah dasar yang memandu pengembangan sistem modern.

#### Tujuan, Ruang Lingkup, & Prinsip (Orisinal)

##### 🎯 Tujuan

  * [cite\_start]Menyatukan monitoring & utilitas operasional dalam UI konsisten. [cite: 1]
  * [cite\_start]Mengubah data menjadi **tindakan** dan **jejak keputusan**. [cite: 1]
  * [cite\_start]Menyediakan alat bantu operasi (push ulang, filter wilayah, ekspor, chat) yang dekat dengan data. [cite: 1]

##### 📦 Ruang Lingkup

  * [cite\_start]**Front-end:** Next.js 15 (App Router), React 19, Tailwind 3, Framer Motion, MUI, Chart.js, DataTables, Grid.js. [cite: 1]
  * [cite\_start]**Back-end:** Next.js **API Routes** → Oracle (multi-alias pool); logging harian. [cite: 1]
  * [cite\_start]**Modul:** Dashboard, Master, Check KTP-el, Chat, Activity, Template. [cite: 1]

##### 🛡️ Prinsip

  * [cite\_start]**Clarity First**, **Honest Motion**, **Progressive Disclosure**. [cite: 1]
  * [cite\_start]**Cognitive Economy**: pola berulang dan konsisten. [cite: 1]
  * [cite\_start]**Audit-Ready by Design** — setiap keputusan dapat dilacak. [cite: 1]

-----

## BAB II: METODOLOGI PENGEMBANGAN DAN STRATEGI MIGRASI

Bab ini menguraikan metodologi yang digunakan untuk transisi dari sistem *legacy* ke sistem modern, mencakup perbandingan arsitektur, strategi, dan peta jalan implementasi.

### 2.1 Analisis Arsitektur Legacy (Laravel 6)

Pemahaman mendalam terhadap sistem *legacy* adalah fondasi dari strategi migrasi.

#### 📜 Legacy (Laravel 6) (Orisinal)

  * [cite\_start]Laravel ^6.2 (PHP ^7.2) dengan `yajra/laravel-oci8`. [cite: 1]
  * [cite\_start]Session Laravel + **Passport (OAuth2)** untuk API Android *ePunten*. [cite: 1]
  * [cite\_start]Blade + Semantic UI + jQuery; sebagian menggunakan Vue. [cite: 1]
  * [cite\_start]Integrasi eksternal: Pusher, Browsershot/DOMPDF, Excel, Redis (opsional), **ZKTeco** (absensi via Windows service). [cite: 1]

### 2.2 Definisi Arsitektur Modern (Next.js 15)

Arsitektur modern dirancang untuk mengatasi keterbatasan sistem *legacy* sambil memperkenalkan kapabilitas baru.

#### ✨ Modern (Next.js) (Orisinal)

  * [cite\_start]**Controller → API Route:** langsung dipetakan ke `src/app/api/*`. [cite: 1]
  * [cite\_start]**Passport → Cookie HMAC:** sesi internal berbasis `session_user + session_sig`. [cite: 1]
  * [cite\_start]**Blade/jQuery → React 19:** semua komponen modular dan reaktif. [cite: 1]
  * [cite\_start]**Queue/Service:** diganti job scheduler Node.js atau bridge Windows Service bila perlu. [cite: 1]

### 2.3 Strategi Migrasi Bertahap

Migrasi tidak dilakukan sebagai *big-bang*, melainkan melalui pendekatan bertahap yang terkontrol.

#### 📦 Strategi Migrasi Bertahap (Orisinal)

1.  [cite\_start]**Inventarisasi modul legacy** → target halaman Next.js. [cite: 1]
2.  [cite\_start]**Audit schema & query** → validasi indeks, normalisasi transaksi. [cite: 1]
3.  [cite\_start]**Kontrak API** → gunakan JSON, status, dan paging konsisten. [cite: 1]
4.  [cite\_start]**Transisi autentikasi** → sesi HMAC; peran dan level pengguna disesuaikan. [cite: 1]
5.  [cite\_start]**Replikasi UX/Paritas UI** + penambahan A11y (aksesibilitas). [cite: 1]
6.  [cite\_start]**Validasi & Masking PII** → sesuai pedoman data governance. [cite: 1]
7.  [cite\_start]**Release bertahap (canary)** → monitor log dan telemetri. [cite: 1]
8.  [cite\_start]**Sunset modul lama** setelah Next.js stabil sepenuhnya. [cite: 1]

### 2.4 Peta Jalan (Roadmap) Produk

Strategi migrasi diimplementasikan melalui peta jalan pengembangan yang terbagi menjadi empat fase utama.

#### 🗺️ Roadmap Produk (Orisinal)

> [cite\_start]**Progress Update (Oktober 2025):** Tahap II selesai (chat, activity log, dashboard supervisor, dan latency monitor telah dirilis) dan fokus berpindah ke orkestrasi integrasi Tahap III. [cite: 1]

##### 1️⃣ Tahap I — Core Modernization (✅)

  * [cite\_start]Migrasi Login, Session, Dashboard, Menu, dan Check KTP-el ke Next.js. [cite: 1]
  * [cite\_start]Implementasi pool Oracle multi-alias dengan binding ketat. [cite: 1]
  * [cite\_start]Logging harian + error telemetry. [cite: 1]
  * [cite\_start]Desain sistem dark–light mode konsisten (Cyberpunk / Lux). [cite: 1]

##### 2️⃣ Tahap II — Operasional & Observabilitas (✅ Selesai — Oktober 2025)

  * [cite\_start]Aktivasi chat & messages (socket fallback → polling teroptimasi). [cite: 1]
  * [cite\_start]Audit activity log dengan filter & search. [cite: 1]
  * [cite\_start]Dashboard supervisor interaktif (wilayah, capaian, anomaly trend). [cite: 1]
  * [cite\_start]Monitoring API latency (middleware internal). [cite: 1]
  * [cite\_start]Build modular: `/components/layout`, `/components/system`. [cite: 1]
  * [cite\_start]Release note: modul chat, activity log, dashboard supervisor, dan latency monitor sudah stabil di staging. [cite: 1]

##### 3️⃣ Tahap III — Integrasi & Automasi (⏳ Berjalan)

  * [cite\_start]Integrasi **E-Punten API** (mutasi keluar/datang online) — kickoff, mapping payload, dan persiapan auth token berlangsung. [cite: 1]
  * [cite\_start]Integrasi **TTE** (KK, Akta, Surat Pernyataan) dengan BSrE & eSign. [cite: 1]
  * [cite\_start]Rekonsiliasi database **DEMOGRAPHICS@DB5** vs **FINGERS@DB5**. [cite: 1]
  * [cite\_start]Sinkronisasi warehouse PDIP (via view Oracle). [cite: 1]
  * [cite\_start]Job Scheduler Node untuk rekap otomatis & daily digest. [cite: 1]

##### 4️⃣ Tahap IV — Predictive & Cognitive Layer (📝 Draft)

  * [cite\_start]Deteksi anomali pelayanan berbasis data historis (AI monitor). [cite: 1]
  * [cite\_start]Insight naratif otomatis: “Wilayah dengan rasio cetak KTP rendah minggu ini adalah ...”. [cite: 1]
  * [cite\_start]Voice assistant untuk query data operasional (experimental). [cite: 1]

### 2.5 Playbook dan Matriks Migrasi Modul

Eksekusi strategi migrasi didokumentasikan dalam *playbook* dan matriks pemetaan modul berikut.

#### 📘 Playbook Migrasi Per-Modul (Orisinal)

##### 📝 Konvensi Umum (Next.js)

  * [cite\_start]Cookie: `session_user` (payload terenkripsi) + `session_sig` (HMAC-SHA256). [cite: 1]
  * [cite\_start]`httpOnly`, `SameSite=Lax`, `Secure:true` di produksi. [cite: 1]
  * [cite\_start]Env alias DB via `DB_*`, `DB222_*`, `DB221_*`, dst. [cite: 1]
  * [cite\_start]Logging otomatis: `logs/YYYY-MM/DD/log.txt`. [cite: 1]
  * [cite\_start]Scope log: `API`, `DB`, `SESSION`, `MIDDLEWARE`. [cite: 1]
  * [cite\_start]Response envelope: `{ "success": true, "message": "OK", "data": {} }`. [cite: 1]
  * [cite\_start]Paging: `?page=1&per_page=25` atau `?limit=25&offset=0`. [cite: 1]
  * [cite\_start]Tanggal format ISO 8601 (UTC). [cite: 1]
  * Error:
      * [cite\_start]`200 (success:false)` → validasi. [cite: 1]
      * [cite\_start]`401/403` → akses ditolak. [cite: 1]
      * [cite\_start]`500` → error tak terduga. [cite: 1]

##### 🗺️ Matriks Mapping Modul

| Modul | Laravel (Legacy) | Next.js (Modern) | Method | Autentikasi | Catatan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Login / Session** | `AuthController@login`, `ping` | `/api/login`, `/api/session*` | POST / GET | ✅ | Cookie HMAC, sliding session |
| **Menu** | `MenuController@index` | `/api/menu` | GET | ✅ | Cache per level 300s, `buildTree()` |
| **Dashboard** | `DashboardController@*` | `/api/dashboard/*` | GET | ✅ | Metrik KTP-el/DKB/Geulis |
| **Check KTP-el** | `KtpController@*` | `/api/check/ktpel/*` | GET/POST | ✅ | Filter wilayah/tanggal, push massal |
| **Master: List** | `Master\ListController@*` | `/api/master/list` | GET | ✅ | Virtualized table |
| **Master: Request** | `Master\RequestController@*` | `/api/master/request` | GET | ✅ | Ekspor CSV/Excel |
| **Master: Contact** | `Master\ContactController@*` | `/api/master/contact` | GET | ✅ | Fitur pencarian |
| **Master: Absensi** | `Master\AbsensiController@*` | `/api/master/absensi` | GET | ✅ | Integrasi ZKTeco |
| **Master: Salam** | `Master\SalamController@*` | `/api/master/salaman` | GET | ✅ | Layanan online |
| **Chat / Messages** | `ChatController@*`, `Message@*` | `/api/chat/*`, `/api/messages/*` | GET/POST | ✅ | Optimistic send |
| **Activity Log** | `ActivityController@save` | `/api/activity/do_save` | POST | ✅ | Audit trail |
| **Account Password** | `AccountController@password` | `/api/account/password` | POST | ✅ | Upgrade hash bcrypt |
| **User Profile** | `UserController@show` | `/api/user` | GET | ✅ | Minimal PII |

[cite\_start][cite: 1]

-----

## BAB III: HASIL DAN PEMBAHASAN - DESAIN ARSITEKTUR MODERN

Bab ini memaparkan hasil dari proses desain dan arsitektur sistem modern, mencakup analisis kebutuhan, desain antarmuka, arsitektur sistem, dan arsitektur data.

### 3.1 Analisis Kebutuhan Pengguna (Persona & Journey)

Analisis kebutuhan pengguna dilakukan melalui pendefinisian persona dan pemetaan alur pengguna (*user journey*).

#### Persona, Journey, & Kebutuhan Pengguna (Orisinal)

##### 👤 Persona Utama

| Peran | Tujuan | Kebutuhan |
| :--- | :--- | :--- |
| **Petugas Loket** | Mengetahui status cepat, tindakan langsung (push ulang, verifikasi). | UI ringkas, responsif, tanpa distraksi. |
| **Operator Wilayah** | Menyaring data kec/kels, ekspor, tindak lanjut. | Filter dinamis, laporan cepat. |
| **Supervisor** | Melihat tren dan anomali. | Dashboard interaktif, drill-down ringan. |
| **Administrator** | Menjamin kestabilan sistem dan audit. | Log detail, kontrol sesi, dan hak akses. |

[cite\_start][cite: 1]

##### 🗺️ Journey Ringkas (Check KTP-el)

1.  [cite\_start]Pilih **wilayah** & **rentang waktu**. [cite: 1]
2.  [cite\_start]Lihat **kartu metrik** (status, error, progress). [cite: 1]
3.  [cite\_start]Jalankan **aksi** (push ulang / ekspor) langsung di konteks data. [cite: 1]
4.  [cite\_start]**Catatan otomatis (log)** tercipta untuk audit. [cite: 1]

[cite\_start]**Non-Fungsional:** - Reliabilitas tinggi di jam sibuk. [cite: 1]

  * [cite\_start]Observabilitas: log terstruktur, scope jelas, payload minimal. [cite: 1]
  * [cite\_start]Aksesibilitas (A11y): fokus jelas, `prefers-reduced-motion`, kontras AA. [cite: 1]

### 3.2 Desain Arsitektur Antarmuka (Filosofi & Tema Visual)

Desain antarmuka didasarkan pada filosofi yang berpusat pada aksi dan kejelasan, diimplementasikan melalui dua tema visual utama.

#### 🎨 Filosofi Desain & Tema Visual (Orisinal)

  * [cite\_start]**Angka besar untuk status utama**, teks pendukung hemat dan informatif. [cite: 1]
  * [cite\_start]**Motion jujur:** hanya untuk menandai transisi atau perubahan state, bukan dekorasi. [cite: 1]
  * [cite\_start]**Empty state** bukan ruang kosong, tapi panduan langkah selanjutnya. [cite: 1]
  * [cite\_start]Visual mengantar **aksi**, bukan sekadar “pamer data”. [cite: 1]

##### Tema 1 — **Neon Cyberpunk** (default operasional)

[cite\_start]Menampilkan atmosfer ruang kendali; aksen neon dipakai untuk *state/accent*, bukan sebagai latar. [cite: 1]  
[cite\_start]Rasio neon : netral ≈ **1 : 4** [cite: 1]

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

[cite\_start][cite: 1]

##### Tema 2 — **Elegant Lux** (narasi/presentasi)

[cite\_start]Palet seperti kertas marmer hangat dan tinta pekat, dengan aksen emas untuk detail prestige (bukan fill besar). [cite: 1]

```css
/* FILE: src/styles/theme-light.css (konsep) */
html[data-theme="light"] {
  --pal-silk:#EEE5D9; --pal-marble:#EBEAE0;
  --lux-ink:#1A1D21; --lux-border:rgba(26,29,33,.12);
  --gold-1:#D4AF37; --gold-2:#F6D365; --gold-3:#FFE8A3;
  --lux-gold-grad:linear-gradient(90deg,var(--gold-1),var(--gold-2) 60%,var(--gold-3));
}
```

[cite\_start][cite: 1]

[cite\_start]**Kontras target:** WCAG AA untuk teks ≥ 14 px reguler / 12 px bold. [cite: 1]

### 3.3 Desain Arsitektur Sistem (C4, Kontainer, Sekuens)

Arsitektur sistem didokumentasikan menggunakan model C4 (Context, Container, Component, Code) untuk memvisualisasikan dekomposisi sistem.

#### 🏗️ Arsitektur Sistem (C4, Kontainer, Sekuens, Deployment) (Orisinal)

**Stack Inti**

  * [cite\_start]**Front-end:** Next.js 15, React 19, Tailwind 3, Framer Motion, MUI, Chart.js, DataTables, Grid.js. [cite: 1]
  * [cite\_start]**API:** Next.js API Routes → node-oracledb (pool multi-alias). [cite: 1]
  * [cite\_start]**Auth:** Cookie HMAC-SHA256 (`session_user` + `session_sig`) + middleware halaman dan API. [cite: 1]
  * [cite\_start]**Logging:** `logs/YYYY-MM/DD/log.txt` otomatis, payload dipangkas. [cite: 1]

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

[cite\_start][cite: 1]

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
  db["Oracle — SIAK schema<br/>SIAK_USER_PLUS, SIAK_SESSION_PLUS, VW_SIAK_MENU, ..."]

  %% ===== Relations =====
  ui -->|"fetch JSON (credentials: include)"| api
  api -->|"oracledb: pool & bind"| db
  api -->|"write log"| log

```

[cite\_start][cite: 1]

##### Diagram Sekuens (Login → Session)

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

[cite\_start][cite: 1]

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

[cite\_start][cite: 1]

### 3.4 Desain Arsitektur Data (ERD & Pedoman SQL)

Arsitektur data mencakup skema relasi entitas (ERD) yang disederhanakan dan serangkaian pedoman interaksi basis data (SQL).

#### 🗃️ Database & Pedoman SQL (Orisinal)

##### 🏷️ Alias Database

[cite\_start]`DB`, `DB222`, `DB221`, `WEBDB`, `EPUNTEN`, `WEBPUNTEN`, dsb (diatur dari `.env`). [cite: 1]

##### 🔑 Konvensi Utama

1.  [cite\_start]**Penamaan:** tabel & kolom → `UPPER_SNAKE_CASE`. [cite: 1]
2.  [cite\_start]**Binding:** wajib gunakan `:b_*` (tanpa interpolasi string). [cite: 1]
3.  [cite\_start]**Waktu:** gunakan `SYSDATE / SYSTIMESTAMP` untuk DML. [cite: 1]
4.  [cite\_start]**Format hasil:** `OUT_FORMAT_OBJECT`. [cite: 1]
5.  [cite\_start]**Transaksi:** auto-commit per statement, atau eksplisit bila batch. [cite: 1]
6.  [cite\_start]**Session tracking:** `SIAK_SESSION_PLUS` (SESSION\_ID, USER\_ID, IP, USER\_AGENT, LAST\_ACTIVITY, IS\_ACTIVE). [cite: 1]
7.  [cite\_start]**Expiry aplikasi:** sumber dari `SIAK_MASTER` (`SYSTEM_TYPE='INIT_SETING'`, `SYSTEM_CODE='EXP'`). [cite: 1]
8.  [cite\_start]**Password:** legacy MD5 → migrasi bertahap ke Argon2/BCrypt. [cite: 1]
9.  [cite\_start]**Cookie:** `session_user` hanya simpan SESSION\_ID; profil diambil server-side. [cite: 1]
10. [cite\_start]**Keamanan tambahan:** opsional IP check, rate limit login, audit gagal. [cite: 1]

##### 💡 Rekomendasi Indeks

| Tabel | Indeks Disarankan |
| :--- | :--- |
| `SIAK_SESSION_PLUS` | PK `(SESSION_ID)`, IDX `(USER_ID)`, IDX `(LAST_ACTIVITY)` |
| `VW_SIAK_MENU` | IDX `(MIN_LEVEL)`, IDX `(PARENT_ID, ORDERING)` |
| `KTP_EL_STATUS_LOG` | IDX `(KAB_ID, KEC_ID, KEL_ID, TANGGAL)`, IDX `(STATUS, TANGGAL)` |
| `MESSAGES` | IDX `(RECEIVER_ID, CREATED_AT)`, IDX `(SENDER_ID, CREATED_AT)` |
| `ABSENSI_LOG` | IDX `(NIP, CHECK_IN)` |
[cite\_start][cite: 1]

##### 📝 Contoh Pola SQL (Bind Variables)

```sql
-- FILE: sql/session_keepalive.sql
UPDATE SIAK_SESSION_PLUS
   SET LAST_ACTIVITY = SYSTIMESTAMP
 WHERE SESSION_ID = :b_session_id
   AND IS_ACTIVE = 1;
```

[cite\_start][cite: 1]

```sql
-- FILE: sql/menu_by_level.sql
SELECT MENU_ID, PARENT_ID, LABEL, HREF, ORDERING
  FROM VW_SIAK_MENU
 WHERE MIN_LEVEL <= :b_user_level
 ORDER BY NVL(PARENT_ID, 0), ORDERING;
```

[cite\_start][cite: 1]

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

[cite\_start][cite: 1]

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

[cite\_start][cite: 1]

#### 📊 ERD & SQL Audit (Orisinal)

> [cite\_start]Skema entitas inti dan indeks yang paling sering digunakan (disederhanakan dari SIAK schema). [cite: 1]

##### 📊 ER Diagram (Mermaid)

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

[cite\_start][cite: 1]

##### 🔎 Contoh Query Audit

```sql
-- FILE: sql/activity_log_insert.sql
INSERT INTO ACTIVITY_LOG (USER_ID, ACTION, META_JSON, CREATED_AT)
VALUES (:b_user, :b_action, :b_meta, SYSTIMESTAMP);
```

[cite\_start][cite: 1]

```sql
-- FILE: sql/messages_latest_by_user.sql
SELECT m.*
  FROM MESSAGES m
 WHERE m.RECEIVER_ID = :b_user
 ORDER BY m.CREATED_AT DESC
 FETCH FIRST 25 ROWS ONLY;
```

[cite\_start][cite: 1]

```sql
-- FILE: sql/master_request_recap.sql
SELECT STATUS, COUNT(*) AS JUMLAH
  FROM MASTER_REQUEST
 WHERE CREATED_AT BETWEEN :b_start AND :b_end
 GROUP BY STATUS;
```

[cite\_start][cite: 1]

```sql
-- FILE: sql/session_expired_cleanup.sql
DELETE FROM SIAK_SESSION_PLUS
 WHERE IS_ACTIVE = 0
   OR LAST_ACTIVITY < (SYSTIMESTAMP - INTERVAL '8' HOUR);
```

[cite\_start][cite: 1]

##### ⚖️ Audit Policy

  * [cite\_start]Semua query penting ditulis di folder `/sql/` dengan penamaan konsisten. [cite: 1]
  * [cite\_start]Struktur log memuat waktu, alias DB, durasi eksekusi, dan hasil. [cite: 1]
  * [cite\_start]Audit data export wajib mencatat filter, jumlah baris, dan operator. [cite: 1]

-----

## BAB IV: IMPLEMENTASI DAN JAMINAN KUALITAS

Bab ini merinci aspek-aspek teknis implementasi sistem modern, mulai dari struktur kode, kontrak API, keamanan, hingga strategi pengujian dan operasional.

### 4.1 Struktur Direktori Proyek

Struktur direktori proyek dirancang untuk skalabilitas dan kemudahan pemeliharaan, mengikuti konvensi Next.js App Router.

#### 📂 Struktur Proyek (Deep Dive) (Orisinal)

```
├── .env.local
├── package.json
├── tsconfig.json
├── postcss.config.mjs
├── tailwind.config.js
├── public/
└── src/
    ├── app/
    │   ├── api/ (login, session, menu, dashboard, check/ktpel, master, chat, messages, activity, account, user)
    │   ├── dashboard/
    │   ├── login/
    │   ├── chat/
    │   ├── check/ktpel/
    │   ├── master/
    │   ├── globals.css
    │   └── layout.tsx
    ├── components/
    │   ├── layout/ (ResponsiveAppShell, Sidebar, Topbar, Footer)
    │   ├── dashboard/ (cards, charts)
    │   ├── datatable/ (DataTables/Grid.js wrappers)
    │   ├── system/ (overlay/dialog/alert)
    │   └── ui/ (DateRangePopup, dsb)
    ├── contexts/session.tsx
    ├── hooks/
    ├── lib/ (session.ts, log.ts, oracle.ts, db.ts, http.ts, auth.ts, user.ts)
    ├── middleware.ts
    └── middleware.api.ts
```

[cite\_start][cite: 1]

**Aturan Penting**

  * [cite\_start]Jangan ubah `lib/oracle.ts`, `lib/db.ts`, `lib/http.ts` tanpa izin khusus. [cite: 1]
  * [cite\_start]Semua snippet dokumentasi wajib mencantumkan **lokasi file**. [cite: 1]

### 4.2 Desain Sistem UI dan Implementasi Token

Implementasi desain sistem UI mencakup definisi *design tokens* dan kode implementasi tema.

#### 🖌️ Desain Sistem UI (Tokens, Theming, Tipografi, A11y) (Orisinal)

  * [cite\_start]**Tokens:** `src/styles/tokens.css` berisi variabel semantik (surface, ink, accent, border, shadow, radius, motion, focus). [cite: 1]
  * **Tema:** `theme-dark.css` (Neon Cyberpunk) & `theme-light.css` (Elegant Lux). [cite\_start]Gunakan `data-theme="light"` untuk switch. [cite: 1]
  * [cite\_start]**Tipografi:** font Inter, skala responsif, panjang baris ideal 65–80 karakter. [cite: 1]
  * [cite\_start]**A11y:** fokus ring jelas, kontras AA, menghormati `prefers-reduced-motion`. [cite: 1]

<!-- end list -->

```ts
// FILE: src/app/layout.tsx (cuplikan)
import "./globals.css"
import "../styles/tokens.css"
import "../styles/theme-dark.css"
import "../styles/theme-light.css"
```

[cite\_start][cite: 1]

#### 🎨 Design Tokens & Dua Tema (Kode Penuh) (Orisinal)

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

[cite\_start][cite: 1]

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

[cite\_start][cite: 1]

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

[cite\_start][cite: 1]

```tsx
// FILE: src/app/layout.tsx (import CSS)
import "./globals.css"
import "../styles/tokens.css"
import "../styles/theme-dark.css"
import "../styles/theme-light.css"
```

[cite\_start][cite: 1]

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

[cite\_start][cite: 1]

### 4.3 Kontrak dan Konvensi API

Standarisasi komunikasi antara *front-end* dan *back-end* diatur dalam kontrak API yang ketat.

#### 📜 Kontrak API & Konvensi (Orisinal)

##### 🔗 Konvensi URL & Verba

  * [cite\_start]Resource nouns dengan `GET/POST` dominan (sesuai App Router best-practice). [cite: 1]
  * [cite\_start]Query **selalu menggunakan bind di server (Oracle)** — tidak boleh interpolasi string mentah. [cite: 1]

##### ✉️ Envelope JSON

```json
{ "success": true, "message": "OK", "data": {} }
```

[cite\_start][cite: 1]

##### ⚠️ Status & Error

  * [cite\_start]HTTP 200 dengan `success:false` untuk error yang bisa dipahami klien. [cite: 1]
  * 401 / 403 untuk akses ditolak; [cite\_start]500 untuk error tak terduga. [cite: 1]
  * [cite\_start]Semua error ditulis ke log dengan scope relevan (API / DB / Session). [cite: 1]

##### 📟 Contoh cURL

```bash
# Login
curl -i -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"user_id":"demo","pass":"demo"}'

# Session
curl -i http://localhost:3000/api/session --cookie-jar cookies.txt

# Menu
curl -i http://localhost:3000/api/menu --cookie cookies.txt
```

[cite\_start][cite: 1]

### 4.4 Tata Kelola Keamanan dan Data

Implementasi keamanan berfokus pada autentikasi, manajemen data sensitif, dan *logging* audit.

#### 🔒 Keamanan & Data Governance (Orisinal)

##### 🏗️ Autentikasi

  * [cite\_start]Cookie HMAC-SHA256 (`session_user`, `session_sig`) [cite: 1]
  * [cite\_start]`httpOnly`, `Secure`, `SameSite=Lax`, durasi 8 jam [cite: 1]
  * [cite\_start]Middleware proteksi di semua halaman kecuali `/login` [cite: 1]

##### 🤫 Data Sensitif

  * [cite\_start]Masking NIK pada tampilan publik / semi-publik [cite: 1]
  * [cite\_start]Log hanya menyimpan metadata (tanpa payload sensitif) [cite: 1]
  * [cite\_start]Akses ekspor data hanya untuk user berizin [cite: 1]

##### 📋 Audit Log

  * [cite\_start]Semua query penting dicatat: waktu, durasi, alias, dan bind yang disamarkan. [cite: 1]
  * [cite\_start]File log per hari: `logs/YYYY-MM/DD/log.txt` [cite: 1]

##### 🛡️ Header Keamanan

Disarankan melalui reverse proxy (Nginx/Traefik):

  * [cite\_start]`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` [cite: 1]
  * [cite\_start]`Content-Security-Policy: default-src 'self';` [cite: 1]
  * [cite\_start]`X-Frame-Options: SAMEORIGIN` [cite: 1]

#### 🛡️ Audit & Masking (Orisinal)

  * [cite\_start]**NIK:** dimasking `******####` pada UI umum; tampil penuh hanya untuk peran tertentu. [cite: 1]
  * [cite\_start]**Log:** menyingkat payload panjang & tidak menyimpan PII utuh. [cite: 1]
  * [cite\_start]**Export:** wajib mencatat jejak (siapa, kapan, filter apa). [cite: 1]

### 4.5 Kinerja, Observabilitas, dan Pengujian

Bagian ini mendefinisikan target kinerja non-fungsional dan metodologi pengujian yang digunakan untuk jaminan kualitas.

#### 🚀 Kinerja & Observabilitas (Orisinal)

##### 🎯 Target

| Metrik | Nilai |
| :--- | :--- |
| TTI | \< 2.5s |
| Median API | \< 250 ms |
| Error 5xx | \< 0.5% / minggu |
| Bounce rate turun | ≥ 30% |
| Aksi terarah naik | ≥ 20% / triwulan |
[cite\_start][cite: 1]

##### 🗺️ Strategi

  * [cite\_start]Lazy load, cache strategis, virtualized table. [cite: 1]
  * [cite\_start]Hindari N+1 query; gunakan join & paginasi efisien. [cite: 1]
  * [cite\_start]Gunakan `unstable_cache()` untuk data statis. [cite: 1]
  * [cite\_start]Stream data panjang agar tidak blocking. [cite: 1]

##### 🩺 Log & Health Check

  * [cite\_start]Struktur log harian: `logs/YYYY-MM/DD/log.txt`. [cite: 1]
  * [cite\_start]Jika gagal menulis log → fallback ke `stderr`. [cite: 1]
  * [cite\_start]Endpoint `/api/session/ping` untuk liveness & sliding session. [cite: 1]

#### 🧪 Pengujian & Kualitas (Orisinal)

##### 🔬 Jenis Pengujian

| Tipe | Fokus | Tools |
| :--- | :--- | :--- |
| Static Check | Lint & type safety | ESLint, TypeScript |
| Unit Test | Fungsi utilitas (log, session, builder menu) | Vitest / Jest |
| Integration | API Routes (login, menu, session) | Supertest |
| E2E | Alur login → dashboard → aksi | Playwright |
| Load Test | Endpoint kritikal (menu, KTP-el) | k6 / Artillery |
| A11y Test | Fokus, kontras, motion | axe-core |
[cite\_start][cite: 1]

[cite\_start]**Data uji:** gunakan dummy dataset; hindari PII riil dalam fixture. [cite: 1]

### 4.6 Pedoman Rilis dan Operasional (CI/CD)

Proses rilis diotomatisasi menggunakan *pipeline* CI/CD dan didukung oleh pedoman operasional yang jelas.

#### ⚙️ CI/CD, Release, & Operasional (Orisinal)

##### ✉️ Contoh `.gitlab-ci.yml`

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

[cite\_start][cite: 1]

##### 🏗️ Operasional

  * [cite\_start]Reverse proxy HTTPS (`X-Forwarded-Proto` diset). [cite: 1]
  * [cite\_start]Log rotation & permission ketat untuk `LOG_DIR`. [cite: 1]
  * [cite\_start]Monitoring: error rate, latensi median/p95, dan ukuran bundle Next.js. [cite: 1]
  * [cite\_start]Gunakan *Node 20+* dengan *Oracle Instant Client 19c+*. [cite: 1]

-----

## BAB V: KESIMPULAN DAN PENUTUP

Dokumen ini telah memaparkan secara komprehensif arsitektur dan strategi migrasi sistem Monalisa Monitoring. Kesimpulan dari pengembangan ini dirangkum dalam filosofi penutup berikut.

### 🏁 Penutup (Orisinal)

> “Web bukan sekadar alat kerja — ia adalah **refleksi etika pelayanan publik**.  
> Kecepatan bukan hanya soal milidetik, tapi tentang **bagaimana setiap klik memanusiakan data**.”
>
> — *Dian Septian, S.Tr.Kom., M.M.* \> Administrator Database Kependudukan Ahli Pertama  
> Disdukcapil Kota Bandung
> [cite\_start][cite: 1]

#### ⚖️ Lisensi & Kepemilikan (Orisinal)

[cite\_start]Hak cipta © 2025 **Dinas Kependudukan dan Pencatatan Sipil Kota Bandung**. [cite: 1]  
[cite\_start]Dibangun oleh **Dian Septian, S.Tr.Kom., M.M.** Segala kode sumber, dokumentasi, dan aset visual merupakan bagian dari inisiatif modernisasi internal *Monalisa Monitoring* Disdukcapil Bandung. [cite: 1]

> Distribusi ulang sebagian atau seluruh dokumen ini tanpa izin tertulis dilarang.  
> [cite\_start]Gunakan dengan integritas, dan kembangkan dengan semangat pelayanan publik yang bermartabat. [cite: 1]

-----

## DAFTAR PUSTAKA

Bagian ini merujuk pada sumber daya teknis eksternal yang digunakan dalam pengembangan.

### 📚 Referensi & Sumber Teknis (Orisinal)

  * [cite\_start]**Oracle DB Driver:** [https://oracle.github.io/node-oracledb/](https://oracle.github.io/node-oracledb/) [cite: 1]
  * [cite\_start]**Next.js Docs:** [https://nextjs.org/docs](https://nextjs.org/docs) [cite: 1]
  * [cite\_start]**Tailwind CSS Docs:** [https://tailwindcss.com/docs](https://tailwindcss.com/docs) [cite: 1]
  * [cite\_start]**Framer Motion:** [https://www.framer.com/motion/](https://www.framer.com/motion/) [cite: 1]
  * [cite\_start]**Shadcn/UI:** [https://ui.shadcn.com](https://ui.shadcn.com) [cite: 1]
  * [cite\_start]**Lucide Icons:** [https://lucide.dev/icons/](https://lucide.dev/icons/) [cite: 1]
  * [cite\_start]**Mermaid Diagrams:** [https://mermaid.js.org](https://mermaid.js.org) [cite: 1]
  * [cite\_start]**TypeScript ESLint Config:** [https://typescript-eslint.io/](https://typescript-eslint.io/) [cite: 1]

-----

## LAMPIRAN

Bagian ini berisi artefak teknis pendukung yang terperinci, termasuk catatan keputusan, rencana pemulihan, *runbook*, dan inventori modul.

### Lampiran A: Catatan Keputusan Arsitektur (ADR)

#### ⚖️ ADR — Architecture Decision Record (Orisinal)

| No | Keputusan | Alasan |
| :--- | :--- | :--- |
| **ADR-001** | Migrasi Laravel → Next.js 15 | Menghapus ketergantungan PHP/Apache, memperkuat SSR/CSR hybrid, dan memusatkan API. |
| **ADR-002** | Node-oracledb (bind variabel wajib) | Keamanan & kinerja: mencegah SQL injection, menekan parsing overhead. |
| **ADR-003** | Logging harian file-based | Jejak audit tidak tergantung DB; aman di mode read-only. |
| **ADR-004** | Theming Dual (Cyberpunk/Lux) | Dua konteks kerja: operasional cepat vs presentasi publik elegan. |
| **ADR-005** | Cookie HMAC auth | Stateless, mudah dipantau, bebas dependency eksternal (tanpa Redis). |
| **ADR-006** | Oracle alias map via `.env` | Multi-lingkungan (dev, staging, prod) tanpa ubah kode. |
| **ADR-007** | Next.js App Router (15) | Konsisten dengan arsitektur baru React & Turbopack build. |
| **ADR-008** | Logging structured per scope | Debug cepat; analisis tren error berdasarkan kategori. |
[cite\_start][cite: 1]

### Lampiran B: Rencana Pemulihan Bencana (DRP)

#### 🛡️ Disaster Recovery Plan (DRP) (Orisinal)

| Risiko | Dampak | Mitigasi |
| :--- | :--- | :--- |
| **Server crash / OS corrupt** | Layanan berhenti | Snapshot harian (Oracle & Node), auto-restore |
| **Kegagalan koneksi Oracle** | API timeout | Pool fallback → alias cadangan |
| **Kehilangan log** | Audit tidak utuh | Backup `logs/` mingguan ke NAS lokal |
| **Error build Next.js** | Front-end tidak aktif | Rollback otomatis build `.next/prev` |
| **Session rusak** | Logout massal | Middleware fallback → redirect login |
| **Load tinggi** | API delay | Auto-scale ringan (PM2 cluster / Docker) |
[cite\_start][cite: 1]

**Backup Policy:**

  * [cite\_start]**DB Oracle:** export dump harian (level schema) + retention 7 hari. [cite: 1]
  * [cite\_start]**Aplikasi:** backup `.next`, `logs`, `.env`, dan `data/menu`. [cite: 1]
  * [cite\_start]**Recovery Test:** dilakukan minimal 1x per kuartal. [cite: 1]

### Lampiran C: Runbook Operasional

#### 🏃 Runbook Operasional (Orisinal)

##### 1️⃣ 1. Login & Sesi

  * [cite\_start]File: `src/app/api/login/route.ts` [cite: 1]
  * [cite\_start]Validasi: MD5 (legacy) → Argon2 (migrasi). [cite: 1]
  * [cite\_start]Cookie `session_user` + `session_sig`, masa aktif 8 jam. [cite: 1]
  * [cite\_start]Middleware: `src/middleware.ts`. [cite: 1]

##### 2️⃣ 2. Dashboard

  * [cite\_start]File: `src/app/api/dashboard/route.ts` [cite: 1]
  * [cite\_start]Query Oracle (agregat harian/mingguan). [cite: 1]
  * [cite\_start]Metrik: KTP-el, DKB, Kelahiran, Kematian, dan WNI/WNA. [cite: 1]

##### 3️⃣ 3. Monitoring KTP-el

  * [cite\_start]File: `src/app/api/check/ktpel/route.ts` [cite: 1]
  * [cite\_start]Filter wilayah, tanggal; push ulang & ekspor CSV. [cite: 1]
  * [cite\_start]Pencatatan log ke `logs/YYYY-MM-DD/`. [cite: 1]

##### 4️⃣ 4. Chat / Messages

  * [cite\_start]File: `src/app/api/messages/route.ts` [cite: 1]
  * [cite\_start]Optimistic update (local → confirm). [cite: 1]
  * [cite\_start]Interval polling: 5–10 detik. [cite: 1]
  * [cite\_start]Struktur pesan: `{ id, sender, receiver, text, has_img, created_at }`. [cite: 1]

##### 5️⃣ 5. Master Data

  * [cite\_start]Folder: `src/app/api/master/*` [cite: 1]
  * [cite\_start]Submodul: List, Request, Absensi, Contact, Salaman, TTE. [cite: 1]
  * [cite\_start]Semua dengan pagination dan filter Oracle efisien. [cite: 1]

##### 6️⃣ 6. Aktivitas

  * [cite\_start]Folder: `src/app/api/activity/*` [cite: 1]
  * [cite\_start]Simpan semua aksi user sebagai log audit JSON. [cite: 1]
  * [cite\_start]Kolom: USER\_ID, ACTION, META\_JSON, CREATED\_AT. [cite: 1]

##### 7️⃣ 7. Setting

  * [cite\_start]Folder: `src/app/api/setting/*` [cite: 1]
  * [cite\_start]ACL berbasis level user; cache & prefetch untuk Sidebar. [cite: 1]
  * [cite\_start]Menu auto-build berdasarkan VW\_SIAK\_MENU. [cite: 1]

### Lampiran D: Inventori Modul Legacy Tambahan

#### 🗂️ Inventori Menu Tambahan (dari Legacy Excel) (Orisinal)

> Berikut daftar menu tambahan yang sebelumnya belum tercantum dalam README lama.
> Semua dikelompokkan berdasarkan Level-1 menu.
> [cite\_start]Ikon mengikuti standar `mdi` dan `ti` class sesuai file Excel lama. [cite: 1]

##### **Dashboard**

  * **User KTP-EL** — `Dashboard/Userktp`
      * Dashboard KTP-el, Biodata, Mobilitas
  * **Dashboard Capil** — `Dashboard/Capil`
  * **Dashboard Kemarin** — `Dashboard/demogh`
  * **User Perekaman** — `Dashboard/Userrekam`
    [cite\_start][cite: 1]

##### **Aktivitas**

  * **Rekap Aktivitas Siak** — `ActivityRekap`
  * **Aktivitas KK** — `KK/Rekap`, `KK/Detail`, `KK/Bulanan`
  * **Aktivitas Kedatangan** — `ActivityKedatangan`
    [cite\_start][cite: 1]

##### **Master Menu**

  * Master Activity, List, Request, Absensi, Contact, Pemanfaatan Data, Salaman, TTE (KK, Kelahiran, Kematian, dst),
  * Layanan Online (`Master/Salaman`), Kehadiran (`Master/Absensi`), dan E-Kedatangan (`Master/EpuntenDatang`).
    [cite\_start][cite: 1]

##### **Laporan**

  * [cite\_start]**Dafduk:** laporan perekaman, cetak, suket, KK, biodata, KIA, pindah/datang antar wilayah, identitas tunggal, blangko e-KTP, TTE KK, Petugas Khusus, dll. [cite: 1]
  * [cite\_start]**Capil:** akta kelahiran/kematian/perkawinan/perceraian, pengakuan anak, pembetulan akta, konversi WNI-WNA, dan TTE akta. [cite: 1]
  * [cite\_start]**Bulanan:** laporan periodik rekam-cetak-KK-KIA. [cite: 1]
  * [cite\_start]**DKB:** statistik, cakupan, usia DKB. [cite: 1]
  * [cite\_start]**Piak:** software, hardware, jaringan, utility, hak akses SIAK/BCARD/BENROLL, dan warehouse PDIP. [cite: 1]
  * [cite\_start]**Aparatur:** pejabat struktural, fungsional, aset, inovasi, nomenklatur. [cite: 1]
  * [cite\_start]**Sarana & Prasarana:** realisasi dana, blangko, barang Pemda/Capil. [cite: 1]
  * [cite\_start]**BNBA:** mutasi keluar/masuk, akta kelahiran/kematian, rekap LAMPID. [cite: 1]

##### **Checking Dafduk**

  * [cite\_start]Status KTP-EL, histori cetak, duplicate local, PRR list, KIA, KK, Akta, Petugas Khusus, Lintas Batas, SKTS, WNA, dan KIA Balita. [cite: 1]
  * [cite\_start]Semua endpoint lama (mis. `Check/Rekam`, `Check/Cetak`, `Check/Failure`) disusun ulang dalam `/api/check/*`. [cite: 1]

##### **Request E-KTP**

  * [cite\_start]Request perpindahan, suket, cetak ulang (hilang/rusak), serta form kehilangan (`InputKehilangan`). [cite: 1]
  * [cite\_start]Struktur baru menggunakan `/api/request/*` dengan validasi binding Oracle. [cite: 1]

##### **Kendali E-KTP**

  * [cite\_start]Blangko masuk/keluar, distribusi aset, pencetakan dinas, dan rekap ludo (input-rekap cetak). [cite: 1]

##### **Antrian & Helpdesk**

  * [cite\_start]Monitoring antrian, pengecekan kepemilikan akta, biodata hilang, penyesuaian NIK, perbaikan biometrik/data. [cite: 1]
  * [cite\_start]Rute modernisasi: `/api/helpdesk/*` dengan payload JSON terstruktur. [cite: 1]

##### **Setting**

  * [cite\_start]Monitoring user, level, helpdesk, pejabat, menu, dan master kill. [cite: 1]
  * [cite\_start]Semua kini terpusat di `/api/setting/*` dengan ACL dan caching. [cite: 1]

### Lampiran E: Implementasi Seeder Menu

#### 🗂️ Menu Master dari Excel (JSON & Integrasi) (Orisinal)

[cite\_start]**Sumber:** `Menu Monitoring.xlsx` → dinormalisasi ke **tree JSON** → `menu.normalized.json` [cite: 1]  
[cite\_start]**Lokasi:** `data/menu/menu.normalized.json` (repo) atau sementara di `.env` via `MENU_JSON_PATH` untuk mode dev. [cite: 1]

##### 🏗️ Integrasi `/api/menu` (Fallback Dev)

```ts
// FILE: src/app/api/menu/route.ts (fallback DEV)
import fs from "fs"; import path from "path";
export async function GET() {
  const menuJsonPath = process.env.MENU_JSON_PATH;
  if (process.env.NODE_ENV !== "production" && menuJsonPath) {
    const json = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), menuJsonPath), "utf-8"));
    return Response.json({ success: true, data: { items: json.items } });
  }
  // TODO: production → query Oracle (APP_MENU / VW_SIAK_MENU)
}
```

[cite\_start][cite: 1]

##### 🧾 Schema Oracle (Seed)

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

[cite\_start][cite: 1]

##### 🌱 Seeder Node

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

[cite\_start][cite: 1]

### Lampiran F: Dokumentasi Tambahan (Lampiran Modernisasi Lengkap)

#### 📦 Lampiran Modernisasi Lengkap (Orisinal)

[cite\_start]*(Tambahan dokumentasi komprehensif – konten asli di atas tetap dipertahankan utuh sesuai permintaan.)* [cite: 1]

##### 🧱 Tumpukan Teknis & Arsitektur Singkat

| Lapisan | Rekomendasi Implementasi |
| :--- | :--- |
| Framework | Next.js 15 App Router, React 19, TypeScript 5 |
| Styling | Tailwind CSS 3, modul CSS kustom (`src/styles/**`), tema gelap/terang |
| UI Kit & Ikon | MUI 7, Radix Select, Lucide, komponen neon internal |
| Data Grid & Visual | DataTables 2 (+Buttons/Responsive), Grid.js, MUI X DataGrid, Chart.js 4 + react-chartjs-2 |
| Animasi | Framer Motion 12 |
| Backend | Next.js API Routes (runtime Node.js), `src/lib/db.ts` + `src/lib/oracle.ts` |
| Database | Oracle SIAK (multi-alias pool, Instant Client 21+) |
| Logging | `src/lib/log.ts` → `logs/YYYY-MM/DD/log.txt` (JSON ringkas) |
| Auth | Cookie HMAC (`session_user` + `session_sig`), middleware halaman & API |
| Build | Turbopack (`npm run dev/build/start`) |
[cite\_start][cite: 1]

##### 🏗️ Arsitektur Solusi (Rekap)

  * [cite\_start]**App Shell**: `src/app/layout.tsx` memuat semua stylesheet global, script preferensi tema, dan membungkus anak melalui `ResponsiveAppShell` + `Sidebar` + `Topbar`. [cite: 1]
  * [cite\_start]**Middleware**: `src/middleware.ts` (routing halaman) dan `src/middleware.api.ts` (proteksi semua `/api/*`). [cite: 1]
  * **Pool Oracle**: `src/lib/oracle.ts` menyimpan cache pool global per alias (`DB`, `DB222`, `DB5CETAK`, dst). [cite\_start]Helper `execRows/execOne/execDml` di `src/lib/db.ts` otomatis logging ringkas. [cite: 1]
  * [cite\_start]**Session**: `src/lib/session.ts` mengelola encoding JSON + HMAC, sliding refresh, dan audit login/logout. [cite: 1]
  * [cite\_start]**Audit**: Semua endpoint penting menulis log melalui `Log.info/warn/error` untuk memudahkan penelusuran. [cite: 1]

##### 🚀 Memulai (Setup Developer)

1.  [cite\_start]**Prasyarat**: Node.js 20+, npm 10+, Oracle Instant Client 21+ (set PATH/LD\_LIBRARY\_PATH sesuai OS). [cite: 1]
2.  **Instalasi**:
    ```bash
    npm install
    npm run dev
    ```
    [cite\_start][cite: 1]
3.  [cite\_start]**Build Produksi**: `npm run build && npm run start`. [cite: 1]
4.  [cite\_start]**Lingkungan**: duplikasi `.env.local` → `.env.local.example` sebelum berbagi repo. [cite: 1]

##### 🔑 Variabel Lingkungan (Ringkasan)

  * [cite\_start]`APP_*`, `SESSION_*`, `LOG_DIR`: identitas app & sesi. [cite: 1]
  * [cite\_start]Alias Oracle mengikuti pola `<ALIAS>_{USERNAME,PASSWORD,CONN}` – contoh `DB222_USERNAME`, `DB222_CONN`, dll. [cite: 1]
  * [cite\_start]Integrasi opsional: Redis (`REDIS_HOST/PORT`), Pusher, FCM, AWS, Socket (`SOCKET_URL`). [cite: 1]
  * [cite\_start]Modul KTP-el mendukung override melalui `KTPEL_*` (alias master, wilayah default, push target). [cite: 1]

##### 📁 Struktur Direktori (Highlight)

```
src/
├─ app/              # App Router, halaman, API Routes
├─ components/       # Layout shell, dashboard widgets, tabel, UI util
├─ contexts/         # SessionProvider (user + unread chat)
├─ hooks/            # useDashboard*, useMaster*, useNotrecordOptions, dst
├─ lib/              # db/oracle/http/session/auth/log utilities
├─ styles/           # tokens, theme dark/light, modul komponen
├─ middleware(.api).ts
└─ styles/components/ (sidebar, topbar, tables, forms, toast, dll)
```

[cite\_start][cite: 1]

##### 📊 Modul Aplikasi (Ikhtisar)

  * **Dashboard**: `src/app/dashboard/**` menampilkan metrik KTP-el, capaian, DKB, penduduk efektif, geulis/non-geulis. [cite\_start]Hooks utama `useDashboardData`, `useCapaian`, `usePopulation`, dll. [cite: 1]
  * [cite\_start]**Monitoring Check**: `src/app/check/**` mencakup KTP-el (mode rekam/hist/wktp), duplicate, PRR/SFE, cetak, akta, not-record (DAPODIK), rekam historis. [cite: 1]
  * **Master Data**: `src/app/master/**` (list, request, absensi, contact, salaman). [cite\_start]Hooks `useMaster*` menstandardisasi fetch + state loading. [cite: 1]
  * [cite\_start]**Chat & Messages**: `src/app/chat/page.tsx` + `/api/chat/*` + `/api/messages/*`, dengan polling unread setiap 15 menit dari `SessionProvider`. [cite: 1]
  * [cite\_start]**Activity & Audit**: `src/app/Activity/setting/page.tsx`, endpoint `/api/activity/do_save` untuk mencatat aksi. [cite: 1]
  * [cite\_start]**Pengaturan**: `src/app/setting/**` memproses user level, penambahan user, pemetaan grup via `/api/setting/*`. [cite: 1]
  * [cite\_start]**Template Playground**: `src/app/template/**` sebagai kerangka cepat modul baru. [cite: 1]
  * [cite\_start]**Login**: `src/app/login/LoginClient.tsx` → `/api/login` (MD5 legacy + bypass dev + pembaruan `SIAK_SESSION_PLUS`). [cite: 1]

##### 🔌 Permukaan API (Kategorisasi Cepat)

  * [cite\_start]**Auth & Session**: `/api/login`, `/api/logout`, `/api/session`, `/api/session/{ping,verify}`, `/api/account/password`. [cite: 1]
  * [cite\_start]**Dashboard**: `/api/dashboard/m1..m8`, `/api/dashboard/time`, `/api/dashboard/capaian`, `/api/dashboard/user{ktp,rekam}/*`, dsb. [cite: 1]
  * [cite\_start]**Monitoring**: `/api/check/ktpel`, `/api/check/ktpel/{meta,push,kabupaten,kecamatan,kelurahan}`, `/api/check/{duplicate,notrecord,prr,sfe,failure,akte}`. [cite: 1]
  * [cite\_start]**Master & Activity**: `/api/master/{list,request,absensi,contact,salaman}`, `/api/activity/do_save`. [cite: 1]
  * [cite\_start]**Chat & Pesan**: `/api/chat/{contacts,messages,send}`, `/api/messages/{previews,unread}`. [cite: 1]
  * [cite\_start]**Pengaturan**: `/api/setting/{get_user_level,check_lvl,save_lvl,get_group}`, `/api/menu`, `/api/user`. [cite: 1]

##### 🧬 Lapisan Data & Logging

  * [cite\_start]Pool Oracle di-cache global → hindari recreate saat hot reload. [cite: 1]
  * [cite\_start]Helper `summarizeSql` memangkas query \> 800 karakter pada log. [cite: 1]
  * [cite\_start]Log disimpan per hari (folder `logs/YYYY-MM/DD`), format JSON 1 baris/entry, payload dibatasi 4000 karakter. [cite: 1]

##### 🎨 Sistem Desain & Aset

  * [cite\_start]Token warna & tipografi di `src/styles/tokens.css`. [cite: 1]
  * [cite\_start]Tema gelap `theme-dark.css` (Neon Cyberpunk), tema terang `theme-light.css` (Elegant Lux). [cite: 1]
  * [cite\_start]Modul CSS komponen: `styles/components/{sidebar,topbar,tables,forms,modal,toast,...}.css`. [cite: 1]
  * [cite\_start]DataTables override: `datatable-{dark,light,cyberpunk}.css`. [cite: 1]
  * [cite\_start]Aset statis: `public/assets/` (logo, ikon, plugin), executable `public/app/KTPel_x.exe`. [cite: 1]

##### 🧪 Kualitas & Operasional

  * [cite\_start]**Lint & Types**: `npx prettier -c .`, `npm run lint`, `tsc --noEmit`. [cite: 1]
  * [cite\_start]**Pengujian**: siapkan Vitest/Jest untuk util, Supertest untuk API, Playwright untuk alur penting. [cite: 1]
  * [cite\_start]**Deploy**: Node 20+, Instant Client tersedia, `LOG_DIR` writable, reverse proxy serahkan header `X-Forwarded-*`. [cite: 1]
  * [cite\_start]**Monitoring**: pantau `tookMs` di log, error rate, latensi median/p95, ukuran bundle Next.js. [cite: 1]

##### 🛡️ Roadmap & Operasi Tambahan

  * [cite\_start]**Tahap I–II** (selesai): modernisasi inti, chat, activity log, dashboard supervisor, latency monitor. [cite: 1]
  * [cite\_start]**Tahap III** (berjalan): integrasi E-Punten API, BSrE TTE, rekonsiliasi DEMOGRAPHICS vs FINGERS, scheduler rekap otomatis. [cite: 1]
  * [cite\_start]**Tahap IV** (rencana): deteksi anomali, narasi otomatis, voice assistant eksperimen. [cite: 1]
  * [cite\_start]**DRP Singkat**: backup schema Oracle harian, salin `.next`, `.env`, `logs`, `data/menu`; uji restore kuartalan; siapkan fallback alias jika koneksi utama gagal. [cite: 1]

##### 📚 Lampiran Teknis (Ringkas)

  * [cite\_start]**Lampiran A** – Matriks environment & alias Oracle. [cite: 1]
  * [cite\_start]**Lampiran B** – Peta alias vs modul (DB, DB222, DB5CETAK, WEBDB, DBSMS, EPUNTEN, dsb). [cite: 1]
  * [cite\_start]**Lampiran C** – Daftar library UI/data (Next.js, Tailwind, DataTables, Grid.js, Chart.js, Framer Motion, Radix, Lucide, date-fns, react-date-range, jszip, pdfmake, oracledb). [cite: 1]
  * [cite\_start]**Lampiran D** – ADR, DRP, & Playbook Ringkas. [cite: 1]

> 💡 *Gunakan lampiran ini sebagai pendamping dokumentasi utama di atas. [cite\_start]Seluruh isi tambahan disusun untuk melengkapi, bukan menggantikan, narasi README asli.* [cite: 1]

##### Lampiran A – Matriks Environment (Detil)

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
[cite\_start][cite: 1]

##### Lampiran B – Peta Alias Oracle & Penggunaan

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
[cite\_start][cite: 1]

##### Lampiran C – Library UI & Data

  * [cite\_start]**Next.js 15**, **React 19**, **TypeScript 5** [cite: 1]
  * [cite\_start]**Tailwind CSS 3**, modul CSS custom, **Framer Motion 12** [cite: 1]
  * [cite\_start]**MUI 7**, **Radix UI Select**, **Lucide React** ikon [cite: 1]
  * [cite\_start]**DataTables.net 2** (+Buttons, Responsive), **Grid.js**, **MUI X DataGrid** [cite: 1]
  * [cite\_start]**Chart.js 4** + **react-chartjs-2**, **chroma-js** [cite: 1]
  * [cite\_start]**date-fns**, **react-date-range** [cite: 1]
  * [cite\_start]**jszip**, **pdfmake** (ekspor DataTables) [cite: 1]
  * [cite\_start]**oracledb 6.9**, **node-oracledb Instant Client 21** [cite: 1]
  * [cite\_start]**prettier**, **eslint-config-next**, **prettier-plugin-tailwindcss** [cite: 1]

##### Lampiran D – ADR, DRP, & Playbook Ringkas

  * **ADR-001 s.d. [cite\_start]ADR-008**: migrasi ke Next.js, penggunaan node-oracledb, logging harian, theming dual, cookie HMAC, konfigurasi alias, App Router, logging terstruktur. [cite: 1]
  * [cite\_start]**DRP**: snapshot schema Oracle harian, backup `logs/`, `.env`, `.next`, `data/menu`; uji restore kuartalan; siapkan fallback alias jika koneksi utama gagal. [cite: 1]
  * [cite\_start]**Runbook**: login/session (`/api/login`), dashboard (`/api/dashboard/*`), monitoring KTP-el (`/api/check/ktpel/*`), chat/messages (`/api/chat/*`, `/api/messages/*`), master (`/api/master/*`), setting (`/api/setting/*`). [cite: 1]