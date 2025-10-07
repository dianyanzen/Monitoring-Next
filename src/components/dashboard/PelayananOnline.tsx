export default function PelayananOnline() {
  const data = [
    {
      name: "Akta Kelahiran",
      today: { baru: 71, upload: 3, tidakLengkap: 18 },
      total: { baru: 168, upload: 19, tidakLengkap: 183 },
      verif: 22,
      publish: 0,
    },
    {
      name: "Akta Kematian",
      today: { baru: 59, upload: 5, tidakLengkap: 6 },
      total: { baru: 59, upload: 10, tidakLengkap: 59 },
      verif: 17,
      publish: 0,
    },
    {
      name: "Pindah Keluar",
      today: { baru: 3, upload: 0, tidakLengkap: 3 },
      total: { baru: 3, upload: 0, tidakLengkap: 53 },
      verif: 21,
      publish: 0,
    },
    {
      name: "Kartu Identitas Anak",
      today: { baru: 0, upload: 0, tidakLengkap: 0 },
      total: { baru: 0, upload: 23, tidakLengkap: 0 },
      verif: 0,
      publish: 0,
    },
    {
      name: "Perbaikan Data",
      today: { baru: 1, upload: 0, tidakLengkap: 0 },
      total: { baru: 2, upload: 2, tidakLengkap: 8 },
      verif: 4,
      publish: 0,
    },
    {
      name: "Input Biodata",
      today: { baru: 0, upload: 0, tidakLengkap: 0 },
      total: { baru: 0, upload: 0, tidakLengkap: 0 },
      verif: 0,
      publish: 0,
    },
    {
      name: "Kartu Keluarga",
      today: { baru: 11, upload: 0, tidakLengkap: 6 },
      total: { baru: 36, upload: 2, tidakLengkap: 53 },
      verif: 3,
      publish: 0,
    },
    {
      name: "Cetak KTP-el",
      today: { baru: 0, upload: 0, tidakLengkap: 0 },
      total: { baru: 0, upload: 0, tidakLengkap: 0 },
      verif: 0,
      publish: 0,
    },
    {
      name: "Pindah Datang",
      today: { baru: 0, upload: 0, tidakLengkap: 0 },
      total: { baru: 0, upload: 0, tidakLengkap: 0 },
      verif: 0,
      publish: 0,
    },
  ];

  return (
    <div className="bg-[#0b0b0b]/80 p-6 rounded-xl border border-gray-800 mt-8">
      <h2 className="text-xl font-semibold text-cyan-400 mb-1">
        Dashboard Pelayanan Online
      </h2>
      <p className="text-sm text-gray-400 mb-6">
        Status pengajuan dan progress pelayanan daring Disdukcapil Kota Bandung
      </p>

      {/* Grid 3 kolom (responsif otomatis) */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((item, i) => (
          <div
            key={i}
            className="bg-gradient-to-b from-[#0e0e0e]/80 to-[#101010]/95 border border-gray-800 p-5 rounded-xl hover:shadow-[0_0_15px_rgba(0,255,255,0.2)] transition-all"
          >
            <h3 className="text-lg font-semibold text-white mb-3">{item.name}</h3>

            <div className="space-y-1 text-sm">
              <p className="text-cyan-400 font-medium">Hari Ini</p>
              <div className="flex justify-between">
                <span>Baru:</span>
                <span>{item.today.baru.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between">
                <span>Upload Ulang:</span>
                <span>{item.today.upload.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between">
                <span>Tidak Lengkap:</span>
                <span>{item.today.tidakLengkap.toLocaleString("id-ID")}</span>
              </div>
            </div>

            <div className="mt-4 space-y-1 text-sm">
              <p className="text-cyan-400 font-medium">Keseluruhan</p>
              <div className="flex justify-between">
                <span>Baru:</span>
                <span>{item.total.baru.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between">
                <span>Upload Ulang:</span>
                <span>{item.total.upload.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between">
                <span>Tidak Lengkap:</span>
                <span>{item.total.tidakLengkap.toLocaleString("id-ID")}</span>
              </div>
            </div>

            <div className="mt-4 flex justify-between text-sm">
              <div>
                <p className="text-cyan-400 font-medium">Terverifikasi</p>
                <p>{item.verif.toLocaleString("id-ID")}</p>
              </div>
              <div>
                <p className="text-cyan-400 font-medium">Terpublish</p>
                <p>{item.publish.toLocaleString("id-ID")}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-500 mt-5 italic">
        Data simulasi dummy — update otomatis saat API real-time diaktifkan
      </div>
    </div>
  );
}
