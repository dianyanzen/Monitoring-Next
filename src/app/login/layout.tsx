// FILE: src/app/login/layout.tsx
"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef } from "react";

// Layout ini hanya untuk route /login. Dia bikin hero kiri dan slot panel kanan (children).
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  // ====== Particles di hero kiri ======
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.dataset.theme || "dark";
    const hadDark = root.classList.contains("dark");

    root.dataset.theme = "dark";
    root.classList.add("dark");

    return () => {
      root.dataset.theme = previousTheme;
      if (!hadDark) {
        root.classList.remove("dark");
      }
    };
  }, []);

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
      for (const p of particles) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 100) {
          p.x += (dx / dist) * 1.2;
          p.y += (dy / dist) * 1.2;
        }
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c + "55";
        (ctx as any).shadowBlur = 10;
        (ctx as any).shadowColor = p.c;
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

  // ====== Glow mengikuti mouse (satu kali saja di layout) ======
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

  // ====== Electric pulse saat klik (sekali saja) ======
  useEffect(() => {
    const createPulse = (x: number, y: number) => {
      const el = document.createElement("div");
      el.className =
        "fixed pointer-events-none rounded-full bg-gradient-to-r from-[#00ffffaa] to-[#ff00ffaa] blur-[2px]";
      el.style.left = `${x - 25}px`;
      el.style.top = `${y - 25}px`;
      el.style.width = "50px";
      el.style.height = "50px";
      el.style.transition = "transform 0.6s ease-out, opacity 0.8s ease-out";
      el.style.transform = "scale(0)";
      el.style.opacity = "1";
      document.body.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transform = "scale(8)";
        el.style.opacity = "0";
      });
      setTimeout(() => el.remove(), 800);
    };
    const onClick = (e: MouseEvent) => createPulse(e.clientX, e.clientY);
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  return (
    <section className="relative flex min-h-[100svh] md:min-h-[100dvh] overflow-hidden text-gray-100 bg-[#0b0b0d]">
      <Image
        src="/assets/plugins/images/wallpaper.jpg"
        alt="MONALISA Background"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center w-full h-full scale-[1.03]"
      />
  {/* ===== KIRI: HERO GAMBAR ===== */}
    <div className="relative flex-1 hidden md:block min-h-[inherit]">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(0,255,255,0.1)_50%,transparent_55%)] animate-[sweep_4s_linear_infinite]" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#00ffff15] via-transparent to-[#ff00ff15] mix-blend-screen pointer-events-none" />
          <div className="absolute inset-0 bg-[repeating-linear-gradient(transparent,rgba(255,255,255,0.02)_1px,transparent_2px)] opacity-20 pointer-events-none" />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          <div className="absolute left-6 bottom-6 text-xs tracking-widest text-gray-400/80">
            MONALISA · Cyber Secure Login
          </div>
        </div>
      </div>

  {/* ===== KANAN: PANEL LOGIN ===== */}
    <div className="relative w-full md:w-[500px] holo-panel flex items-center justify-center z-10 backdrop-blur-[6px] min-h-[inherit]">
    {children}
  </div>
</section>

  );
}
