export default function DkbStats() {
  const data = [
    { year: "2025/01", male: 1301970, female: 1297773, total: 2599743 },
    { year: "2024/02", male: 1298551, female: 1293212, total: 2591763 },
    { year: "2024/01", male: 1292690, female: 1287147, total: 2579837 },
    { year: "2023/02", male: 1287427, female: 1281680, total: 2569107 },
    { year: "2023/01", male: 1280611, female: 1274576, total: 2555187 },
    { year: "2022/02", male: 1275897, female: 1269108, total: 2545005 },
    { year: "2022/01", male: 1269294, female: 1261154, total: 2530448 },
    { year: "2021/02", male: 1267661, female: 1260193, total: 2527854 },
    { year: "2021/01", male: 1264093, female: 1254167, total: 2518260 },
    { year: "2020/02", male: 1256205, female: 1244760, total: 2500965 },
    { year: "2020/01", male: 1251636, female: 1238750, total: 2490386 },
    { year: "2019/02", male: 1246951, female: 1233513, total: 2480464 },
    { year: "2019/01", male: 1240749, female: 1227072, total: 2467821 },
    { year: "2018/02", male: 1233357, female: 1218822, total: 2452179 },
    { year: "2018/01", male: 1230196, female: 1210521, total: 2440717 },
    { year: "2017/02", male: 1218143, female: 1194315, total: 2412458 },
    { year: "2017/01", male: 1214678, female: 1189911, total: 2404589 },
    { year: "2016/02", male: 1211820, female: 1185576, total: 2397396 },
    { year: "2015/02", male: 1202025, female: 1176603, total: 2378628 },
    { year: "2014/02", male: 1192215, female: 1148882, total: 2341097 },
  ];

  return (
    <div className="bg-[#0b0b0b]/80 p-6 rounded-xl border border-gray-800 mt-8">
      <h2 className="text-xl font-semibold text-cyan-400 mb-2">
        Dashboard DKB
      </h2>
      <p className="text-sm text-gray-400 mb-4">
        Data Konsolidasi Bersih — Disdukcapil Kota Bandung (dummy data simulasi)
      </p>

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm text-gray-300">
          <thead className="bg-[#101010] text-cyan-400 border-b border-gray-700">
            <tr>
              <th className="text-left py-2 px-3">Tahun</th>
              <th className="text-right py-2 px-3">Laki-Laki</th>
              <th className="text-right py-2 px-3">Perempuan</th>
              <th className="text-right py-2 px-3">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                className="border-b border-gray-800 hover:bg-[#1a1a1a] transition-all duration-150"
              >
                <td className="py-2 px-3">{row.year}</td>
                <td className="text-right px-3">
                  {row.male.toLocaleString("id-ID")}
                </td>
                <td className="text-right px-3">
                  {row.female.toLocaleString("id-ID")}
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
        Sumber data: Sistem Konsolidasi Disdukcapil — versi demonstrasi
      </div>
    </div>
  );
}
