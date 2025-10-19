// FILE: src/app/login/page.tsx
import { Suspense } from "react";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;
type PageProps = { searchParams?: Promise<SearchParams> };

export default async function LoginPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const nextUrl = (sp.next as string) || "/dashboard";
  const msg = (sp.msg as string) || "";

  return (
    <Suspense fallback={<div className="p-6 text-sm opacity-70">Memuat login…</div>}>
      <LoginClient nextUrl={nextUrl} initialMsg={msg} />
    </Suspense>
  );
}
