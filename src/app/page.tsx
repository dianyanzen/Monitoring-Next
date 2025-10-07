"use client";

import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import ActivityFeed from "@/components/ActivityFeed";

export default function DashboardPage() {
  return (
    <div className="relative p-8 text-gray-200 space-y-6">
      {/* Neon background ambient */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/3 w-[800px] h-[800px] bg-cyan-500/20 blur-[160px] rounded-full animate-pulse-slow" />
        <div className="absolute bottom-0 right-1/3 w-[700px] h-[700px] bg-fuchsia-600/10 blur-[140px] rounded-full animate-pulse-slow" />
      </div>

      <h1 className="text-3xl font-semibold tracking-wide text-cyan-400">
        Dashboard Monitoring
      </h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-6">
        <StatCard title="Total Penduduk" value="1.205.433" change="+0.5%" />
        <StatCard title="Perekaman KTP" value="982.112" change="+1.2%" />
        <StatCard title="KIA Terbit" value="451.309" change="+0.9%" />
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <ChartCard />
        </div>
        <ActivityFeed />
      </div>
    </div>
  );
}
