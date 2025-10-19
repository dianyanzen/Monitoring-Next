// FILE: src/app/login/LoginClient.tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import RouteChangeOverlay, { triggerRouteOverlay } from "@/components/system/RouteChangeOverlay";

type Props = { nextUrl: string; initialMsg?: string };

export default function LoginClient({ nextUrl, initialMsg = "" }: Props) {
  const router = useRouter();
  const year = new Date().getFullYear();

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(initialMsg);

  const handleLogin = async () => {
    if (!userId || !password) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, pass: password }),
      });
      const data = await res.json();
      if (data?.message_type === 1) {
        triggerRouteOverlay();
        router.replace(nextUrl || "/dashboard");
      } else {
        setMessage("❌ " + (data?.message || "Login gagal"));
      }
    } catch {
      setMessage("⚠️ Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      triggerRouteOverlay();
      handleLogin();
    }
  };

  return (
    <>
      <RouteChangeOverlay />

      <div className="w-full max-w-sm px-10 py-10 scale-[1.05]">
        <div className="text-center mb-10 flex flex-col items-center">
          <Image
            src="/assets/plugins/images/pemkot.png"
            alt="Logo Pemkot"
            width={350}
            height={350}
            className="mb-2"
            priority
          />
          <div className="glitchy">
            <Image
              src="/assets/plugins/images/logodisduk.png"
              alt="Logo Disdukcapil Kota Bandung"
              width={380}
              height={260}
              priority
            />
          </div>
        </div>

        <div className="relative mb-4">
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Username"
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md text-sm text-gray-800 
                       placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00ffff] focus:border-[#00ffff] 
                       shadow-[0_0_10px_rgba(0,255,255,0.2)] focus:shadow-[0_0_20px_rgba(0,255,255,0.4)] transition-all"
          />
        </div>

        <div className="relative mb-6">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Password"
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md text-sm text-gray-800 
                       placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#ff00ff] focus:border-[#ff00ff] 
                       shadow-[0_0_10px_rgba(255,0,255,0.2)] focus:shadow-[0_0_20px_rgba(255,0,255,0.4)] transition-all"
          />
        </div>

        <button
          type="button"
          data-overlay-on-click
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-[#00ffff] to-[#ff00ff] hover:from-[#ff00ff] hover:to-[#00ffff]
                     text-white rounded-md uppercase font-semibold tracking-wider shadow-[0_0_25px_rgba(0,255,255,0.4)] 
                     hover:shadow-[0_0_35px_rgba(255,0,255,0.5)] transition-all disabled:opacity-60"
        >
          {loading ? "Memproses..." : "Log In"}
        </button>

        {message && (
          <p className="mt-4 text-center text-sm text-gray-300 drop-shadow-[0_0_3px_rgba(0,255,255,0.4)]">
            {message}
          </p>
        )}

        <p className="text-center text-xs text-gray-300 mt-10 drop-shadow-[0_0_3px_rgba(0,255,255,0.4)]">
          Copyright © {year} Dinas Kependudukan dan Pencatatan Sipil Kota Bandung
        </p>
      </div>
    </>
  );
}
