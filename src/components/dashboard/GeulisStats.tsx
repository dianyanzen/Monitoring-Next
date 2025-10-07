export default function GeulisStats() {
  const data = [
    {
      name: "GEULIS KIWARI",
      rekam: 1,
      cetak: 60,
      idd: 17,
      akta: 457,
      kia: 177,
      total: 712,
    },
    {
      name: "GEULIS BTC",
      rekam: 48,
      cetak: 79,
      idd: 13,
      akta: 243,
      kia: 496,
      total: 879,
    },
    {
      name: "GEULIS MIM",
      rekam: 107,
      cetak: 135,
      idd: 46,
      akta: 139,
      kia: 397,
      total: 824,
    },
    {
      name: "GEULIS DPRD",
      rekam: 18,
      cetak: 120,
      idd: 6,
      akta: 179,
      kia: 244,
      total: 567,
    },
    {
      name: "GEULIS GPP",
      rekam: 110,
      cetak: 66,
      idd: 13,
      akta: 185,
      kia: 232,
      total: 606,
    },
    {
      name: "GEULIS MPP",
      rekam: 46,
      cetak: 0,
      idd: 17,
      akta: 174,
      kia: 336,
      total: 573,
    },
  ];

  return (
    <div className="bg-[#0b0b0b]/80 p-6 rounded-xl border border-gray-800 mt-8">
      <h2 className="text-xl font-semibold text-cyan-400 mb-1">
        Rekapitulasi Layanan Kependudukan per-Geulis dan Jenis Layanan
      </h2>
      <p className="text-sm text-gray-400 mb-5">
        Periode 07 September 2025 - 07 Oktober 2025
      </p>

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm text-gray-300">
          <thead className="bg-[#101010] text-cyan-400 border-b border-gray-700">
            <tr>
              <th className="text-left py-2 px-3">Nama Geulis</th>
              <th className="text-right py-2 px-3">Rekaman KTP-el</th>
              <th className="text-right py-2 px-3">Pencetakan KTP-el</th>
              <th className="text-right py-2 px-3">Identitas Digital</th>
              <th className="text-right py-2 px-3">Akta Kelahiran 0-17</th>
              <th className="text-right py-2 px-3">Kartu Identitas Anak</th>
              <th className="text-right py-2 px-3">Total Keseluruhan</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                className="border-b border-gray-800 hover:bg-[#1a1a1a] transition-all duration-150"
              >
                <td className="py-2 px-3 font-medium text-white">
                  {row.name}
                </td>
                <td className="text-right px-3">
                  {row.rekam.toLocaleString("id-ID")}
                </td>
                <td className="text-right px-3">
                  {row.cetak.toLocaleString("id-ID")}
                </td>
                <td className="text-right px-3">
                  {row.idd.toLocaleString("id-ID")}
                </td>
                <td className="text-right px-3">
                  {row.akta.toLocaleString("id-ID")}
                </td>
                <td className="text-right px-3">
                  {row.kia.toLocaleString("id-ID")}
                </td>
                <td className="text-right font-semibold text-white px-3">
                  {row.total.toLocaleString("id-ID")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500 mt-3 italic">
        Sumber data: Pelayanan Geulis — Disdukcapil Kota Bandung
      </div>
    </div>
  );
}
