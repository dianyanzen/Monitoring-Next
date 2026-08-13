# Receipt Assets

Folder ini dipakai oleh template print resi tracking pengajuan.

## Dipakai saat ini

- header-resi.png
- watermark-resi.png
- header-resi.svg (placeholder, wrapper ke PNG)
- watermark-resi.svg (placeholder, wrapper ke PNG)

## Target final (direkomendasikan)

Siapkan versi SVG untuk ketajaman print:

- header-resi.svg
- watermark-resi.svg

Jika SVG sudah tersedia, update path di:

- src/app/tracking-pengajuan/page.tsx

Gunakan fallback PNG jika SVG gagal load.

Catatan sementara:
- File SVG yang ada saat ini adalah placeholder agar jalur SVG bisa langsung dites.
- Ganti dengan SVG final dari tim desain untuk kualitas cetak terbaik.

## Naming standar ikon (opsional)

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
