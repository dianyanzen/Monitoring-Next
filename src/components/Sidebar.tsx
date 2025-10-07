export default function Sidebar() {
  return (
    <aside className="w-64 h-screen p-6 flex flex-col text-gray-300">
      <h2 className="text-xl font-semibold mb-6">⚙️ Monitoring</h2>
      <nav className="flex flex-col gap-3">
        <a href="#" className="hover:text-cyan-400 transition-colors">Dashboard</a>
        <a href="#" className="hover:text-cyan-400 transition-colors">Statistik</a>
        <a href="#" className="hover:text-cyan-400 transition-colors">Aktivitas</a>
      </nav>
      <div className="mt-auto text-sm text-gray-500">© 2025 Disdukcapil</div>
    </aside>
  );
}
