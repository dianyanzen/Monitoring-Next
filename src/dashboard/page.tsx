import StatCard from "@/components/StatCard";
import ChartCard from "@/components/ChartCard";
import ActivityFeed from "@/components/ActivityFeed";

export default function Page() {
  return (
    <div className="p-8 text-gray-200 space-y-6">
      <h1 className="text-3xl font-semibold">Dashboard Monitoring</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-6">
        <StatCard title="Total Penduduk" value="1.2 Juta" change="+0.5%" />
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
