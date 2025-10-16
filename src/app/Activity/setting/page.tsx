// FILE: src/app/Activity/setting/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, KeyRound, User as IconUser } from "lucide-react";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";

type Profile = {
  user_id: string | null;
  nama_lgkp: string | null;
  nik: string | null;
  tmpt_lhr: string | null;
  tgl_lhr: string | null;
  jenis_klmin: string | null;
  telp: string | null;
  user_siak: string | null;
  user_bcard: string | null;
  user_benrol: string | null;
};

export default function ActivitySettingPage() {
  // ---- state data ----
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // ---- state password ----
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [rePass, setRePass] = useState("");
  const [saving, setSaving] = useState(false);

  // ---- state modal (semua notif & konfirmasi) ----
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<ModalKind>("info");
  const [modalTitle, setModalTitle] = useState("Notification");
  const [modalMsg, setModalMsg] = useState("");
  const [modalOnYes, setModalOnYes] = useState<(() => void) | undefined>();

  // helpers modal
  function openAlert(kind: ModalKind, title: string, message: string) {
    setModalKind(kind);
    setModalTitle(title);
    setModalMsg(message);
    setModalOnYes(undefined);
    setModalOpen(true);
  }
  function openConfirm(title: string, message: string, onYes: () => void) {
    setModalKind("confirm");
    setModalTitle(title);
    setModalMsg(message);
    setModalOnYes(() => onYes);
    setModalOpen(true);
  }

  // fetch profil dari API (pakai session S_USER_ID)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/user", { cache: "no-store" });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.message || "fetch failed");
        if (alive) setProfile(j.data as Profile);
      } catch (e: any) {
        if (alive) openAlert("error", "Error", e?.message || "Gagal memuat profil");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // avatar dari NIK (fall back ke default)
  const avatarSrc = useMemo(() => {
    const nik = profile?.nik?.toString().trim();
    return nik ? `/assets/upload/pp/${nik}.jpg` : "/assets/upload/pp/3273000000000000.jpg";
  }, [profile?.nik]);

  // validasi + buka modal confirm
  function handleTryUpdate() {
    if (!oldPass) return openAlert("warning", "Warning!", "Old Password Cannot Be Empty !");
    if (!newPass) return openAlert("warning", "Warning!", "New Password Cannot Be Empty !");
    if (!rePass) return openAlert("warning", "Warning!", "Re Password Cannot Be Empty !");
    if (newPass.length <= 3)
      return openAlert("warning", "Warning!", "New Password Too Short, We Need More Complex !");
    if (rePass.length <= 3)
      return openAlert("warning", "Warning!", "Re Password Too Short, We Need More Complex !");
    if (newPass !== rePass)
      return openAlert("warning", "Warning!", "New Password And Re Password Doesn't Match !");
    openConfirm("Are you sure?", "Anda akan memperbarui password akun ini.", onUpdatePassword);
  }

  // eksekusi simpan (dipanggil dari modal confirm)
  async function onUpdatePassword() {
    setModalOpen(false);
    setSaving(true);
    try {
      const res = await fetch("/api/activity/do_save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          old_password: oldPass,
          new_password: newPass,
        }),
      });
      const data = await res.json();
      if (data.message_type > 0) {
        setOldPass("");
        setNewPass("");
        setRePass("");
        openAlert("success", "Success", data.message || "Password updated ✔");
      } else {
        openAlert("error", "Failed", data.message || "Update failed");
      }
    } catch {
      openAlert("error", "Error", "Ooops! Please Try Again, Something Went Wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative px-8 pb-8 pt-6 md:pt-8 text-gray-200 space-y-8 mt-5">
      {/* Ambient Background */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/3 w-[800px] h-[800px] bg-cyan-500/20 blur-[160px] rounded-full animate-pulse-slow" />
        <div className="absolute bottom-0 right-1/3 w-[700px] h-[700px] bg-fuchsia-600/10 blur-[140px] rounded-full animate-pulse-slow" />
      </div>

      {/* Frame */}
      <div className="space-y-1 mb-2 rounded-2xl border border-cyan-700/40 bg-[#0b0b1a]/80 backdrop-blur-xl shadow-[0_0_25px_#00ffff33,0_0_60px_#ff00ff11_inset] overflow-hidden">
        <HeaderBar title="ACCOUNT SETTING" />

        <div className="grid grid-cols-1 lg:grid-cols-[480px_1fr] gap-6 p-6">
          {/* LEFT */}
          <div className="space-y-6">
            <UserBanner
              name={profile?.nama_lgkp || "User"}
              sub="DINAS KEPENDUDUKAN DAN PENCATATAN SIPIL KOTA BANDUNG"
              src={avatarSrc}
              fallback="/assets/upload/pp/3273000000000000.jpg"
            />
            <Card className="shadow-[0_0_16px_#00ffff22_inset]">
              <SectionTitle title="My User Control" />
              {loading ? (
                <div className="text-sm text-cyan-300/80">Loading profile…</div>
              ) : !profile ? (
                <div className="text-sm text-red-300/80">Profile not found.</div>
              ) : (
                <div className="space-y-3">
                  {profile.nama_lgkp && (
                    <div className="text-cyan-300 font-semibold">{profile.nama_lgkp}</div>
                  )}
                  <div className="text-[13px] text-cyan-200/90 font-semibold">My Profile</div>

                  {profile.user_id && <Field label="Username" value={profile.user_id} />}
                  {profile.nik && <Field label="NIK" value={profile.nik} />}
                  {profile.jenis_klmin && <Field label="Jenis Kelamin" value={profile.jenis_klmin} />}
                  {profile.tmpt_lhr && <Field label="Tempat Lahir" value={profile.tmpt_lhr} />}
                  {profile.tgl_lhr && <Field label="Tanggal Lahir" value={profile.tgl_lhr} />}
                  {profile.telp && <Field label="Telephone" value={profile.telp} />}
                  {profile.user_siak && <Field label="User Siak" value={profile.user_siak} />}
                  {profile.user_bcard && <Field label="User Bcard" value={profile.user_bcard} />}
                  {profile.user_benrol && <Field label="User Benrol" value={profile.user_benrol} />}
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT */}
          <Card className="shadow-[0_0_16px_#ff00ff22_inset]">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-5 h-5 text-cyan-300" />
              <h2 className="text-[15px] font-semibold text-cyan-200">Setting</h2>
            </div>
            <Divider />

            <FormRow label="Old Password">
              <InputPassword value={oldPass} onChange={(e) => setOldPass(e.target.value)} />
            </FormRow>

            <FormRow label="New Password">
              <InputPassword value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            </FormRow>

            <FormRow label="Re-Password">
              <InputPassword value={rePass} onChange={(e) => setRePass(e.target.value)} />
            </FormRow>

            <div className="pt-4">
              <button
                type="button"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-400/40 text-cyan-100 text-sm shadow-[0_0_14px_#00ffff66] transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/60 disabled:opacity-60"
                onClick={handleTryUpdate}
              >
                <KeyRound className="w-4 h-4" />
                {saving ? "Updating…" : "Update Password"}
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Modal serbaguna (warning/error/success/confirm) */}
      <NeonModal
        open={modalOpen}
        kind={modalKind}
        title={modalTitle}
        message={modalMsg}
        confirmText={modalKind === "confirm" ? "Yes, update" : "OK"}
        cancelText="No"
        loading={saving && modalKind === "confirm"}
        onConfirm={modalOnYes}
        onClose={() => !saving && setModalOpen(false)}
      />
    </div>
  );
}

/* =============== components =============== */

function HeaderBar({ title }: { title: string }) {
  return (
    <div className="px-6 py-4 border-b border-cyan-800/40 flex items-center gap-3">
      <IconUser className="w-5 h-5 text-cyan-300" />
      <h1 className="text-sm md:text-base font-semibold tracking-wide text-cyan-200">{title}</h1>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-cyan-800/40 bg-[#0e0e1c]/70 p-6 ${className}`}>
      {children}
    </section>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[15px] font-semibold text-cyan-200">{title}</h2>
      <div className="mt-2 h-[1px] w-full bg-gradient-to-r from-cyan-500/60 via-pink-400/40 to-transparent" />
    </div>
  );
}

function Divider() {
  return <div className="my-3 h-px bg-cyan-900/40" />;
}

function Field({ label, value }: { label: string | number; value: string | number }) {
  return (
    <div className="grid grid-cols-[140px_1fr] text-sm">
      <span className="text-cyan-300/90">{label} :</span>
      <span className="text-cyan-100/90">{value}</span>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-3 py-2 items-center">
      <label className="text-sm text-cyan-200/90">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function InputPassword(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="password"
      placeholder="•••••••••••"
      {...props}
      className={`w-full bg-transparent border border-cyan-800/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20 ${props.className ?? ""}`}
    />
  );
}

function UserBanner({
  name,
  sub,
  src,
  fallback,
}: {
  name: string;
  sub: string;
  src: string;
  fallback: string;
}) {
  return (
    <section className="relative rounded-2xl overflow-hidden border border-cyan-800/40">
      <div className="h-44 bg-[radial-gradient(60%_70%_at_30%_30%,#162a41_0%,transparent_70%),radial-gradient(60%_70%_at_75%_60%,#3a1d5a_0%,transparent_65%)]" />
      <div className="absolute inset-0 opacity-30 bg-[url('/noise.svg')] bg-cover" />
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-cyan-400 via-pink-400 to-cyan-400 opacity-70" />

      <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="avatar"
          className="w-28 h-28 rounded-full object-cover border-2 border-cyan-300 shadow-[0_0_25px_#00ffff66]"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = fallback;
          }}
        />
        <div className="mt-3 text-center">
          <div className="text-cyan-200 font-semibold tracking-wide">{name}</div>
          <div className="text-[12px] text-cyan-100/70">{sub}</div>
        </div>
      </div>
    </section>
  );
}
