// FILE: src/app/setting/user/edit/[userId]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useSession } from "@/contexts/session";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";
import TypeableSelect from "@/components/ui/TypeableSelect";

type LevelOption = { user_level: string; level_name: string };
type Option = { value: string; label: string };
type WilayahOption = { no_prop: string; nama_prop?: string };
type KabOption = { no_kab: string; nama_kab: string };
type KecOption = { no_kec: string; nama_kec: string };
type KelOption = { no_kel: string; nama_kel: string };
type PejabatOption = { value: string; label: string; subtitle?: string };

type FormState = {
  user_id: string;
  nama_lgkp: string;
  nama_dpn: string;
  nik: string;
  tmpt_lhr: string;
  tgl_lhr: string;
  jenis_klmin: string;
  gol_drh: string;
  nama_kantor: string;
  alamat_kantor: string;
  telp: string;
  alamat_rumah: string;
  user_level: string;
  wilayah: { no_prop: string; no_kab: string; no_kec: string; no_kel: string; no_rw: string; no_rt: string };
  akun: { user_siak: string; user_bcard: string; user_benrol: string };
  flags: {
    is_monitoring: string;
    is_gisa: string;
    is_absen: string;
    is_asn: string;
    absensi_checking: string;
    is_active: string;
    ipaddress_check: string;
    is_show: string;
  };
  supervisors: { pejabat_satu: string; pejabat_dua: string };
};

const genderOptions: Option[] = [
  { value: "1", label: "Laki-laki" },
  { value: "2", label: "Perempuan" },
];

const bloodOptions: Option[] = [
  "1 - A",
  "2 - B",
  "3 - AB",
  "4 - O",
  "5 - A+",
  "6 - A-",
  "7 - B+",
  "8 - B-",
  "9 - AB+",
  "10 - AB-",
  "11 - O+",
  "12 - O-",
  "13 - Tidak Tahu",
].map((label, idx) => ({ value: String(idx + 1), label }));

const yesNoOptions: Option[] = [
  { value: "1", label: "YA" },
  { value: "0", label: "TIDAK" },
];

const initialFlags = {
  is_monitoring: "0",
  is_gisa: "0",
  is_absen: "0",
  is_asn: "0",
  absensi_checking: "0",
  is_active: "1",
  ipaddress_check: "0",
  is_show: "0",
};

