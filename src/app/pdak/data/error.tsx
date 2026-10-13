"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section role="alert">
      <h1>Data PDAK belum dapat dimuat</h1>
      <button onClick={reset}>Coba kembali</button>
    </section>
  );
}
