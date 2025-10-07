const activities = [
  { id: 1, message: "Update data penduduk Kec. Bojongsoang", time: "5 menit lalu" },
  { id: 2, message: "Sinkronisasi SIAK pusat berhasil", time: "12 menit lalu" },
  { id: 3, message: "Perekaman KIA baru: 128 data", time: "30 menit lalu" },
];

export default function ActivityFeed() {
  return (
    <div className="bg-[#121216]/80 backdrop-blur-md border border-gray-800 rounded-xl p-5 h-full">
      <h3 className="text-gray-400 mb-3">Aktivitas Terbaru</h3>
      <ul className="flex flex-col gap-3">
        {activities.map((a) => (
          <li key={a.id} className="text-sm text-gray-300 flex justify-between">
            <span>{a.message}</span>
            <span className="text-gray-500">{a.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
