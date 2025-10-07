export default function Topbar() {
  return (
    <header className="w-full px-6 py-4 flex justify-between items-center">
      <h1 className="text-lg font-semibold tracking-wide text-cyan-400">Monitoring Futuristik</h1>
      <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-sm text-white transition-all">
        Refresh Data
      </button>
    </header>
  );
}
