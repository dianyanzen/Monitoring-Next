// File: app/(components)/layout/Topbar.tsx
"use client";

import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useId, useCallback } from "react";
import { LogOut, Settings, Menu, Mail, ChevronDown, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useSession } from "@/contexts/session";

export default function Topbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
   const [theme, setTheme] = useState<"dark" | "light">("dark");
  const { user, unread, messages, loading, refreshPreviews } = useSession();
  const [openUser, setOpenUser] = useState(false);
  const [openMail, setOpenMail] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  // id unik untuk mengaitkan tombol ↔ menu (a11y)
  const mailBtnId = useId();
  const mailMenuId = useId();
  const userBtnId = useId();
  const userMenuId = useId();

  // Fallback avatar
  const avatarSrc = useMemo(
    () => (user?.S_NIK ? `/assets/upload/pp/${user.S_NIK}.jpg` : "/assets/upload/pp/3273000000000000.jpg"),
    [user?.S_NIK]
  );

    const applyTheme = useCallback((t: "dark" | "light") => {
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
      root.dataset.theme = "dark";
    } else {
      root.classList.remove("dark");
      root.dataset.theme = "light";
    }
  }, []);

  // Tutup dropdown kalau klik di luar
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(e.target as Node)) {
        setOpenUser(false);
        setOpenMail(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Tutup dropdown saat pindah route (biar bersih)
  useEffect(() => {
    setOpenUser(false);
    setOpenMail(false);
  }, [pathname]);

  // Buka mail → refresh badge/preview terbaru (tanpa polling terus-menerus)
  useEffect(() => {
    if (openMail) refreshPreviews();
  }, [openMail, refreshPreviews]);

  // ESC untuk menutup dropdown
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenUser(false);
        setOpenMail(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const res = await fetch("/api/logout", { method: "POST", credentials: "include" });
      if (res.ok) router.replace("/login");
    } catch (e) {
      console.error("Logout error:", e);
    } finally {
      setLoggingOut(false);
    }
  };

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: "dark" | "light" = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("theme", next);
      } catch {
        // ignore
      }
      applyTheme(next);
      return next;
    });
  }, [applyTheme]);

  // 🌌 Efek Hacker Lab Mewah (patuh prefers-reduced-motion)
  const HackerLabOverlay = ({ reduce }: { reduce: boolean }) => (
    <>
      <motion.div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] bg-[linear-gradient(to_right,#00ffff22_1px,transparent_1px),linear-gradient(to_bottom,#00ffff22_1px,transparent_1px)] bg-[size:40px_40px]"
        animate={reduce ? undefined : { backgroundPosition: ["0px 0px", "40px 40px"] }}
        transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,#00ffff22,transparent_60%),radial-gradient(circle_at_70%_60%,#ff00ff22,transparent_60%)]"
        animate={reduce ? undefined : { backgroundPosition: ["0% 0%", "100% 100%"] }}
        transition={reduce ? undefined : { duration: 8, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        aria-hidden
        className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-400 via-pink-400 to-cyan-400 opacity-60"
        animate={reduce ? undefined : { y: ["0%", "100%"] }}
        transition={reduce ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent mix-blend-overlay pointer-events-none" />
    </>
  );

  return (
    <header className="fixed top-0 left-0 w-full z-[9999] overflow-visible pointer-events-auto">
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-[#0d0d20] via-[#1a1a3f] to-[#0d0d20]"
        animate={reduceMotion ? undefined : { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={reduceMotion ? undefined : { duration: 20, repeat: Infinity, ease: "linear" }}
        style={{ backgroundSize: "200% 200%" }}
      />
      <HackerLabOverlay reduce={reduceMotion} />

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
            <span className="text-cyan-400">
              Disdukcapil Kota Bandung
              <motion.span
                aria-hidden
                className="absolute -bottom-1 left-0 w-full h-[1px] bg-gradient-to-r from-cyan-400 via-pink-400 to-transparent"
                animate={reduceMotion ? undefined : { opacity: [0.3, 1, 0.3] }}
                transition={reduceMotion ? undefined : { duration: 2, repeat: Infinity }}
              />
            </span>
          </h1>
        </motion.div>

        {/* === Right Menu === */}
        <div className="flex items-center gap-3 relative" ref={dropdownRef}>
          {/* Sidebar Toggle */}
          <motion.button
            aria-label="Toggle sidebar"
            whileHover={reduceMotion ? undefined : { scale: 1.15, rotate: 6 }}
            whileTap={reduceMotion ? undefined : { scale: 0.95 }}
            onClick={onToggleSidebar}
            className="p-2 rounded-md bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-700/40 text-cyan-300 shadow-[0_0_10px_#00ffff88]"
          >
            <Menu className="w-5 h-5" />
          </motion.button>

          {/* Mail Button */}
          <motion.button
            id={mailBtnId}
            aria-haspopup="menu"
            aria-expanded={openMail}
            aria-controls={mailMenuId}
            whileHover={reduceMotion ? undefined : { scale: 1.1, rotate: -5 }}
            whileTap={reduceMotion ? undefined : { scale: 0.95 }}
            onClick={() => {
              setOpenMail((v) => !v);
              setOpenUser(false);
            }}
            onMouseEnter={() => { if (!openMail) { void refreshPreviews(); } }}
            className="relative p-2 bg-cyan-600/20 hover:bg-cyan-600/40 rounded-md border border-cyan-700/40 text-cyan-300 shadow-[0_0_10px_#00ffff88]"
          >
            <Mail className="w-5 h-5" />
            {(unread ?? 0) > 0 && (
              <span
                role="status"
                aria-live="polite"
                aria-label={`${unread} unread`}
                className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-pink-500 rounded-full animate-pulse shadow-[0_0_8px_#ff00ff]"
              />
            )}
          </motion.button>

          {/* Mail Dropdown */}
          <AnimatePresence>
            {openMail && (
              <motion.div
                id={mailMenuId}
                role="menu"
                aria-labelledby={mailBtnId}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="absolute right-14 top-12 w-80 bg-[#0e0e1c]/95 border border-cyan-700/50 text-gray-200 rounded-xl shadow-[0_0_25px_#00ffff33,0_0_15px_#ff00ff22_inset] backdrop-blur-xl overflow-hidden z-[9999]"
              >
                {loading ? (
                  <div className="px-4 py-3 text-sm text-cyan-200/80">Loading messages…</div>
                ) : (messages?.length ?? 0) === 0 ? (
                  <div className="px-4 py-3 text-sm text-center border-b border-cyan-800/40 font-semibold text-cyan-300">
                    You Don’t Have Any Message
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-cyan-900/30">
                    {messages.map((msg: any, idx: number) => (
                      <button
                        type="button"
                        data-overlay-on-click
                        key={`${msg.nik}-${idx}`}
                        onClick={() => router.push(`/chat?from=${msg.nik}`)}
                        className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-cyan-900/20 cursor-pointer transition-colors"
                      >
                        <Image
                          src={msg.avatarUrl || "/assets/upload/pp/3273000000000000.jpg"}
                          alt={`${msg.name || "User"} avatar`}
                          width={34}
                          height={34}
                          unoptimized
                          className="rounded-full border border-cyan-400/40 object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-cyan-300 text-sm leading-tight truncate">
                            {msg.name}
                          </div>
                          <div className="text-xs text-gray-400 truncate">{msg.text}</div>
                          <div className="text-[10px] text-cyan-600/70">{msg.createdAt || ""}</div>
                        </div>
                        {Number(msg.unread ?? 0) > 0 && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-pink-600/30 border border-pink-400/40 text-pink-200">
                            {msg.unread}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => router.push("/chat")}
                  data-overlay-on-click
                  className="block w-full text-center px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-900/30 transition-colors"
                >
                  Lihat Semua Pesan →
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* User Button */}
          {/* 🌗 Theme Toggle (Dark / Light) */}
          <motion.button
            type="button"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} view`}
            aria-pressed={theme === "dark"}
            title={theme === "dark" ? "Light view" : "Dark view"}
            whileHover={reduceMotion ? undefined : { scale: 1.1, rotate: theme === "dark" ? -6 : 6 }}
            whileTap={reduceMotion ? undefined : { scale: 0.95 }}
            onClick={toggleTheme}
            className="p-2 rounded-md bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-700/40 text-cyan-300 shadow-[0_0_10px_#00ffff88]"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </motion.button>

          <motion.button
            id={userBtnId}
            aria-haspopup="menu"
            aria-expanded={openUser}
            aria-controls={userMenuId}
            whileHover={reduceMotion ? undefined : { scale: 1.05 }}
            onClick={() => {
              setOpenUser((v) => !v);
              setOpenMail(false);
            }}
            className="flex items-center gap-2 bg-[#1b1b3a] hover:bg-[#24244b] px-3 py-2 rounded-lg border border-cyan-700/40 transition-all shadow-[0_0_12px_#00ffff55]"
          >
            {/* pakai img untuk fallback cepat */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarSrc}
              alt={`user ${user?.S_USER_ID || ""}`}
              width={34}
              height={34}
              className="rounded-full border border-cyan-400/60 object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/assets/upload/pp/3273000000000000.jpg";
              }}
            />
            <span className="hidden sm:block text-sm font-medium text-cyan-100">
              {user?.S_USER_ID || "-"}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-cyan-300 transition-transform ${openUser ? "rotate-180" : ""}`}
            />
          </motion.button>

          {/* User Dropdown */}
          <AnimatePresence>
            {openUser && (
              <motion.div
                id={userMenuId}
                role="menu"
                aria-labelledby={userBtnId}
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }}
                transition={{ duration: 0.22 }}
                className="absolute right-0 top-14 w-80 bg-[#101020]/95 border border-cyan-800/50 text-gray-200 rounded-2xl shadow-[0_0_30px_#00ffff33,0_0_18px_#ff00ff22_inset] overflow-hidden backdrop-blur-xl z-[9999]"
              >
                {/* Header user lebih besar */}
                <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-[#1f1f3e] to-[#262654] border-b border-cyan-900/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarSrc}
                    alt="profile"
                    width={72}
                    height={72}
                    className="rounded-full border border-cyan-400/40 object-cover shadow-[0_0_15px_#00ffff33]"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/assets/upload/pp/3273000000000000.jpg";
                    }}
                  />
                  <div className="leading-tight">
                    <h4 className="font-semibold text-cyan-300 text-[15px] leading-snug">
                      {user?.S_NAMA_DPN || "User"}
                    </h4>
                    <p className="text-[13px] text-cyan-100/75">{user?.S_NIK || "3273000000000000"}</p>
                  </div>
                </div>

                {/* Actions lebih lapang */}
                <button
                  type="button"
                  data-overlay-on-click
                  onClick={() => router.push("/Activity/setting")}
                  className="w-full flex items-center gap-3 px-5 py-3 text-[14px] hover:bg-cyan-900/30 transition-colors"
                >
                  <Settings className="w-5 h-5 text-cyan-400" />
                  <span>Account Setting</span>
                </button>

                <button
                  type="button"
                  data-overlay-on-click
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-3 px-5 py-3 text-[14px] text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loggingOut ? (
                    <svg className="w-5 h-5 text-gray-400 animate-spin" viewBox="0 0 24 24" aria-hidden>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    </svg>
                  ) : (
                    <LogOut className="w-5 h-5 text-red-500" />
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
