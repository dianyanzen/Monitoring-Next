export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-[50] mt-10">
      {/* 🌈 Animated gradient background line */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400 via-pink-500 to-cyan-400 animate-[glowline_4s_linear_infinite]" />

      {/* 💠 Glow aura behind footer */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a18]/90 via-[#0a0a18]/60 to-transparent blur-3xl pointer-events-none"></div>

      {/* 🧩 Footer content */}
      <div className="relative text-center py-6 text-sm tracking-wide text-cyan-200/80 backdrop-blur-md bg-[#080812]/80 border-t border-cyan-900/50 shadow-[0_0_20px_#00ffff33,0_0_40px_#ff00ff22] overflow-hidden">
        <p className="flex items-center justify-center gap-1">
          <span className="text-gray-400">Copyright © {year}</span>
          <span className="text-cyan-400 font-semibold hover:text-pink-400 transition-colors duration-500">
            DianYanzen
          </span>
          <span className="text-gray-400">| DisdukCapil Kota Bandung</span>
        </p>

        {/* 🌐 Small digital scanline overlay */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.03)_0px,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_3px)] pointer-events-none"></div>
      </div>
    </footer>
  );
}
