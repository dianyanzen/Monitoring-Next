export default function KecamatanStats() {
  const data = [
    { name: "Sukasari", rekam: 76, cetak: 508, ikd: 32, total: 616 },
    { name: "Coblong", rekam: 65, cetak: 950, ikd: 47, total: 1062 },
    { name: "Babakan Ciparay", rekam: 122, cetak: 654, ikd: 26, total: 802 },
    { name: "Bojongloa Kaler", rekam: 84, cetak: 777, ikd: 33, total: 894 },
    { name: "Andir", rekam: 80, cetak: 804, ikd: 29, total: 913 },
    { name: "Cicendo", rekam: 84, cetak: 757, ikd: 34, total: 875 },
    { name: "Sukajadi", rekam: 74, cetak: 716, ikd: 45, total: 835 },
    { name: "Cidadap", rekam: 55, cetak: 394, ikd: 16, total: 465 },
    { name: "Bandung Wetan", rekam: 41, cetak: 191, ikd: 11, total: 243 },
    { name: "Astana Anyar", rekam: 72, cetak: 433, ikd: 28, total: 533 },
    { name: "Regol", rekam: 71, cetak: 519, ikd: 35, total: 625 },
    { name: "Batununggal", rekam: 85, cetak: 565, ikd: 71, total: 721 },
    { name: "Lengkong", rekam: 51, cetak: 504, ikd: 28, total: 583 },
    { name: "Cibeunying Kidul", rekam: 84, cetak: 819, ikd: 48, total: 951 },
    { name: "Bandung Kulon", rekam: 146, cetak: 652, ikd: 18, total: 816 },
    { name: "Kiaracondong", rekam: 96, cetak: 943, ikd: 70, total: 1109 },
    { name: "Bojongloa Kidul", rekam: 92, cetak: 631, ikd: 87, total: 810 },
    { name: "Cibeunying Kaler", rekam: 17, cetak: 250, ikd: 30, total: 297 },
    { name: "Sumur Bandung", rekam: 30, cetak: 342, ikd: 17, total: 389 },
    { name: "Antapani", rekam: 84, cetak: 643, ikd: 45, total: 772 },
    { name: "Bandung Kidul", rekam: 49, cetak: 379, ikd: 40, total: 468 },
    { name: "Buah Batu", rekam: 0, cetak: 622, ikd: 79, total: 701 },
    { name: "Rancasari", rekam: 43, cetak: 683, ikd: 23, total: 749 },
    { name: "Arcamanik", rekam: 60, cetak: 500, ikd: 344, total: 904 },
    { name: "Cibiru", rekam: 71, cetak: 505, ikd: 120, total: 696 },
    { name: "Ujung Berung", rekam: 78, cetak: 702, ikd: 20, total: 800 },
    { name: "Gedebage", rekam: 24, cetak: 328, ikd: 15, total: 367 },
    { name: "Panyileukan", rekam: 33, cetak: 263, ikd: 19, total: 315 },
    { name: "Cinambo", rekam: 14, cetak: 180, ikd: 5, total: 199 },
    { name: "Mandalajati", rekam: 70, cetak: 545, ikd: 31, total: 646 },
  ];

  return (
    <div className="bg-[#0b0b0b]/80 p-6 rounded-xl border border-gray-800 mt-8">
      <h2 className="text-xl font-semibold text-cyan-400 mb-1">
        Rekapitulasi Layanan Kependudukan per-Kecamatan dan Jenis Layanan
      </h2>
      <p className="text-sm text-gray-400 mb-5">
        Periode 07 September 2025 - 07 Oktober 2025
      </p>

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm text-gray-300">
          <thead className="bg-[#101010] text-cyan-400 border-b border-gray-700">
            <tr>
              <th className="text-left py-2 px-3">Nama Kecamatan</th>
              <th className="text-right py-2 px-3">Perekaman KTP-el</th>
              <th className="text-right py-2 px-3">Pencetakan KTP-el</th>
              <th className="text-right py-2 px-3">Identitas Digital (IKD)</th>
              <th className="text-right py-2 px-3">Total Keseluruhan</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-gray-800 hover:bg-[#1a1a1a] transition-all duration-150 ${
                  i % 2 === 0 ? "bg-[#0d0d0d]/70" : ""
                }`}
              >
                <td className="py-2 px-3 font-medium text-white">{row.name}</td>
                <td className="text-right px-3">{row.rekam.toLocaleString("id-ID")}</td>
                <td className="text-right px-3">{row.cetak.toLocaleString("id-ID")}</td>
                <td className="text-right px-3">{row.ikd.toLocaleString("id-ID")}</td>
                <td className="text-right font-semibold text-white px-3">
                  {row.total.toLocaleString("id-ID")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500 mt-3 italic">
        Sumber data: Pelayanan Kecamatan — Disdukcapil Kota Bandung
      </div>
    </div>
  );
}
