# Checklist Implementasi Resi (Desain + SVG)

Dokumen ini untuk memastikan hasil resi cetak mendekati kualitas referensi: rapi, profesional, dan stabil saat print A4.

## 1) Output yang harus dicapai

- 2 kupon per halaman A4 (UNTUK MASYARAKAT dan UNTUK PETUGAS).
- Hierarki informasi jelas: Header -> Judul -> Nomor Registrasi -> Identitas/Alamat/Detail -> Verifikasi QR -> Footer.
- Semua teks penting terbaca pada printer hitam-putih.
- Tidak ada teks terpotong saat print skala 100%.

## 2) Struktur folder aset yang disarankan

Simpan semua aset resi di:

- public/assets/plugins/images/receipt/

Isi minimal:

- header-resi.svg
- header-resi.png (fallback)
- watermark-resi.svg
- watermark-resi.png (fallback)
- icon-user.svg
- icon-map.svg
- icon-clipboard.svg
- icon-shield.svg
- icon-calendar.svg
- icon-clock.svg
- icon-phone.svg
- icon-fax.svg
- icon-mail.svg
- icon-globe.svg

Catatan:
- Jika icon tetap inline SVG di kode, file icon terpisah tidak wajib.
- Untuk watermark, prioritaskan SVG supaya tajam saat print.

## 3) Spesifikasi desain (untuk tim desain)

- Artboard: A4 portrait.
- Margin print: 5 mm.
- 2 blok kupon tinggi seimbang + garis potong di tengah.
- Gaya tipografi:
  - Judul utama: Bold/Semibold.
  - Label tabel: Semibold.
  - Nilai tabel: Regular.
  - Hindari semua elemen menjadi bold.
- Kontras hitam-putih harus tetap jelas tanpa warna.
- Badge status pakai outline tegas (bukan warna solid saja).

## 4) Spesifikasi SVG (untuk tim desain)

- Icon pakai viewBox konsisten (disarankan 24x24).
- Stroke icon: 1.75 sampai 2.
- Hindari blur, shadow, filter berat.
- Header/logo utama:
  - Versi horizontal.
  - Transparan background.
  - Tinggi visual seimbang dengan heading.
- Watermark:
  - Monokrom.
  - Opacity target di CSS sekitar 0.08 sampai 0.14.

## 5) Integrasi frontend (file yang dipakai saat ini)

Implementasi print saat ini berada di:

- src/app/tracking-pengajuan/page.tsx

Langkah integrasi:

1. Ganti path aset lama ke folder receipt:
   - /assets/plugins/images/Header Resi.svg -> /assets/plugins/images/receipt/header-resi.svg
   - /assets/plugins/images/Header Resi.png -> /assets/plugins/images/receipt/header-resi.png
   - /assets/plugins/images/wm.png -> /assets/plugins/images/receipt/watermark-resi.svg (atau png fallback)

2. Pastikan fallback onerror tetap ada untuk header logo.

3. Tetap gunakan @page A4 dan ukuran berbasis mm.

4. Pertahankan mekanisme tunggu load gambar sebelum window.print().

5. Pastikan data dinamis aman:
   - Nama/alamat tetap CAPS sesuai aturan yang sudah ada.
   - Nomor registrasi tidak terpotong.

## 6) Checklist QA cetak

- Print test di printer laser hitam-putih.
- Print test di printer inkjet warna.
- Cek skala browser: 100% (jangan fit-to-page otomatis).
- Cek keterbacaan font kecil (7.8 sampai 9.5 px setara template saat ini).
- Cek QR bisa dipindai dari hasil print.
- Cek garis potong terlihat tapi tidak terlalu gelap.
- Cek kedua kupon identik (kecuali label UNTUK MASYARAKAT/PETUGAS).

## 7) Acceptance criteria (siap produksi)

- Tidak ada overlap teks di 20 sampel data acak.
- Tidak ada elemen keluar batas kertas A4.
- QR scan berhasil >= 95% dari sampel print.
- Identitas instansi, nomor registrasi, status, dan tanggal cetak langsung terbaca dalam 3 detik pertama.

## 8) Opsional peningkatan kualitas

- Tambah versi aset 2x untuk raster fallback (png) agar tetap tajam.
- Simpan master desain di Figma/AI dengan naming yang sama seperti file production.
- Jalankan optimasi SVG (SVGO) sebelum deploy.

Contoh command optimasi:

```bash
npx svgo public/assets/plugins/images/receipt/*.svg
```

## 9) Mapping cepat (status saat ini)

Saat ini file print masih merujuk ke:

- /assets/plugins/images/Header Resi.svg
- /assets/plugins/images/Header Resi.png
- /assets/plugins/images/wm.png

Rekomendasi: migrasikan ke folder khusus receipt agar maintenance lebih mudah.
