"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section role="alert">
      <h1>Upload PDAK belum dapat dibuka</h1>
      <p>Periksa koneksi database MONALISA dan izin menu Anda.</p>
      <button onClick={reset}>Coba kembali</button>
    </section>
  );
}
