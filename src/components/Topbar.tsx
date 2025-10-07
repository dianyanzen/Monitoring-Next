"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import {
  LogOut,
  Settings,
  RefreshCcw,
  Menu,
  Mail,
  ChevronDown,
} from "lucide-react";

export default function Topbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const [user, setUser] = useState<any>(null);
  const [openUser, setOpenUser] = useState(false);
  const [openMail, setOpenMail] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith("session_user="));
    if (cookie) {
      try {
        const data = JSON.parse(decodeURIComponent(cookie.split("=")[1]));
        setUser(data);
      } catch {
        setUser(null);
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpenUser(false);
        setOpenMail(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="w-full fixed top-0 left-0 z-50 bg-gradient-to-r from-[#181832] to-[#25255a] border-b border-cyan-700/40 px-6 py-3 flex justify-between items-center shadow-lg backdrop-blur-md">
      {/* === Kiri === */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-md bg-cyan-600/20 hover:bg-cyan-600/40 transition-all border border-cyan-700/40 text-cyan-300"
          title="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold tracking-wide text-cyan-300 drop-shadow-sm">
          Monitoring Kota Bandung
        </h1>
      </div>

      {/* === Kanan === */}
      <div className="flex items-center gap-3 relative" ref={dropdownRef}>
        {/* Tombol Pesan */}
        <button
          onClick={() => {
            setOpenMail(!openMail);
            setOpenUser(false);
          }}
          className="relative p-2 bg-cyan-600/20 hover:bg-cyan-600/40 rounded-md border border-cyan-700/40 text-cyan-300 transition-all"
          title="Pesan"
        >
          <Mail className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        </button>

        {/* Dropdown Pesan */}
        {openMail && (
          <div className="absolute right-14 top-12 w-64 bg-[#101020] border border-cyan-700/40 text-gray-200 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden">
            <div className="px-4 py-3 text-sm text-center border-b border-cyan-800/40 font-semibold text-cyan-300">
              You Don’t Have Any Message
            </div>
            <button
              onClick={() => (window.location.href = "/Chat")}
              className="block w-full text-center px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-900/30 transition-colors"
            >
              Lihat Pesan Petugas →
            </button>
          </div>
        )}

        {/* Tombol Refresh */}
        <button
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600/90 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
          onClick={() => window.location.reload()}
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh Data
        </button>

        {/* Tombol User */}
        <button
          onClick={() => {
            setOpenUser(!openUser);
            setOpenMail(false);
          }}
          className="flex items-center gap-2 bg-[#1b1b3a] hover:bg-[#24244b] px-3 py-2 rounded-lg border border-cyan-700/40 transition-all"
        >
          <Image
            src={
              user?.S_NIK
                ? `/assets/upload/pp/${user.S_NIK}.jpg`
                : "/assets/plugins/images/calming-cat.gif"
            }
            alt="user"
            width={34}
            height={34}
            unoptimized
            className="rounded-full border border-cyan-400/60 object-cover"
            onError={(e) =>
              ((e.target as HTMLImageElement).src =
                "/assets/plugins/images/calming-cat.gif")
            }
          />
          <span className="hidden sm:block text-sm font-medium text-cyan-100">
            {user?.S_USER_ID || "Guest"}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-cyan-300 transition-transform ${
              openUser ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Dropdown User */}
        {openUser && (
          <div className="absolute right-0 top-14 w-64 bg-[#101020] border border-cyan-800/40 text-gray-200 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md">
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-[#1f1f3e] to-[#262654] border-b border-cyan-900/40">
              <Image
                src={
                  user?.S_NIK
                    ? `/assets/upload/pp/${user.S_NIK}.jpg`
                    : "/assets/plugins/images/calming-cat.gif"
                }
                alt="profile"
                width={45}
                height={45}
                className="rounded-full border border-cyan-400/40"
              />
              <div className="leading-tight">
                <h4 className="font-semibold text-cyan-300 text-sm">
                  {user?.S_NAMA_DPN || "User"}
                </h4>
                <p className="text-xs text-cyan-100/70">
                  {user?.S_NIK || "0000000000000000"}
                </p>
              </div>
            </div>

            <button
              onClick={() => (window.location.href = "/Activity/setting")}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-cyan-900/30 transition-colors"
            >
              <Settings className="w-4 h-4 text-cyan-400" />
              <span>Account Setting</span>
            </button>
            <button
              onClick={async () => {
                try {
                  const btn = document.activeElement as HTMLButtonElement;
                  btn.disabled = true;
                  btn.innerHTML = `
                    <svg class='w-4 h-4 text-gray-400 animate-spin' viewBox='0 0 24 24'>
                      <circle cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' fill='none' />
                    </svg>
                    <span class='text-gray-400 ml-2'>Logging out...</span>
                  `;

                  const res = await fetch("/api/logout", { method: "POST" });

                  if (res.ok) {
                    // Delay sedikit untuk transisi halus
                    setTimeout(() => {
                      window.location.href = "/login";
                    }, 400);
                  } else {
                    alert("Logout gagal. Silakan coba lagi.");
                    btn.disabled = false;
                    btn.innerHTML = `
                      <svg class='w-4 h-4 text-red-500' viewBox='0 0 24 24'>
                        <path fill='currentColor' d='M16 13v-2H7V8l-5 4l5 4v-3h9Z'/>
                      </svg>
                      <span class='text-red-400 ml-2'>Logout</span>
                    `;
                  }
                } catch (err) {
                  console.error("Logout error:", err);
                  alert("Terjadi kesalahan saat logout.");
                }
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24">
                <path fill="currentColor" d="M16 13v-2H7V8l-5 4l5 4v-3h9Z" />
              </svg>
              <span>Logout</span>
            </button>


          </div>
        )}
      </div>
    </header>
  );
}
