# Klasemen IKD — MONALISA

Modul tersedia di `/pdak/ikd/ranking`, dengan profil `/pdak/ikd/ranking/region/[kode]`. Menu **Klasemen IKD**, ID **376**, memakai izin **TEAM IT (5)** sebagaimana menu PDAK sebelumnya. Tidak ada tabel ranking tambahan, perubahan `.env`, perubahan helper Oracle/HTTP/session inti, atau modifikasi snapshot lama.

## Sumber dan integrasi

Seluruh ranking berasal dari `PDAK_IKD` pada alias pool **DB**, koneksi MONALISA biasa. Kolom sumber: KODE, WILAYAH, REKAM_DINAMIS, JUMLAH_IKD, PERSEN_IKD, TANGGAL_ENTRY. Repository menggunakan `withPdakConnection` yang memverifikasi metadata/constraints, dan `loadRegionMaster` untuk 182 kode referensi. Data baru dari Upload PDAK langsung tersedia pada request ranking berikutnya; tombol Refresh mengambil data tanpa cache. Tidak ada job terpisah atau nilai ranking manual.

Tanggal B default adalah snapshot terbaru yang benar-benar tersimpan. A default adalah snapshot lengkap terakhir sebelum B. Snapshot tidak lengkap tetap terlihat dalam pilihan tanggal, bukan disembunyikan. Jika hanya satu snapshot atau pengguna memilih tanpa pembanding, ranking B tetap ditampilkan dan metrik perubahan N/A.

