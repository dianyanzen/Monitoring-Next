export default function KtpElStats() {
  const data = [
    { label: "Perekaman KTP-EL", value: 91 },
    { label: "Pencetakan KTP-EL", value: 359 },
    { label: "Pengeluaran Blangko", value: 0 },
    { label: "Sisa Blangko E-KTP", value: 4471 },
    { label: "Print Ready Record", value: 1049 },
    { label: "Sent For Enrollment", value: 37 },
    { label: "Duplicate Record", value: 842 },
    { label: "Tunggakan Suket", value: 0 },
  ];

  return (
    <section className="bg-[#111]/70 p-6 rounded-xl border border-gray-800 backdrop-blur">
      <h2 className="text-xl font-semibold text-cyan-400 mb-4">Dashboard KTP-EL</h2>
      <div className="grid grid-cols-4 gap-4">
        {data.map((item, idx) => (
          <div key={idx} className="bg-[#1a1a1a] p-4 rounded-lg text-center border border-gray-700 hover:border-cyan-400 transition-all">
            <p className="text-2xl font-bold text-white">{item.value.toLocaleString()}</p>
            <p className="text-gray-400 text-sm mt-1">{item.label}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-500 mt-3 text-right">Tanggal 07-10-2025 11:15:14</p>
    </section>
  );
}
