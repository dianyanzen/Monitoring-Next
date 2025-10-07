interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
}

export default function StatCard({ title, value, change }: StatCardProps) {
  return (
    <div className="bg-[#121216]/80 backdrop-blur-md border border-gray-800 rounded-xl p-5 hover:border-cyan-500 transition-all duration-200">
      <h3 className="text-sm text-gray-400">{title}</h3>
      <p className="text-3xl font-semibold text-white mt-1">{value}</p>
      {change && <p className="text-sm text-cyan-400 mt-1">{change}</p>}
    </div>
  );
}