type ModalState = { open: boolean; kind: ModalKind; title: string; message: string; goBack?: boolean };

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const userId = params?.userId ?? "";
  const { user } = useSession();

  const sessionDefaults = useMemo(() => ({
    no_prop: String((user as any)?.S_NO_PROP ?? "").padStart(2, "0"),
    no_kab: String((user as any)?.S_NO_KAB ?? "").padStart(2, "0"),
    no_kec: "",
    no_kel: "",
  }), [user]);

  const [form, setForm] = useState<FormState>({
    user_id: userId,
    nama_lgkp: "",
    nama_dpn: "",
    nik: "",
    tmpt_lhr: "",
    tgl_lhr: "",
    jenis_klmin: "1",
    gol_drh: "13",
    nama_kantor: "",
    alamat_kantor: "",
    telp: "",
    alamat_rumah: "",
    user_level: "",
    wilayah: { ...sessionDefaults, no_rw: "0", no_rt: "0" },
    akun: { user_siak: "", user_bcard: "", user_benrol: "" },
    flags: { ...initialFlags },
    supervisors: { pejabat_satu: "", pejabat_dua: "" },
  });

  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [provOptions, setProvOptions] = useState<WilayahOption[]>([]);
  const [kabOptions, setKabOptions] = useState<KabOption[]>([]);
  const [kecOptions, setKecOptions] = useState<KecOption[]>([]);
  const [kelOptions, setKelOptions] = useState<KelOption[]>([]);
  const [pejabatOptions, setPejabatOptions] = useState<PejabatOption[]>([]);
  const [loadingPejabat, setLoadingPejabat] = useState(true);
  const [pejabatError, setPejabatError] = useState<string | null>(null);

  const mergeSupervisorOption = useCallback((id?: string | null, name?: string | null) => {
    if (!id) return;
    setPejabatOptions((prev) => {
      if (prev.some((opt) => opt.value === id)) return prev;
      return [...prev, { value: id, label: name ?? id }];
    });
  }, []);

  const [loadingDetail, setLoadingDetail] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);

  /* Load list level */
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const res = await fetch("/api/setting/users/levels", { cache: "no-store", credentials: "include" });
        const json = await res.json();
        if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat level");
        if (!stop) setLevels(json?.data ?? []);
      } catch (e: any) {
        if (!stop) setNotice(e?.message || "Gagal memuat level user");
      }
    })();
    return () => { stop = true; };
  }, []);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        setLoadingPejabat(true);
        setPejabatError(null);
        const res = await fetch("/api/setting/pejabat?limit=200", { cache: "no-store", credentials: "include" });
        const json = await res.json();
        if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat daftar pejabat");
        if (stop) return;
        const rows = Array.isArray(json?.data?.rows)
          ? json.data.rows
          : Array.isArray(json?.rows)
          ? json.rows
          : [];
        const mapped = rows.map((item: any) => ({
          value: String(item.pejabat_id ?? item.PEJABAT_ID ?? ""),
          label: `${item.nama ?? item.NAMA ?? "-"} (${item.nip ?? item.NIP ?? "-"})`,
          subtitle: item.jabatan ?? item.JABATAN ?? "",
        }));
        setPejabatOptions((prev) => {
          const missing = prev.filter((opt) => !mapped.some((m) => m.value === opt.value));
          return [...mapped, ...missing];
        });
      } catch (e: any) {
        if (!stop) setPejabatError(e?.message || "Gagal memuat daftar pejabat");
      } finally {
        if (!stop) setLoadingPejabat(false);
      }
    })();
    return () => { stop = true; };
  }, []);

  async function fetchProvinsi() {
    const res = await fetch("/api/wilayah/provinsi", { cache: "no-store", credentials: "include" });
    const json = await res.json();
    if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat provinsi");
    setProvOptions(json?.data ?? []);
  }
  async function fetchKabupaten(noProp: string) {
    if (!noProp) { setKabOptions([]); return; }
    const res = await fetch(`/api/wilayah/kabupaten?no_prop=${encodeURIComponent(noProp)}`, { cache: "no-store", credentials: "include" });
    const json = await res.json();
    if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat kabupaten");
    setKabOptions(json?.data ?? []);
  }
  async function fetchKecamatan(noProp: string, noKab: string) {
    if (!noProp || !noKab) { setKecOptions([]); return; }
    const res = await fetch(`/api/wilayah/kecamatan?no_prop=${encodeURIComponent(noProp)}&no_kab=${encodeURIComponent(noKab)}`, { cache: "no-store", credentials: "include" });
    const json = await res.json();
    if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat kecamatan");
    setKecOptions(json?.data ?? []);
  }
  async function fetchKelurahan(noProp: string, noKab: string, noKec: string) {
    if (!noProp || !noKab || !noKec) { setKelOptions([]); return; }
    const res = await fetch(`/api/wilayah/kelurahan?no_prop=${encodeURIComponent(noProp)}&no_kab=${encodeURIComponent(noKab)}&no_kec=${encodeURIComponent(noKec)}`, { cache: "no-store", credentials: "include" });
    const json = await res.json();
    if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat kelurahan");
    setKelOptions(json?.data ?? []);
  }

  useEffect(() => {
    fetchProvinsi().catch((e) => setNotice(e?.message || "Gagal memuat provinsi"));
  }, []);

  /* Load detail user */
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        setLoadingDetail(true);
        const res = await fetch(`/api/setting/users/${encodeURIComponent(userId)}`, { cache: "no-store", credentials: "include" });
        const json = await res.json();
        if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memuat detail user");
        if (stop) return;
        const data = json?.data;
        setForm({
          user_id: data.user_id ?? userId,
          nama_lgkp: data.nama_lgkp ?? "",
          nama_dpn: data.nama_dpn ?? "",
          nik: data.nik ?? "",
          tmpt_lhr: data.tmpt_lhr ?? "",
          tgl_lhr: data.tgl_lhr ?? "",
          jenis_klmin: data.jenis_klmin ? String(data.jenis_klmin) : "1",
          gol_drh: data.gol_drh ? String(data.gol_drh) : "13",
          nama_kantor: data.nama_kantor ?? "",
          alamat_kantor: data.alamat_kantor ?? "",
          telp: data.telp ?? "",
          alamat_rumah: data.alamat_rumah ?? "",
          user_level: data.user_level ?? "",
          wilayah: {
            no_prop: data.wilayah?.no_prop ?? "",
            no_kab: data.wilayah?.no_kab ?? "",
            no_kec: data.wilayah?.no_kec ?? "",
            no_kel: data.wilayah?.no_kel ?? "",
            no_rw: data.wilayah?.no_rw ?? "0",
            no_rt: data.wilayah?.no_rt ?? "0",
          },
          akun: {
            user_siak: data.akun?.user_siak ?? "",
            user_bcard: data.akun?.user_bcard ?? "",
            user_benrol: data.akun?.user_benrol ?? "",
          },
          flags: {
            is_monitoring: data.flags?.is_monitoring ? "1" : "0",
            is_gisa: data.flags?.is_gisa ? "1" : "0",
            is_absen: data.flags?.is_absen ? "1" : "0",
            is_asn: data.flags?.is_asn ? "1" : "0",
            absensi_checking: data.flags?.absensi_checking ? "1" : "0",
            is_active: data.flags?.is_active ? "1" : "0",
            ipaddress_check: data.flags?.ipaddress_check ? "1" : "0",
            is_show: data.flags?.is_show ? "1" : "0",
          },
          supervisors: {
            pejabat_satu: data.supervisors?.pejabat_satu ?? "",
            pejabat_dua: data.supervisors?.pejabat_dua ?? "",
          },
        });
        mergeSupervisorOption(data.supervisors?.pejabat_satu ?? null, data.supervisors?.nama_satu ?? data.supervisors?.pejabat_satu ?? null);
        mergeSupervisorOption(data.supervisors?.pejabat_dua ?? null, data.supervisors?.nama_dua ?? data.supervisors?.pejabat_dua ?? null);
      } catch (e: any) {
        if (!stop) setNotice(e?.message || "Gagal memuat detail user");
      } finally {
        if (!stop) setLoadingDetail(false);
      }
    })();
    return () => { stop = true; };
  }, [userId, mergeSupervisorOption]);

  useEffect(() => {
    const { no_prop } = form.wilayah;
    if (!no_prop) { setKabOptions([]); setKecOptions([]); setKelOptions([]); return; }
    void fetchKabupaten(no_prop).catch((e) => setNotice(e?.message || "Gagal memuat kabupaten"));
  }, [form.wilayah.no_prop]);

  useEffect(() => {
    const { no_prop, no_kab } = form.wilayah;
    if (!no_kab) { setKecOptions([]); setKelOptions([]); return; }
    void fetchKecamatan(no_prop, no_kab).catch((e) => setNotice(e?.message || "Gagal memuat kecamatan"));
  }, [form.wilayah.no_prop, form.wilayah.no_kab]);

  useEffect(() => {
    const { no_prop, no_kab, no_kec } = form.wilayah;
    if (!no_kec) { setKelOptions([]); return; }
    void fetchKelurahan(no_prop, no_kab, no_kec).catch((e) => setNotice(e?.message || "Gagal memuat kelurahan"));
  }, [form.wilayah.no_prop, form.wilayah.no_kab, form.wilayah.no_kec]);

  const handleChange = (field: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };
  const handleWilayahChange = (field: keyof FormState["wilayah"]) => (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const value = e.target.value;
    setForm((prev) => {
      const wilayah = { ...prev.wilayah, [field]: value };
      if (field === "no_prop") {
        wilayah.no_kab = "";
        wilayah.no_kec = "";
        wilayah.no_kel = "";
      } else if (field === "no_kab") {
        wilayah.no_kec = "";
        wilayah.no_kel = "";
      } else if (field === "no_kec") {
        wilayah.no_kel = "";
      }
      return { ...prev, wilayah };
    });
  };
  const handleFlagsChange = (field: keyof FormState["flags"]) => (e: ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, flags: { ...prev.flags, [field]: value } }));
  };

  function handleBirthDateChange(e: ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 8);
    let masked = "";
    if (digits.length <= 2) {
      masked = digits;
    } else if (digits.length <= 4) {
      masked = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    } else {
      masked = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
    }
    setForm((prev) => ({ ...prev, tgl_lhr: masked }));
  }

  function validateForm(): string | null {
    const required = [
      ["Nama Lengkap", form.nama_lgkp],
      ["Nama Depan", form.nama_dpn],
      ["NIK", form.nik],
      ["Tempat Lahir", form.tmpt_lhr],
      ["Tanggal Lahir", form.tgl_lhr],
      ["Nama Kantor", form.nama_kantor],
      ["Alamat Kantor", form.alamat_kantor],
      ["Telepon", form.telp],
      ["Alamat Rumah", form.alamat_rumah],
      ["Level User", form.user_level],
      ["Provinsi", form.wilayah.no_prop],
      ["Kabupaten", form.wilayah.no_kab],
      ["Kecamatan", form.wilayah.no_kec],
      ["Kelurahan", form.wilayah.no_kel],
    ] as const;
    for (const [label, value] of required) {
      if (!value?.trim()) return `${label} wajib diisi`;
    }
    if (!/^\d{16}$/.test(form.nik)) return "NIK harus 16 digit";
    if (!/^\d{2}-\d{2}-\d{4}$/.test(form.tgl_lhr)) return "Tanggal lahir gunakan format DD-MM-YYYY";
    if (form.supervisors.pejabat_satu && form.supervisors.pejabat_satu === form.supervisors.pejabat_dua) {
      return "Atasan satu dan dua tidak boleh sama";
    }
    return null;
  }


    async function onSubmit() {
      const validation = validateForm();
      if (validation) {
        setModal({ open: true, kind: "warning", title: "Validasi", message: validation });
        return;
      }
      setSubmitting(true);
      try {
        const payload = {
          nama_lgkp: form.nama_lgkp.trim(),
          nama_dpn: form.nama_dpn.trim(),
          nik: form.nik.trim(),
          tmpt_lhr: form.tmpt_lhr.trim().toUpperCase(),
          tgl_lhr: form.tgl_lhr.trim(),
          jenis_klmin: Number(form.jenis_klmin),
          gol_drh: Number(form.gol_drh),
          nama_kantor: form.nama_kantor.trim().toUpperCase(),
          alamat_kantor: form.alamat_kantor.trim().toUpperCase(),
          telp: form.telp.trim(),
          alamat_rumah: form.alamat_rumah.trim().toUpperCase(),
          user_level: form.user_level,
          wilayah: { ...form.wilayah },
          akun: { ...form.akun },
          // kirim string "0"/"1" apa adanya, biar server yang convert
          flags: { ...form.flags },
          supervisors: { ...form.supervisors },
        };

        const res = await fetch(`/api/setting/users/${encodeURIComponent(userId)}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || json?.success === false) throw new Error(json?.message || "Gagal memperbarui user");
        setModal({
          open: true,
          kind: "success",
          title: "User diperbarui",
          message: `Data user ${userId} berhasil diperbarui.`,
          goBack: true,
        });
      } catch (e: any) {
        setModal({
          open: true,
          kind: "error",
          title: "Gagal menyimpan",
          message: e?.message || "Terjadi kesalahan saat menyimpan user",
        });
      } finally {
        setSubmitting(false);
      }
    }


  if (loadingDetail) {
    return (
      <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[8%] top-[-25%] h-[900px] w-[900px] rounded-full bg-cyan-500/20 blur-[220px]" />
          <div className="absolute right-[12%] bottom-[-30%] h-[900px] w-[900px] rounded-full bg-fuchsia-600/15 blur-[220px]" />
        </div>
        <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/85 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
          <div className="px-5 py-10">
            <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 px-6 py-10 text-center text-cyan-200/80">
              <div className="inline-flex items-center gap-2 text-sm">
                <Loader2 className="h-5 w-5 animate-spin" />
                Memuat data user...
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[8%] top-[-25%] h-[900px] w-[900px] rounded-full bg-cyan-500/20 blur-[220px]" />
        <div className="absolute right-[12%] bottom-[-30%] h-[900px] w-[900px] rounded-full bg-fuchsia-600/15 blur-[220px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/85 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        <header className="border-b border-cyan-900/50 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/setting/user")}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/40 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </button>
            <div className="flex items-center gap-3">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.4em] text-cyan-400/60">Setting — User</p>
                <h1 className="text-base font-semibold text-cyan-100">Edit User {userId}</h1>
              </div>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-cyan-200/80">
              <div className="rounded-full border border-cyan-500/30 px-3 py-1">
                Editor: {(user as any)?.S_NAMA_LGKP ?? (user as any)?.S_USER_ID ?? "-"}
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-6 px-5 py-6">
          {notice && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">{notice}</div>
          )}

          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyan-200/90">Data Pribadi</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="User ID">
                <input value={form.user_id} readOnly className="field-input uppercase bg-cyan-900/20" />
              </Field>
              <Field label="Nama Lengkap">
                <input
                  value={form.nama_lgkp}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, nama_lgkp: e.target.value.toUpperCase() }))
                  }
                  className="field-input uppercase"
                />
              </Field>
              <Field label="Nama Depan">
                <input
                  value={form.nama_dpn}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, nama_dpn: e.target.value.toUpperCase() }))
                  }
                  className="field-input uppercase"
                />
              </Field>
              <Field label="NIK">
                <input value={form.nik} onChange={(e) => setForm((prev) => ({ ...prev, nik: e.target.value.replace(/[^\d]/g, "").slice(0, 16) }))} maxLength={16} className="field-input" />
              </Field>
              <Field label="Tempat Lahir">
                <input
                  value={form.tmpt_lhr}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, tmpt_lhr: e.target.value.toUpperCase() }))
                  }
                  className="field-input uppercase"
                />
              </Field>
              <Field label="Tanggal Lahir (DD-MM-YYYY)">
                <input
                  value={form.tgl_lhr}
                  onChange={handleBirthDateChange}
                  className="field-input"
                  placeholder="31-12-1990"
                  maxLength={10}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Jenis Kelamin">
                <TypeableSelect value={form.jenis_klmin} onChange={handleChange("jenis_klmin")}>
                  {genderOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </TypeableSelect>
              </Field>
              <Field label="Golongan Darah">
                <TypeableSelect value={form.gol_drh} onChange={handleChange("gol_drh")}>
                  {bloodOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </TypeableSelect>
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyan-200/90">Informasi Kantor</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nama Kantor">
                <input
                  value={form.nama_kantor}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, nama_kantor: e.target.value.toUpperCase() }))
                  }
                  className="field-input uppercase"
                />
              </Field>
              <Field label="Telepon Kantor">
                <input value={form.telp} onChange={handleChange("telp")} className="field-input" />
              </Field>
              <Field label="Alamat Kantor" full>
                <textarea
                  value={form.alamat_kantor}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, alamat_kantor: e.target.value.toUpperCase() }))
                  }
                  className="field-input uppercase"
                  rows={2}
                />
              </Field>
              <Field label="Alamat Rumah" full>
                <textarea
                  value={form.alamat_rumah}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, alamat_rumah: e.target.value.toUpperCase() }))
                  }
                  className="field-input uppercase"
                  rows={2}
                />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyan-200/90">Level & Wilayah</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Level User">
                <TypeableSelect value={form.user_level} onChange={handleChange("user_level")}>
                  <option value="">-- Pilih Level --</option>
                  {levels.map((lvl) => (
                    <option key={lvl.user_level} value={lvl.user_level}>
                      {lvl.user_level} - {lvl.level_name}
                    </option>
                  ))}
                </TypeableSelect>
              </Field>
              <Field label="Provinsi">
                <TypeableSelect value={form.wilayah.no_prop} onChange={handleWilayahChange("no_prop")}>
                  <option value="">-- Pilih Provinsi --</option>
                  {provOptions.map((opt) => (
                    <option key={opt.no_prop} value={opt.no_prop}>
                      ({opt.no_prop}) {opt.nama_prop}
                    </option>
                  ))}
                </TypeableSelect>
              </Field>
              <Field label="Kab/Kota">
                <TypeableSelect value={form.wilayah.no_kab} onChange={handleWilayahChange("no_kab")}>
                  <option value="">-- Pilih Kab/Kota --</option>
                  {kabOptions.map((opt) => (
                    <option key={opt.no_kab} value={opt.no_kab}>
                      ({opt.no_kab}) {opt.nama_kab}
                    </option>
                  ))}
                </TypeableSelect>
              </Field>
              <Field label="Kecamatan">
                <TypeableSelect value={form.wilayah.no_kec} onChange={handleWilayahChange("no_kec")}>
                  <option value="">-- Pilih Kecamatan --</option>
                  {kecOptions.map((opt) => (
                    <option key={opt.no_kec} value={opt.no_kec}>
                      ({opt.no_kec}) {opt.nama_kec}
                    </option>
                  ))}
                </TypeableSelect>
              </Field>
              <Field label="Kelurahan">
                <TypeableSelect value={form.wilayah.no_kel} onChange={handleWilayahChange("no_kel")}>
                  <option value="">-- Pilih Kelurahan --</option>
                  {kelOptions.map((opt) => (
                    <option key={opt.no_kel} value={opt.no_kel}>
                      ({opt.no_kel}) {opt.nama_kel}
                    </option>
                  ))}
                </TypeableSelect>
              </Field>
              <Field label="RW">
                <input value={form.wilayah.no_rw} onChange={handleWilayahChange("no_rw")} className="field-input" />
              </Field>
              <Field label="RT">
                <input value={form.wilayah.no_rt} onChange={handleWilayahChange("no_rt")} className="field-input" />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyan-200/90">Akun Layanan</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Akun SIAK">
                <input value={form.akun.user_siak} onChange={(e) => setForm((prev) => ({ ...prev, akun: { ...prev.akun, user_siak: e.target.value } }))} className="field-input" />
              </Field>
              <Field label="Akun Biomorf Card">
                <input value={form.akun.user_bcard} onChange={(e) => setForm((prev) => ({ ...prev, akun: { ...prev.akun, user_bcard: e.target.value } }))} className="field-input" />
              </Field>
              <Field label="Akun Biomorf Enrol">
                <input value={form.akun.user_benrol} onChange={(e) => setForm((prev) => ({ ...prev, akun: { ...prev.akun, user_benrol: e.target.value } }))} className="field-input" />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyan-200/90">Pengaturan & Status</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {Object.entries(form.flags).map(([key, value]) => (
                <Field key={key} label={key.replace(/_/g, " ").toUpperCase()}>
                  <TypeableSelect value={value} onChange={handleFlagsChange(key as keyof FormState["flags"])}>
                    {yesNoOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </TypeableSelect>
                </Field>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyan-200/90">Pejabat Atasan</h2>
            {pejabatError ? <p className="mb-3 text-xs text-amber-300">{pejabatError}</p> : null}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Atasan Satu">
                <TypeableSelect
                  value={form.supervisors.pejabat_satu}
                  onChange={(e) => setForm((prev) => ({ ...prev, supervisors: { ...prev.supervisors, pejabat_satu: e.target.value } }))}
                 
                  disabled={loadingPejabat}
                >
                  <option value="">-- Pilih Atasan --</option>
                  {pejabatOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </TypeableSelect>
              </Field>
              <Field label="Atasan Dua">
                <TypeableSelect
                  value={form.supervisors.pejabat_dua}
                  onChange={(e) => setForm((prev) => ({ ...prev, supervisors: { ...prev.supervisors, pejabat_dua: e.target.value } }))}
                 
                  disabled={loadingPejabat}
                >
                  <option value="">-- Pilih Atasan --</option>
                  {pejabatOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </TypeableSelect>
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-cyan-900/40 pt-4">
            <button
              type="button"
              onClick={() => router.push("/setting/user")}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/40 px-5 py-2 text-sm text-cyan-100 hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              disabled={submitting}
            >
              <ArrowLeft className="h-4 w-4" />
              Batal
            </button>
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-5 py-2 text-sm font-semibold text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,.25)] hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Perubahan
            </button>
          </div>
        </div>
      </section>

      {modal && (
        <NeonModal
          open={modal.open}
          kind={modal.kind}
          title={modal.title}
          message={modal.message}
          onClose={() => {
            setModal(null);
            if (modal.goBack) router.push("/setting/user");
          }}
        />
      )}
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col ${full ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200/70">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}


