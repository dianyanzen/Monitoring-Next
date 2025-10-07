"use client";
import Image from "next/image";
import { useState } from "react";

export default function LoginPage() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, pass: password }),
      });

      const data = await res.json();

      if (data.message_type === 1) {
        setMessage("✅ Login sukses, selamat datang " + data.user_name);
        // redirect ke dashboard
        window.location.href = "/dashboard";
      } else {
        setMessage("❌ " + data.message);
      }
    } catch (err) {
      setMessage("⚠️ Terjadi kesalahan koneksi.");
    }

    setLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#0b0b0d] text-white overflow-hidden">
      <Image
        src="/assets/plugins/images/login-register.jpg"
        alt="Background Login"
        fill
        className="object-cover opacity-40"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-[#0b0b0d]/95" />

      <div className="relative z-10 w-full max-w-md px-8 py-10 bg-black/60 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl">
        <div className="text-center mb-8">
          <Image
            src="/assets/plugins/images/LogoDIsduk1.png"
            alt="Disdukcapil Bandung"
            width={180}
            height={50}
            className="mx-auto"
          />
        </div>

        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Username"
          className="w-full mb-4 px-4 py-3 bg-[#121214] border border-gray-700 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full mb-6 px-4 py-3 bg-[#121214] border border-gray-700 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-md uppercase font-semibold tracking-wider transition-all disabled:opacity-60"
        >
          {loading ? "Memproses..." : "Log In"}
        </button>

        {message && (
          <p className="mt-4 text-center text-sm text-gray-300">{message}</p>
        )}

        <p className="text-center text-xs text-gray-500 mt-10">
          © 2025 Dinas Kependudukan dan Pencatatan Sipil Kota Bandung
        </p>
      </div>
    </div>
  );
}
