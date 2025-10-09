// File: src/app/setting/ChangePass/page.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Profile = {
  S_USER_ID?: string;
  S_NAMA_DPN?: string;
  S_NAMA_LGKP?: string;
  S_NIK?: string | number;
  S_JENIS_KLMIN?: string;
  S_TGL_LHR?: string;
  S_ALAMAT_RUMAH?: string;
  S_TELP?: string;
  S_NAMA_KANTOR?: string;
};

export default function AccountSettingPage() {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [oldPass, setOld] = useState("");
  const [newPass, setNew] = useState("");
  const [rePass, setRe] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/account/profile", { credentials: "include" });
        const j = await r.json();
        setUser(j?.data?.user || j?.user || null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setMsg(null);

    if (!oldPass || !newPass || !rePass) {
      setMsg({ type: "err", text: "Semua field wajib diisi." });
      return;
    }
    if (newPass.length < 6) {
      setMsg({ type: "err", text: "Password baru minimal 6 karakter." });
      return;
    }
    if (newPass !== rePass) {
      setMsg({ type: "err", text: "Konfirmasi password tidak sama." });
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/account/password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          old_password: oldPass,
          new_password: newPass,
          re_password: rePass,
        }),
      });
      const j = await r.json();
      if (r.ok && (j?.success || j?.data?.changed || j?.changed)) {
        setMsg({ type: "ok", text: "Password berhasil diubah." });
        setOld(""); setNew(""); setRe("");
      } else {
        setMsg({ type: "err", text: j?.message || "Gagal mengubah password." });
      }
    } catch (e: any) {
      setMsg({ type: "err", text: e?.message || "Gagal mengubah password." });
    } finally {
      setSubmitting(false);
    }
  };

  const avatar =
    user?.S_NIK ? `/assets/upload/pp/${user.S_NIK}.jpg` : "/assets/upload/pp/3273000000000000.jpg";

  return (
    <div className="relative px-6 md:px-8 py-6 text-gray-200 space-y-6">
      {/* CYBER AURA */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 right-1/4 w-[900px] h-[900px] rounded-full blur-[180px] bg-cyan-700/15 animate-pulse" />
        <div className="absolute -bottom-24 left-1/3 w-[800px] h-[800px] rounded-full blur-[180px] bg-fuchsia-600/15 animate-pulse" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-semibold tracking-wide">
          <span className="text-cyan-300">Account</span>{" "}
          <span className="text-fuchsia-300">Setting</span>
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PROFIL */}
        <div className="relative rounded-2xl border border-cyan-900/40 bg-gradient-to-b from-[#0b0c14]/90 to-[#0b0c14]/60 overflow-hidden">
          <div className="relative h-28 bg-[radial-gradient(1200px_300px_at_20%_-20%,rgba(34,211,238,0.35),transparent),radial-gradient(1200px_300px_at_80%_-20%,rgba(236,72,153,0.35),transparent)]">
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
          </div>

          <div className="px-5 pb-6 -mt-10">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Image
                  src={avatar}
                  alt="avatar"
                  width={86}
                  height={86}
                  unoptimized
                  className="rounded-full border-2 border-cyan-400/60 shadow-[0_0_20px_rgba(34,211,238,0.35)] bg-[#0b0c14] object-cover"
                />
                <span className="absolute -right-1 -bottom-1 w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              </div>
              <div>
                <div className="text-cyan-200 font-bold text-lg leading-tight">
                  {user?.S_NAMA_LGKP || (loading ? "Loading..." : "User")}
                </div>
                <div className="text-xs text-gray-400">{user?.S_NIK || "-"}</div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-cyan-900/40 bg-[#0f1020]/60 p-4">
              <div className="text-cyan-300 font-semibold mb-2">My User Control</div>
              <div className="space-y-1 text-sm">
                <Info label="Username" value={user?.S_USER_ID} />
                <Info label="Kantor" value={user?.S_NAMA_KANTOR} />
                <Info label="Telepon" value={user?.S_TELP} />
                <Info label="Alamat" value={user?.S_ALAMAT_RUMAH} />
                <Info label="Tanggal Lahir" value={user?.S_TGL_LHR} />
                <Info label="Jenis Kelamin" value={user?.S_JENIS_KLMIN} />
              </div>
            </div>
          </div>
        </div>

        {/* FORM PASSWORD */}
        <div className="lg:col-span-2 relative rounded-2xl border border-cyan-900/40 bg-gradient-to-b from-[#0b0c14]/90 to-[#0b0c14]/60 p-5">
          <div className="mb-5 border-b border-cyan-900/40 pb-3">
            <div className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
              <h2 className="text-cyan-300 font-semibold tracking-wide">Setting</h2>
            </div>
          </div>

          {loading ? (
            <SkeletonForm />
          ) : (
            <form onSubmit={onSubmit} className="max-w-xl space-y-5">
              <Field
                label="Old Password"
                type="password"
                value={oldPass}
                onChange={setOld}
                placeholder="Enter old password"
              />
              <Field
                label="New Password"
                type="password"
                value={newPass}
                onChange={setNew}
                placeholder="Enter new password"
              />
              <Field
                label="Re-Password"
                type="password"
                value={rePass}
                onChange={setRe}
                placeholder="Re-enter new password"
              />

              {msg && (
                <div
                  className={`text-sm px-3 py-2 rounded border ${
                    msg.type === "ok"
                      ? "bg-emerald-900/30 border-emerald-700/40 text-emerald-200"
                      : "bg-red-900/25 border-red-700/40 text-red-200"
                  }`}
                >
                  {msg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="relative inline-flex items-center gap-2 px-4 py-2 rounded-lg
                  bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white font-medium
                  ring-1 ring-cyan-400/30 shadow-[0_0_16px_rgba(34,211,238,0.35)] transition"
              >
                {submitting ? <Spinner /> : <SaveIcon />}
                <span>{submitting ? "Updating..." : "Update Password"}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 min-w-[110px]">{label} :</span>
      <span className="text-gray-200">{value || "-"}</span>
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-300 mb-1">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#0d0f1a] border border-cyan-900/50 rounded-lg px-3 py-2.5 text-gray-100
                     outline-none focus:border-cyan-400 ring-0 transition
                     placeholder:text-gray-500"
        />
        <div className="pointer-events-none absolute -inset-px rounded-lg opacity-30 bg-[conic-gradient(from_180deg_at_50%_50%,#22d3ee33_0deg,transparent_120deg,#ec489933_240deg,#22d3ee33_360deg)]" />
      </div>
    </div>
  );
}

function SkeletonForm() {
  return (
    <div className="max-w-xl space-y-5">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-28 bg-cyan-900/30 rounded" />
          <div className="h-10 w-full bg-cyan-900/20 rounded" />
        </div>
      ))}
      <div className="h-10 w-40 bg-cyan-900/30 rounded" />
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
      <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H7l-4 3V5a2 2 0 0 1 2-2h7" />
      <path d="M17 8l4-4M21 4l-7 7" />
    </svg>
  );
}
