"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { LogOut, Settings, Menu, Mail, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Topbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const [user, setUser] = useState<any>(null);
  const [openUser, setOpenUser] = useState(false);
  const [openMail, setOpenMail] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [sRes, uRes, pRes] = await Promise.all([
          fetch("/api/session", { credentials: "include" }),
          fetch("/api/messages/unread", { credentials: "include" }),
          fetch("/api/messages/previews", { credentials: "include" }),
        ]);

        if (!sRes.ok || !uRes.ok || !pRes.ok) {
          setLoading(false);
          return;
        }

        const sText = await sRes.text();
        const uText = await uRes.text();
        const pText = await pRes.text();

        const sData = JSON.parse(sText);
        const uData = JSON.parse(uText);
        const pData = JSON.parse(pText);

        setUser(sData.user);
        setUnread(uData.count || 0);
        setMessages(pData.items || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenUser(false);
        setOpenMail(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const res = await fetch("/api/logout", { method: "POST" });
      if (res.ok) router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  // 🌌 Efek Hacker Lab Mewah
  const HackerLabOverlay = () => (
    <>
      {/* Grid bergerak */}
      <motion.div
        className="absolute inset-0 opacity-[0.07] bg-[linear-gradient(to_right,#00ffff22_1px,transparent_1px),linear-gradient(to_bottom,#00ffff22_1px,transparent_1px)] bg-[size:40px_40px]"
        animate={{ backgroundPosition: ["0px 0px", "40px 40px"] }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />
      {/* Cahaya partikel halus */}
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,#00ffff22,transparent_60%),radial-gradient(circle_at_70%_60%,#ff00ff22,transparent_60%)]"
        animate={{
          backgroundPosition: ["0% 0%", "100% 100%"],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />
      {/* Sinar horizontal scanner */}
      <motion.div
        className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-400 via-pink-400 to-cyan-400 opacity-60"
        animate={{ y: ["0%", "100%"] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Lapisan pantulan kaca */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent mix-blend-overlay pointer-events-none" />
    </>
  );

  return (
    <header className="fixed top-0 left-0 w-full z-[9999] overflow-visible pointer-events-auto">
      {/* Background animasi cyberpunk */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-[#0d0d20] via-[#1a1a3f] to-[#0d0d20]"
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{ backgroundSize: "200% 200%" }}
      />
      <HackerLabOverlay />

      <div className="relative flex justify-between items-center px-6 py-3 border-b border-cyan-700/50 shadow-[0_0_25px_#00ffff33,0_0_60px_#ff00ff11_inset] backdrop-blur-xl bg-opacity-70">
        {/* === Logo & Title === */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-4"
        >
          <h1 className="text-lg font-bold tracking-wide leading-tight text-cyan-300 relative">
            <span className="block text-sm font-light text-gray-300">MONALISA SYSTEM</span>
            <span className="text-cyan-400 glow">
              Disdukcapil Kota Bandung
              <motion.span
                className="absolute -bottom-1 left-0 w-full h-[1px] bg-gradient-to-r from-cyan-400 via-pink-400 to-transparent"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </span>
          </h1>
        </motion.div>

        {/* === Right Menu === */}
        <div className="flex items-center gap-3 relative" ref={dropdownRef}>
          {/* Sidebar Toggle */}
          <motion.button
            whileHover={{ scale: 1.15, rotate: 6 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleSidebar}
            className="p-2 rounded-md bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-700/40 text-cyan-300 shadow-[0_0_10px_#00ffff88]"
          >
            <Menu className="w-5 h-5" />
          </motion.button>

          {/* Mail Button */}
          <motion.button
            whileHover={{ scale: 1.1, rotate: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setOpenMail(!openMail);
              setOpenUser(false);
            }}
            className="relative p-2 bg-cyan-600/20 hover:bg-cyan-600/40 rounded-md border border-cyan-700/40 text-cyan-300 shadow-[0_0_10px_#00ffff88]"
          >
            <Mail className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-pink-500 rounded-full animate-pulse shadow-[0_0_8px_#ff00ff]" />
            )}
          </motion.button>

          {/* Mail Dropdown */}
          <AnimatePresence>
            {openMail && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="absolute right-14 top-12 w-80 bg-[#0e0e1c]/95 border border-cyan-700/50 text-gray-200 rounded-xl shadow-[0_0_25px_#00ffff33,0_0_15px_#ff00ff22_inset] backdrop-blur-xl overflow-hidden z-[9999]"
              >
                {messages.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-center border-b border-cyan-800/40 font-semibold text-cyan-300">
                    You Don’t Have Any Message
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-cyan-900/30">
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        onClick={() => router.push(`/Chat?from=${msg.nik}`)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-cyan-900/20 cursor-pointer transition-colors"
                      >
                        <Image
                          src={msg.avatarUrl || "/assets/upload/pp/3273000000000000.jpg"}
                          alt="avatar"
                          width={34}
                          height={34}
                          unoptimized
                          className="rounded-full border border-cyan-400/40 object-cover"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-cyan-300 text-sm leading-tight">
                            {msg.name}
                          </div>
                          <div className="text-xs text-gray-400 truncate">{msg.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => (window.location.href = "/Chat")}
                  className="block w-full text-center px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-900/30 transition-colors"
                >
                  Lihat Semua Pesan →
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* User Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={() => {
              setOpenUser(!openUser);
              setOpenMail(false);
            }}
            className="flex items-center gap-2 bg-[#1b1b3a] hover:bg-[#24244b] px-3 py-2 rounded-lg border border-cyan-700/40 transition-all shadow-[0_0_12px_#00ffff55]"
          >
            <Image
              src={
                user?.S_NIK
                  ? `/assets/upload/pp/${user.S_NIK}.jpg`
                  : "/assets/upload/pp/3273000000000000.jpg"
              }
              alt="user"
              width={34}
              height={34}
              unoptimized
              className="rounded-full border border-cyan-400/60 object-cover"
            />
            <span className="hidden sm:block text-sm font-medium text-cyan-100">
              {user?.S_USER_ID || "-"}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-cyan-300 transition-transform ${
                openUser ? "rotate-180" : ""
              }`}
            />
          </motion.button>

          {/* User Dropdown */}
          <AnimatePresence>
            {openUser && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="absolute right-0 top-14 w-64 bg-[#101020]/95 border border-cyan-800/50 text-gray-200 rounded-xl shadow-[0_0_25px_#00ffff33,0_0_15px_#ff00ff22_inset] overflow-hidden backdrop-blur-xl z-[9999]"
              >
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-[#1f1f3e] to-[#262654] border-b border-cyan-900/40">
                  <Image
                    src={
                      user?.S_NIK
                        ? `/assets/upload/pp/${user.S_NIK}.jpg`
                        : "/assets/upload/pp/3273000000000000.jpg"
                    }
                    alt="profile"
                    width={45}
                    height={45}
                    unoptimized
                    className="rounded-full border border-cyan-400/40"
                  />
                  <div className="leading-tight">
                    <h4 className="font-semibold text-cyan-300 text-sm">
                      {user?.S_NAMA_DPN || "User"}
                    </h4>
                    <p className="text-xs text-cyan-100/70">
                      {user?.S_NIK || "3273000000000000"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/Activity/setting")}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-cyan-900/30 transition-colors"
                >
                  <Settings className="w-4 h-4 text-cyan-400" />
                  <span>Account Setting</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loggingOut ? (
                    <svg className="w-4 h-4 text-gray-400 animate-spin" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    </svg>
                  ) : (
                    <LogOut className="w-4 h-4 text-red-500" />
                  )}
                  <span>{loggingOut ? "Logging out..." : "Logout"}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
