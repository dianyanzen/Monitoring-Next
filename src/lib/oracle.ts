import oracledb from "oracledb";

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// Pool sederhana
let pool: any = null;

export async function getOracleConnection() {
  try {
    // Pastikan pool sudah dibuat
    if (!pool) {
      pool = await oracledb.createPool({
        user: "DB_MONITORING",
        password: "gonnabesuccess",
        connectString:
          "(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=10.32.73.7)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=siakdb)))",
      });
      console.log("✅ Oracle connection pool created.");
    }

    // Coba ambil koneksi dari pool
    const connection = await pool.getConnection();
    console.log("🔌 Oracle connection acquired.");
    return connection;
  } catch (error: any) {
    console.error("❌ Gagal membuat koneksi Oracle:", error.message || error);
    throw new Error(
      `Koneksi Oracle gagal: ${error.message || "Unknown error"}`
    );
  }
}
