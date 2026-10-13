"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section role="alert">
      <h1>Klasemen IKD belum dapat dibuka</h1>
      <button onClick={reset}>Coba kembali</button>
    </section>
  );
}
