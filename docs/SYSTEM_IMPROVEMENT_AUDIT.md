# Audit dan perbaikan MONALISA — 13 Oktober 2026

Branch: `improvement/dashboard-inventory-20261013`. Audit source dilakukan sebelum refactor. Perubahan terdahulu dan file core dilindungi dipertahankan. Tidak ada DDL, deploy atau push.

## Temuan awal terverifikasi

| ID | Prioritas | Evidence source awal | Masalah dan keputusan |
|---|---|---|---|
| DASH-001 | High | `api/dashboard/capaian/route.ts`: SELECT SET_DASHBOARD; `useCapaian.ts`: label 0–17 | Realisasi manual tertinggal dari upload. Baca baris kota terbaru per dataset PDAK di DB, Akta 0–4. Target konfigurasi tetap dipakai. Missing snapshot menjadi N/A. |
| BAR-001 | Critical | `api/barang/master/route.ts`: tiga DELETE memakai execDml | Penghapusan master menghapus histori dengan commit terpisah. Tolak penghapusan barang yang sudah bertransaksi. |
| BAR-002 | High | `api/barang/{master,masuk,keluar,aset}`: sesi saja | Izin server harus mengikuti URL menu aktif aktual pada VW_SIAK_MENU. Alias data lama Barang dipertahankan; izin di DB. |
| BAR-003 | High | `api/barang/{masuk,keluar}`: MAX+1 terpisah, `if (!jumlah)` | Race ID, stok negatif, kuantitas negatif diterima. Validasi bilangan positif dan transaksi dengan urutan lock tetap. |
| BAR-004 | High | `api/barang/{masuk,keluar}`: UPDATE CREATED_BY/CREATED_DT | Edit mengubah tanggal histori laporan. Pertahankan pencipta/tanggal asli, log perubahan before/after. |
| BAR-005 | High | `api/barang/cekaset`: re-export status barang | Status aset menampilkan sumber barang habis pakai. Gunakan transaksi wilayah aktual SIAK_MONEV_WILAYAH untuk aset wilayah. |
| BAR-006 | Medium | `api/barang/{laporan,laporanaset}`: split('-') | Rentang DD-MM-YYYY mengandung delimiter yang sama; tanggal mustahil tidak divalidasi. Parser ketat menerima kedua format dan rentang legacy. |
| BAR-007 | High | `barang/master/page.tsx`: handler event dipasang saat init, rows closure | Tombol edit bisa memakai state lama. React-controlled table menghapus handler DOM imperatif dan render HTML data mentah. |
| BAR-008 | Medium | `barang/*`: styling hex/glow, form selalu terbuka, tabel min-width900 | Workspace konsisten: header ringkas, navigasi kelompok, ringkasan, pencarian, filter, tabel paged, dialog form/detail. |
| BAR-009 | Medium | `barang/aset`: kategori1–5; `aset-options`: SECT6 | Referensi aset laporan SECT6 tidak tersedia pada form master. Tambahkan kategori6 sesuai sumber aktual. |
| SYS-001 | Critical | `api/login/route.ts`: password cocok hash ATAU literal | Universal password bypass harus dihapus; hash MD5 legacy dipertahankan untuk kompatibilitas akun. Error DB tidak dikirim ke client. |
| SYS-002 | Medium | `ResponsiveAppShell`: header fixed, main tanpa ukuran header aktual | Konten terhalang pada mobile ketika header membungkus. Ukur header dengan ResizeObserver dan gunakan offset yang sama pada main/sidebar. |

## Rancangan dan trade-off

Single page untuk seluruh domain terlalu padat; tab tunggal menyulitkan link menu lama; drawer cukup untuk detail singkat tetapi tidak untuk laporan panjang. Dipilih workspace operasional dengan route lama tetap hidup, navigasi kelompok, tabel utama dan dialog form/detail. Laporan tetap halaman sendiri. React table hanya diterapkan pada Barang: lifecycle event, XSS dan paging dapat dikendalikan tanpa migrasi global DataTables.

Aliran: page tipis → komponen Barang → fetch abortable → API envelope existing → izin menu → repository → Oracle. Database Barang memakai konfigurasi alias existing. PDAK memakai DB MONALISA. Tidak menambah model stok/lokasi/serial yang belum ada di skema.

Metadata Oracle diperiksa read-only: master barang panjang50/20/200; penerima50; catatan transaksi300; master aset150; transaksi wilayah mempunyai NO_KEC/JENIS_BARANG/KATEGORI. `InputAset` lama sebenarnya menulis master barang; kompatibilitas ini dijelaskan pada UI, tidak diklaim sebagai pencatatan aset individual.

## Sebelum dan sesudah

| Aspek | Sebelum | Sesudah yang dituju | Dampak |
|---|---|---|---|
| Data capaian | angka manual, 0–17 | snapshot PDAK, tanggal sumber, 0–4 | angka dapat ditelusuri |
| Layout Barang | glow/form/tabel berulang | workspace tematik ringkas | tindakan lebih mudah ditemukan |
| Tabel | HTML/event imperatif | React, sorting, paging, status, ekspor | state dan escaping terkendali |
| Form | selalu terbuka, validasi tidak selaras | dialog berlabel, validasi, dirty guard | mencegah salah input |
| API | sesi saja, error DB mentah | izin menu, origin guard, error aman | akses dibatasi sesuai konfigurasi |
| Stok | DML terpisah tanpa saldo check | transaksi, locks, saldo check | mencegah saldo rusak |

## Batas audit

Audit menyeluruh berarti memetakan seluruh source dan risiko lintas modul; tidak berarti setiap workflow pada 500+ file sudah diuji manual atau seluruh risiko legacy otomatis hilang. Temuan lanjutan dan hasil pengujian aktual dicatat setelah implementasi. Target latensi/TTI hanya diklaim bila ada pengukuran.
