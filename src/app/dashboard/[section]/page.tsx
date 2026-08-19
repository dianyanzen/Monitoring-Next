import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeInfo, ChevronLeft } from "lucide-react";
import DashboardPage from "../page";

const SECTION_META: Record<string, { title: string; description: string }> = {
  disduk: {
    title: "DISDUK",
    description: "Dashboard utama untuk monitoring pusat layanan Disdukcapil.",
  },
  fcl: {
    title: "FCL",
    description: "Ringkasan dashboard untuk area Festival Citylink.",
  },
  btc: {
    title: "BTC",
    description: "Ringkasan dashboard untuk area BTC / D'Botanica.",
  },
  mim: {
    title: "MIM",
    description: "Ringkasan dashboard untuk area Mall Indah Mall.",
  },
  dprd: {
    title: "DPRD",
    description: "Ringkasan dashboard untuk area DPRD.",
  },
};

type PageProps = {
  params: Promise<{
    section: string;
  }>;
};

export default async function DashboardSectionPage({ params }: PageProps) {
  const { section } = await params;
  const key = section.toLowerCase();
  const meta = SECTION_META[key];

  if (!meta) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/80 px-5 py-4 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#00ffff18,transparent_45%),radial-gradient(circle_at_80%_80%,#ff00ff14,transparent_50%)]" />
        <div className="relative flex flex-wrap items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            <BadgeInfo className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-base font-semibold tracking-wide text-cyan-200">Dashboard {meta.title}</h1>
            <p className="text-xs text-cyan-200/70">{meta.description}</p>
          </div>
          <Link
            href="/dashboard"
            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Kembali ke overview
          </Link>
        </div>
      </section>

      <DashboardPage />
    </div>
  );
}
