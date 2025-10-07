export default function PendudukEfektif() {
  return (
    <section className="bg-[#111]/70 p-6 rounded-xl border border-gray-800">
      <h2 className="text-xl font-semibold text-cyan-400 mb-4">Dashboard Penduduk Efektif</h2>
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-700">
          <p className="text-gray-400">Jumlah Penduduk DKB 2025 Semester 1</p>
          <p className="text-3xl font-bold text-white mt-1">2,599,743</p>
        </div>
        <div className="bg-[#1a1a1a] p-4 rounded-lg border border-gray-700">
          <p className="text-gray-400">Real-Time Population Estimate</p>
          <p className="text-3xl font-bold text-white mt-1">2,603,586</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mt-6">
        <div className="bg-[#1a1a1a] p-3 rounded-lg text-center text-gray-300">
          <p className="text-lg font-semibold text-white">9,029</p>
          <p>Kelahiran</p>
        </div>
        <div className="bg-[#1a1a1a] p-3 rounded-lg text-center text-gray-300">
          <p className="text-lg font-semibold text-white">4,071</p>
          <p>Kematian</p>
        </div>
        <div className="bg-[#1a1a1a] p-3 rounded-lg text-center text-gray-300">
          <p className="text-lg font-semibold text-white">7,118</p>
          <p>Kedatangan</p>
        </div>
        <div className="bg-[#1a1a1a] p-3 rounded-lg text-center text-gray-300">
          <p className="text-lg font-semibold text-white">8,233</p>
          <p>Perpindahan</p>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-4">
        Rumus: Jumlah Penduduk Efektif = Jumlah Penduduk + (Kelahiran + Kedatangan) - (Kematian + Perpindahan)
      </p>
      <p className="text-xs text-gray-500">Periode 01 July 2025 - 07 October 2025</p>
    </section>
  );
}
