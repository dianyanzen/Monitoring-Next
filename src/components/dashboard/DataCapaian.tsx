export default function DataCapaian() {
  const data = [
    { title: "Perekaman KTP-EL", realisasi: "1.933.902", persenR: "98.80%", target: "1.945.694", persenT: "99.40%" },
    { title: "Kartu Identitas Anak (KIA)", realisasi: "443.964", persenR: "68.83%", target: "399.926", persenT: "62.00%" },
    { title: "Akta Kelahiran 0–17 Tahun", realisasi: "672.157", persenR: "98.74%", target: "680.762", persenT: "99.50%" },
    { title: "Identitas Kependudukan Digital (IKD)", realisasi: "106.803", persenR: "5.52%", target: "587.232", persenT: "30.00%" },
  ];

  return (
    <section className="bg-[#111]/70 p-6 rounded-xl border border-gray-800">
      <h2 className="text-xl font-semibold text-cyan-400 mb-4">Dashboard Data Capaian</h2>
      <div className="space-y-4">
        {data.map((item, idx) => (
          <div key={idx} className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-700 hover:border-cyan-400 transition-all">
            <h3 className="text-white font-medium mb-1">{item.title}</h3>
            <div className="flex justify-between text-gray-300 text-sm">
              <span>Realisasi: {item.realisasi} | {item.persenR}</span>
              <span>Target: {item.target} | {item.persenT}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
