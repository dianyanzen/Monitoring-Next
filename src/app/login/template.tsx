// FILE: src/app/login/template.tsx
import { Suspense } from "react";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm opacity-70">Menyiapkan login…</div>}>
      {children}
    </Suspense>
  );
}
