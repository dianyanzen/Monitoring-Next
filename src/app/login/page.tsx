"use client";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";

export default function LoginPage() {
  const year = new Date().getFullYear();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ✨ Efek partikel neon dengan interaksi mouse
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mouse = { x: 0, y: 0 };
    let particles: { x: number; y: number; r: number; dx: number; dy: number; c: string }[] = [];
    const colors = ["#00ffff", "#ff00ff", "#0099ff", "#ff66cc"];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      particles = Array.from({ length: 70 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.6,
        dx: (Math.random() - 0.5) * 0.6,
        dy: (Math.random() - 0.5) * 0.6,
        c: colors[Math.floor(Math.random() * colors.length)],
      }));
    };

    const draw = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let p of particles) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          p.x += dx / dist * 1.2;
          p.y += dy / dist * 1.2;
        }

        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c + "55";
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.c;
        ctx.fill();
      }

      requestAnimationFrame(draw);
    };

    const move = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    resize();
    draw();
    canvas.addEventListener("mousemove", move);
    window.addEventListener("resize", resize);
    return () => {
      canvas.removeEventListener("mousemove", move);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // ⚡ Glow mengikuti pergerakan mouse
  useEffect(() => {
    const glow = document.createElement("div");
    glow.className =
      "pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,255,0.08)_0%,transparent_70%)] transition-all duration-100";
    document.body.appendChild(glow);

    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      glow.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(255,0,255,0.12) 0%, rgba(0,255,255,0.05) 70%)`;
    };

    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      glow.remove();
    };
  }, []);

  // 💥 Electric Pulse saat klik
  useEffect(() => {
    const createPulse = (x: number, y: number) => {
      const pulse = document.createElement("div");
      pulse.className =
        "fixed pointer-events-none rounded-full bg-gradient-to-r from-[#00ffffaa] to-[#ff00ffaa] blur-[2px]";
      pulse.style.left = `${x - 25}px`;
      pulse.style.top = `${y - 25}px`;
      pulse.style.width = "50px";
      pulse.style.height = "50px";
      pulse.style.transition = "transform 0.6s ease-out, opacity 0.8s ease-out";
      pulse.style.transform = "scale(0)";
      pulse.style.opacity = "1";
      document.body.appendChild(pulse);

      requestAnimationFrame(() => {
        pulse.style.transform = "scale(8)";
        pulse.style.opacity = "0";
      });

      setTimeout(() => pulse.remove(), 800);
    };

    const handleClick = (e: MouseEvent) => createPulse(e.clientX, e.clientY);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

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
      if (data.message_type === 1) {
        setMessage("✅ Login sukses, selamat datang " + data.user_name);
        window.location.href = "/dashboard";
      } else setMessage("❌ " + data.message);
    } catch {
      setMessage("⚠️ Terjadi kesalahan koneksi.");
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="flex min-h-screen">
      {/* === KIRI: Background penuh === */}
      <div className="relative flex-1 hidden md:block h-screen">
        <div className="absolute inset-0">
          <Image
            src="/assets/plugins/images/wallpaper.jpg"
            alt="MONALISA Background"
            fill
            sizes="100vw"
            priority
            className="object-cover object-center w-full h-full scale-[1.03]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(0,255,255,0.1)_50%,transparent_55%)] animate-[sweep_4s_linear_infinite]" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#00ffff15] via-transparent to-[#ff00ff15] mix-blend-screen pointer-events-none" />
          <div className="absolute inset-0 bg-[repeating-linear-gradient(transparent,rgba(255,255,255,0.02)_1px,transparent_2px)] opacity-20 pointer-events-none" />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          <div className="absolute left-6 bottom-6 text-xs tracking-widest text-gray-400/80">
            MONALISA · Cyber Secure Login
          </div>
        </div>
      </div>

      {/* === KANAN: Panel Hologram === */}
        <div className="absolute right-0 top-0 h-full w-full md:w-[460px] holo-panel flex items-center justify-center z-10 backdrop-blur-[6px]">
        <div className="w-full max-w-sm px-10 py-10 scale-[1.05]">

          <div className="text-center mb-10 flex flex-col items-center">
            <Image
              src="/assets/plugins/images/pemkot.png"
              alt="Logo Pemkot"
              width={350}
              height={350}
              className="mb-2"
            />
            <div className="glitchy">
              <Image
                src="/assets/plugins/images/LogoDisduk1.png"
                alt="Logo Disdukcapil Kota Bandung"
                width={380}
                height={260}
              />
            </div>
          </div>

          <div className="relative mb-4">
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={handleKeyDown}
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
              onKeyDown={handleKeyDown}
              placeholder="Password"
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md text-sm text-gray-800 
                         placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#ff00ff] focus:border-[#ff00ff] 
                         shadow-[0_0_10px_rgba(255,0,255,0.2)] focus:shadow-[0_0_20px_rgba(255,0,255,0.4)] transition-all"
            />
          </div>

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-[#00ffff] to-[#ff00ff] hover:from-[#ff00ff] hover:to-[#00ffff]
                       text-white rounded-md uppercase font-semibold tracking-wider shadow-[0_0_25px_rgba(0,255,255,0.4)] 
                       hover:shadow-[0_0_35px_rgba(255,0,255,0.5)] transition-all disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Log In"}
          </button>

          {message && <p className="mt-4 text-center text-sm text-gray-300 drop-shadow-[0_0_3px_rgba(0,255,255,0.4)]">{message}</p>}

          <p className="text-center text-xs text-gray-300 mt-10 drop-shadow-[0_0_3px_rgba(0,255,255,0.4)]">
            Copyright © {year} Dinas Kependudukan dan Pencatatan Sipil Kota Bandung
          </p>
        </div>
      </div>
    </div>
  );
}