Inspirasi presentasi: [FIFA Men's World Ranking](https://inside.fifa.com/fifa-rankings/world-ranking/men). Modul mengadaptasi penyajian peringkat, pergerakan dan histori; tidak menggunakan formula poin sepak bola atau aset/logo FIFA.

## Metodologi

- Kecamatan (30) dan kelurahan (151) merupakan kompetisi terpisah. Kota tidak diranking, dan agregat kota dibaca dari satu baris kota, bukan penjumlahan hierarki.
- Ranking utama memakai **PERSEN_IKD tersimpan**. Nilai seri memakai competition rank `1, 1, 3`; urutan tampilan KODE hanya untuk stabilitas dan tidak memecahkan nilai seri. Tie rule ini ditetapkan secara eksplisit karena konsep awal belum menentukan aturan seri.
- Join perbandingan selalu KODE; perubahan nama atau urutan file tidak mengubah identitas wilayah. Kode tak dikenal tidak ikut ranking.
- Delta Rank = rank A − rank B; positif naik, negatif turun. Delta IKD = IKD B − IKD A. Coverage Improvement = persentase B − A, dalam **percentage point** dan dibulatkan pada presisi Oracle 4 desimal sebelum menentukan nilai seri.
- Growth = Delta IKD / IKD A × 100%, hanya ketika IKD A > 0. A=0 menampilkan New Baseline dan growth NULL, tidak Infinity atau persentase buatan.
- Velocity = Delta IKD / selisih hari kalender A/B. Tanggal tersebut adalah tanggal **upload WIB**; nilai ini adalah rata-rata selisih snapshot, bukan log aktivasi harian. TANGGAL_DATA belum ditambahkan dan merupakan pengembangan metadata berikutnya.
- Nilai penurunan aktivasi tetap ditampilkan; dapat mencerminkan koreksi/nonaktif, bukan bukti kinerja negatif. Penghargaan positif memerlukan nilai positif; tidak memilih pemenang nol/negatif secara sewenang-wenang.

## Liga dan kualitas

Small ≤10.000, Medium 10.001–14.999, Large ≥15.000 rekam dinamis. Nilai NULL/tidak valid memakai Unknown. Liga hanya berlaku pada kelurahan.

Kelompok ukuran ditetapkan dari B. **League Rank A dan B dihitung ulang terhadap cohort kode yang sama pada B**, termasuk ketika wilayah berpindah ukuran. Overall Rank tetap dari semua kelurahan. Filtering liga/search atau pagination tidak mengubah Overall Rank. UI memberi tanda berpindah liga.

Snapshot lengkap memerlukan 182 kode unik tepat sesuai master, komposisi 1/30/151 dan persentase valid 0–100. Perbandingan peringkat serta penghargaan periode memerlukan A/B lengkap dan A < B. Jika tidak lengkap, ranking B yang dapat dibaca diberi status sementara, perubahan ranking NULL, penghargaan perbandingan dinonaktifkan. Delta aktivasi/capaian yang masih tersedia hanya untuk kode yang benar-benar berpasangan dan disertai peringatan. Profil hanya memakai snapshot lengkap untuk rekor dan rata-rata ranking; point parsial tetap N/A, sedangkan pergerakan memakai snapshot lengkap sebelumnya dengan tanggal pasangan ditampilkan. Rekor climb/fall N/A bila belum tersedia dua snapshot lengkap.

## Tampilan

Panel mengikuti tema/token MONALISA, `PdakAppShell`, `SelectDark`, tombol dan radius yang sama dengan Upload/Data PDAK. Ada tab kecamatan/kelurahan, pilihan A/B, filter liga, pencarian, sorting per metrik, pagination 20 wilayah, dan tujuh kartu: Top Ranked, Biggest Climber, Most IKD Added, Biggest Growth, Biggest Drop, Most Improved Coverage, Daily Activation Velocity. Semua pemenang seri tersedia di API; kartu menampilkan dua nama dan jumlah wilayah seri lainnya. Nama pada kartu dapat membuka profil, termasuk pemenang di luar Top 20.

Profil menyediakan current/previous rank dengan tanggalnya, highest/lowest/average rank, biggest climb/fall, aktivasi/capaian terakhir, grafik ranking (nomor 1 di atas), grafik persentase dan histori berhalaman. Rekor menggunakan seluruh tanggal yang tersedia hingga cutoff B, bukan hanya dua tanggal yang dipilih. Average Rank adalah rata-rata per snapshot valid tanpa bobot hari.

## API

Semua endpoint nodejs/force-dynamic, signed session, izin `VW_SIAK_MENU` untuk `pdak/ikd/ranking`, envelope HTTP proyek, audit Log dan `Cache-Control: no-store`.

| GET endpoint | Parameter / hasil |
| --- | --- |
| `/api/pdak/ikd/snapshots` | Seluruh tanggal, jumlah row, status lengkap |
| `/api/pdak/ikd/ranking` | `level=village|district`, `league=ALL|SMALL|MEDIUM|LARGE|UNKNOWN`, `a`, `b`; ranking dan highlights |
| `/api/pdak/ikd/movement` | Parameter sama; diurutkan perubahan rank terbesar |
| `/api/pdak/ikd/highlights` | Tujuh penghargaan, seluruh wilayah seri |
| `/api/pdak/ikd/stats` | Agregat kota, tren pada interval, kualitas A/B |
| `/api/pdak/ikd/region/[kode]` | `end=YYYY-MM-DD` opsional; seluruh histori profil hingga cutoff |

`a=none` meminta tanpa baseline. Semua tanggal divalidasi dan dibind; A>=B ditolak. Liga non-ALL pada kecamatan ditolak. Kode profil hanya kecamatan/kelurahan yang terdaftar. Error tidak menampilkan SQL, kredensial atau stack.

## SQL dan pengujian

SQL ada di `src/lib/pdak/ikd/repository.ts`. Metadata memvalidasi referensi dengan bind kode; dua snapshot dipilih memakai binds tanggal. Profil memakai `RANK() OVER (PARTITION BY TANGGAL_ENTRY, REGEXP_COUNT(KODE,'[.]') ORDER BY PERSEN_IKD DESC)` dalam CTE. **Filter kode profil berada sesudah perhitungan ranking**, sehingga profil tidak menjadi rank 1 karena difilter terlalu awal. Ranking perbandingan/cohort memakai engine TypeScript murni yang diuji terhadap hasil RANK Oracle.

```powershell
npm.cmd run test:pdak
npm.cmd run lint:pdak
npm.cmd run typecheck
npm.cmd run build
node --conditions=react-server scripts/ikd-live-check.cjs
```

`ikd-live-check.cjs` memasukkan dua snapshot sementara tanggal 1900-01-01 / 1900-01-08 dan satu snapshot parsial, menguji metadata, 30/151 peserta, delta, profil Oracle, dan blokir perubahan pada snapshot parsial. Semua row dan marker di-rollback; identity sequence dapat maju sebagai perilaku normal Oracle. Tidak ada commit data uji atau DDL. Skrip berhenti aman bila slot uji sudah terisi.

`ikd-ui-check.cjs` memakai server localhost:3314. Pertama menguji enam endpoint Oracle asli, penolakan anonymous dan level tanpa izin. Kemudian browser memakai fixture visual sintetis untuk UI level, liga, search, baseline, profil, sumbu ranking dan mobile; fixture tidak pernah disimpan ke Oracle dan request upload diblokir dalam test browser. Screenshot di `logs/ikd-ui/` bukan bukti nilai ranking produksi. Angka contoh Kebon Jeruk/Rancanumpang/Jatihandap dalam konsep tidak di-hardcode.

Seeder idempotent: `node scripts/pdak-seed-menu.cjs 5 --apply --ranking` (sudah dijalankan). Menu Upload/Data yang sudah ada dipertahankan; tidak mengubah hierarchy lama. Cache sidebar 300 detik; halaman dapat dibuka langsung setelah login TEAM IT. Pembentukan parent PDAK terpadu dapat dilakukan melalui pengelolaan menu bila dibutuhkan.

File utama: `src/lib/pdak/ikd/{analytics,repository,api}.ts`, enam API route IKD, halaman ranking/profil, `src/components/pdak/ikd/{IkdRankingPage,IkdRegionPage,HistoryChart,format}`, stylesheet PDAK, akses menu, seeder, test analitik dan CLI verifikasi. Tidak ada dependency baru.

## Hasil verifikasi 13 Oktober 2026

59 pengujian lulus; lint PDAK dan TypeScript lulus; production build exit 0. Verifikasi Oracle asli lulus untuk ranking, perbandingan, profil dan snapshot parsial; seluruh data/marker uji sudah di-rollback. Pemeriksaan browser production lulus untuk enam API, akses 401/403, filter, liga, profil, grafik ranking dan desktop/mobile; fixture visual tidak disimpan ke database. Server verifikasi lokal telah dihentikan. Tidak dilakukan deploy.
