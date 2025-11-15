// FILE: src/app/setting/user/add/page.tsx
"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useSession } from "@/contexts/session";
import NeonModal, { type ModalKind } from "@/components/ui/NeonModal";

/* ===== Types ===== */

type LevelGroupOption = { level_code: string; level_name: string }; // 1/2/3
type LevelOption = { user_level: string; level_name: string };

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

  level_group: string; // 1/2/3
  user_level: string; // kode level (mis. 5)

  wilayah: {
    no_prop: string;
    no_kab: string;
    no_kec: string;
    no_kel: string;
    no_rw: string;
    no_rt: string;
  };
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
  password: string;
  re_password: string;
};

type UserIdStatus =
  | { state: "idle"; message?: string; checkedValue?: string }
  | { state: "checking"; message?: string; checkedValue?: string }
  | { state: "available" | "exists" | "error"; message: string; checkedValue?: string };

/* ===== Static options ===== */

const genderOptions = [
  { value: "1", label: "Laki-laki" },
  { value: "2", label: "Perempuan" },
];

const bloodOptions = [
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
  "13 - TIDAK TAHU",
].map((label, idx) => ({ value: String(idx + 1), label }));

const yesNoOptions = [
  { value: "1", label: "YA" },
  { value: "0", label: "TIDAK" },
];

const initialFlags: FormState["flags"] = {
  is_monitoring: "0",
  is_gisa: "0",
  is_absen: "0",
  is_asn: "0",
  absensi_checking: "0",
  is_active: "1",
  ipaddress_check: "0",
  is_show: "0",
};

/* ===== Helpers ===== */

// Fleksibel membaca bentuk response API: {data:[]}, {rows:[]}, {data:{rows:[]}}, atau langsung array
function pickRows<T = unknown>(json: any): T[] {
  if (!json) return [];
  if (Array.isArray(json)) return json as T[];
  if (Array.isArray(json.data)) return json.data as T[];
  if (Array.isArray(json.rows)) return json.rows as T[];
  if (json.data && Array.isArray(json.data.rows)) return json.data.rows as T[];
  return [];
}

type ModalState = {
  open: boolean;
  kind: ModalKind;
  title: string;
  message: string;
  goBack?: boolean;
};

/* ===== Component ===== */

export default function AddUserPage() {
  const router = useRouter();
  const { user } = useSession();

  const [form, setForm] = useState<FormState>({
    user_id: "",
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
    level_group: "",
    user_level: "",
    wilayah: {
      no_prop: "",
      no_kab: "",
      no_kec: "",
      no_kel: "",
      no_rw: "0",
      no_rt: "0",
    },
    akun: { user_siak: "", user_bcard: "", user_benrol: "" },
    flags: { ...initialFlags },
    supervisors: { pejabat_satu: "", pejabat_dua: "" },
    password: "",
    re_password: "",
  });

  const [levelGroups, setLevelGroups] = useState<LevelGroupOption[]>([]);
  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [provOptions, setProvOptions] = useState<WilayahOption[]>([]);
  const [kabOptions, setKabOptions] = useState<KabOption[]>([]);
  const [kecOptions, setKecOptions] = useState<KecOption[]>([]);
  const [kelOptions, setKelOptions] = useState<KelOption[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [pejabatOptions, setPejabatOptions] = useState<PejabatOption[]>([]);
  const [loadingPejabat, setLoadingPejabat] = useState(true);
  const [userIdStatus, setUserIdStatus] = useState<UserIdStatus>({ state: "idle" });

  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // --- meta group: 1=KAB,2=KEC,3=KEL ------------------------
  const levelMeta = useMemo(() => {
    const code = form.level_group;
    return {
      isKab: code === "1",
      isKec: code === "2",
      isKel: code === "3",
    };
  }, [form.level_group]);

  const { isKab, isKec, isKel } = levelMeta;

  /* ===== Default wilayah dari session ===== */

  useEffect(() => {
    const noPropRaw = (user as any)?.S_NO_PROP ?? "";
    const noKabRaw = (user as any)?.S_NO_KAB ?? "";
    const noProp = String(noPropRaw || "").padStart(2, "0");
    const noKab = String(noKabRaw || "").padStart(2, "0");
    if (!noProp || !noKab) return;

    setForm((prev) => ({
      ...prev,
      wilayah: {
        ...prev.wilayah,
        no_prop: prev.wilayah.no_prop || noProp,
        no_kab: prev.wilayah.no_kab || noKab,
      },
    }));
  }, [user]);

  /* ===== Level User (group 1/2/3) ===== */

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const res = await fetch("/api/setting/get_group", {
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok || json?.success === false) {
          throw new Error(json?.message || "Gagal memuat Level User");
        }

        const rows = pickRows<LevelGroupOption>(json);
        if (stop) return;

        setLevelGroups(rows);
        setForm((prev) => {
          if (prev.level_group) return prev;
          const first = rows[0];
          return {
            ...prev,
            level_group: first ? String(first.level_code) : "",
          };
        });
      } catch (e: any) {
        if (!stop) setNotice(e?.message || "Gagal memuat Level User");
      }
    })();

    return () => {
      stop = true;
    };
  }, []);

  /* ===== Group User (SIAK_USER_LEVEL) per Level User ===== */

    useEffect(() => {
    const group = form.level_group;
    if (!group) {
      setLevels([]);
      setForm((prev) => ({ ...prev, user_level: "" }));
      return;
    }

    let stop = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/setting/users/levels?group=${encodeURIComponent(group)}`,
          { cache: "no-store", credentials: "include" }
        );
        const json = await res.json();
        if (!res.ok || json?.success === false) {
          throw new Error(json?.message || "Gagal memuat Group User");
        }

        const rows = pickRows<LevelOption>(json);
        if (stop) return;

        setLevels(rows);
        // ⬇️ RESET SELALU SAAT LEVEL USER BERGANTI
        setForm((prev) => ({
          ...prev,
          user_level: rows[0]?.user_level ?? "",
        }));
      } catch (e: any) {
        if (!stop) setNotice(e?.message || "Gagal memuat Group User");
      }
    })();

    return () => {
      stop = true;
    };
  }, [form.level_group]);

  // Reset status cek user ID kalau field berubah
  useEffect(() => {
    setUserIdStatus((prev) => (prev.state === "idle" ? prev : { state: "idle" }));
  }, [form.user_id]);

  /* ===== Pejabat Atasan ===== */

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        setLoadingPejabat(true);
        const res = await fetch("/api/setting/pejabat?limit=200", {
          cache: "no-store",
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok || json?.success === false) {
          throw new Error(json?.message || "Gagal memuat daftar pejabat");
        }
        if (stop) return;

        const rows = pickRows<any>(json);
        const options: PejabatOption[] = rows.map((item: any) => ({
          value: String(item.pejabat_id ?? item.PEJABAT_ID ?? ""),
          label: `${item.nama ?? item.NAMA ?? "-"} (${item.nip ?? item.NIP ?? "-"})`,
          subtitle: item.jabatan ?? item.JABATAN ?? "",
        }));

        setPejabatOptions(options);
        setForm((prev) => {
          const pejabat_satu =
            prev.supervisors.pejabat_satu || (options[0]?.value ?? "");
          const pejabat_dua =
            prev.supervisors.pejabat_dua || (options[1]?.value ?? "");
          return {
            ...prev,
            supervisors: { pejabat_satu, pejabat_dua },
          };
        });
      } catch (e: any) {
        if (!stop) setNotice(e?.message || "Gagal memuat daftar pejabat");
      } finally {
        if (!stop) setLoadingPejabat(false);
      }
    })();

    return () => {
      stop = true;
    };
  }, []);

  /* ===== Wilayah: Prov/Kab/Kec/Kel ===== */

  async function fetchProvinsi() {
    const res = await fetch("/api/wilayah/provinsi", {
      cache: "no-store",
      credentials: "include",
    });
    const json = await res.json();
    if (!res.ok || json?.success === false) {
      throw new Error(json?.message || "Gagal memuat provinsi");
    }
    setProvOptions(pickRows<WilayahOption>(json));
  }

  async function fetchKabupaten(noProp: string) {
    if (!noProp) {
      setKabOptions([]);
      return;
    }
    const res = await fetch(
      `/api/wilayah/kabupaten?no_prop=${encodeURIComponent(noProp)}`,
      { cache: "no-store", credentials: "include" }
    );
    const json = await res.json();
    if (!res.ok || json?.success === false) {
      throw new Error(json?.message || "Gagal memuat kabupaten");
    }
    setKabOptions(pickRows<KabOption>(json));
  }

  async function fetchKecamatan(noProp: string, noKab: string) {
    if (!noProp || !noKab) {
      setKecOptions([]);
      return;
    }
    const res = await fetch(
      `/api/wilayah/kecamatan?no_prop=${encodeURIComponent(
        noProp
      )}&no_kab=${encodeURIComponent(noKab)}`,
      { cache: "no-store", credentials: "include" }
    );
    const json = await res.json();
    if (!res.ok || json?.success === false) {
      throw new Error(json?.message || "Gagal memuat kecamatan");
    }
    setKecOptions(pickRows<KecOption>(json));
  }

  async function fetchKelurahan(noProp: string, noKab: string, noKec: string) {
    if (!noProp || !noKab || !noKec) {
      setKelOptions([]);
      return;
    }
    const res = await fetch(
      `/api/wilayah/kelurahan?no_prop=${encodeURIComponent(
        noProp
      )}&no_kab=${encodeURIComponent(noKab)}&no_kec=${encodeURIComponent(noKec)}`,
      { cache: "no-store", credentials: "include" }
    );
    const json = await res.json();
    if (!res.ok || json?.success === false) {
      throw new Error(json?.message || "Gagal memuat kelurahan");
    }
    setKelOptions(pickRows<KelOption>(json));
  }

  // initial provinsi
  useEffect(() => {
    setLoadingLocation(true);
    fetchProvinsi()
      .catch((e: any) => setNotice(e?.message || "Gagal memuat provinsi"))
      .finally(() => setLoadingLocation(false));
  }, []);

  // kabupaten by prov
  useEffect(() => {
    const { no_prop } = form.wilayah;
    if (!no_prop) {
      setKabOptions([]);
      setKecOptions([]);
      setKelOptions([]);
      return;
    }
    void fetchKabupaten(no_prop).catch((e) =>
      setNotice(e?.message || "Gagal memuat kabupaten")
    );
  }, [form.wilayah.no_prop]);

  // kecamatan by kab
  useEffect(() => {
    const { no_prop, no_kab } = form.wilayah;
    if (!no_kab) {
      setKecOptions([]);
      setKelOptions([]);
      return;
    }
    void fetchKecamatan(no_prop, no_kab).catch((e) =>
      setNotice(e?.message || "Gagal memuat kecamatan")
    );
  }, [form.wilayah.no_kab, form.wilayah.no_prop]);

  // kelurahan by kec
  useEffect(() => {
    const { no_prop, no_kab, no_kec } = form.wilayah;
    if (!no_kec) {
      setKelOptions([]);
      return;
    }
    void fetchKelurahan(no_prop, no_kab, no_kec).catch((e) =>
      setNotice(e?.message || "Gagal memuat kelurahan")
    );
  }, [form.wilayah.no_kec, form.wilayah.no_kab, form.wilayah.no_prop]);

  /* ===== Handlers ===== */

  const handleChange =
    (field: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleWilayahChange =
    (field: keyof FormState["wilayah"]) =>
    (e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      const value = e.target.value;
      setForm((prev) => {
        const wilayah = { ...prev.wilayah, [field]: value };

        // Reset hirarki ke bawah
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

        // RW/RT default 0
        wilayah.no_rw = "0";
        wilayah.no_rt = "0";
        return { ...prev, wilayah };
      });
    };

  const handleFlagsChange =
    (field: keyof FormState["flags"]) =>
    (e: ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, flags: { ...prev.flags, [field]: value } }));
    };

  function handleBirthDateChange(e: ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 8);
    let masked = "";
    if (digits.length <= 2) masked = digits;
    else if (digits.length <= 4) masked = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    else masked = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
    setForm((prev) => ({ ...prev, tgl_lhr: masked }));
  }

  /* ===== Cek ketersediaan User ID ===== */

  async function runUserIdAvailability() {
    const val = form.user_id.trim();
    if (!val) {
      setUserIdStatus({ state: "error", message: "User ID wajib diisi" });
      return false;
    }
    setUserIdStatus({ state: "checking", checkedValue: val });
    try {
      const res = await fetch(
        `/api/setting/users/check?user_id=${encodeURIComponent(val)}`,
        {
          cache: "no-store",
          credentials: "include",
        }
      );
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Gagal mengecek User ID");
      }
      const payload = json.data ?? json;
      const exists = Number(payload?.is_exists ?? 0) === 1;
      setUserIdStatus({
        state: exists ? "exists" : "available",
        message: exists
          ? `User ID ${val} sudah dipakai${
              payload?.nama_lgkp ? ` oleh ${payload.nama_lgkp}` : ""
            }`
          : `User ID ${val} tersedia`,
        checkedValue: val,
      });
      return !exists;
    } catch (e: any) {
      setUserIdStatus({
        state: "error",
        message: e?.message || "Gagal mengecek User ID",
        checkedValue: val,
      });
      return false;
    }
  }

  async function ensureUserIdAvailable() {
    if (
      userIdStatus.state === "available" &&
      userIdStatus.checkedValue === form.user_id.trim()
    ) {
      return true;
    }
    return runUserIdAvailability();
  }

  /* ===== Validasi form ===== */

  function validateForm(): string | null {
    const requiredBase = [
      ["User ID", form.user_id],
      ["Nama Lengkap", form.nama_lgkp],
      ["Nama Depan", form.nama_dpn],
      ["NIK", form.nik],
      ["Tempat Lahir", form.tmpt_lhr],
      ["Tanggal Lahir", form.tgl_lhr],
      ["Telepon", form.telp],
      ["Nama Kantor", form.nama_kantor],
      ["Alamat Kantor", form.alamat_kantor],
      ["Alamat Rumah", form.alamat_rumah],
      ["Level User", form.level_group],
      ["Group User", form.user_level],
      ["Provinsi", form.wilayah.no_prop],
      ["Kabupaten", form.wilayah.no_kab],
    ] as const;

    for (const [label, value] of requiredBase) {
      if (!value?.toString().trim()) return `${label} wajib diisi`;
    }

    if (isKec || isKel) {
      if (!form.wilayah.no_kec.trim()) return "Kecamatan wajib diisi";
    }
    if (isKel) {
      if (!form.wilayah.no_kel.trim()) return "Kelurahan wajib diisi";
    }

    if (!/^\d{16}$/.test(form.nik)) return "NIK harus 16 digit";
    if (!/^\d{2}-\d{2}-\d{4}$/.test(form.tgl_lhr)) {
      return "Tanggal lahir gunakan format DD-MM-YYYY";
    }

    if (form.password.length < 4) return "Password minimal 4 karakter";
    if (form.password !== form.re_password) {
      return "Password dan Re-Password tidak sama";
    }

    if (
      form.supervisors.pejabat_satu &&
      form.supervisors.pejabat_satu === form.supervisors.pejabat_dua
    ) {
      return "Atasan satu dan dua tidak boleh sama";
    }

    return null;
  }

  /* ===== Submit ===== */

  async function onSubmit() {
    const validation = validateForm();
    if (validation) {
      setModal({
        open: true,
        kind: "warning",
        title: "Validasi",
        message: validation,
      });
      return;
    }

    const available = await ensureUserIdAvailable();
    if (!available) return;

    setSubmitting(true);
    try {
      const payload = {
        user_id: form.user_id.trim(),
        nama_lgkp: form.nama_lgkp.trim(),
        nama_dpn: form.nama_dpn.trim(),
        nik: form.nik.trim(),
        tmpt_lhr: form.tmpt_lhr.trim(),
        tgl_lhr: form.tgl_lhr.trim(),
        jenis_klmin: Number(form.jenis_klmin),
        gol_drh: Number(form.gol_drh),
        nama_kantor: form.nama_kantor.trim(),
        alamat_kantor: form.alamat_kantor.trim(),
        telp: form.telp.trim(),
        alamat_rumah: form.alamat_rumah.trim(),

        level_group: form.level_group,
        user_level: form.user_level,

        wilayah: {
          ...form.wilayah,
          no_rw: "0",
          no_rt: "0",
        },
        akun: { ...form.akun },
        // flags dikirim sebagai boolean → backend yang mengubah ke 0/1
        flags: Object.fromEntries(
          Object.entries(form.flags).map(([k, v]) => [k, v === "1"])
        ) as Record<string, boolean>,
        supervisors: { ...form.supervisors },
        new_password: form.password,
      };

      const res = await fetch("/api/setting/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "Gagal menambah user");
      }

      setModal({
        open: true,
        kind: "success",
        title: "User berhasil dibuat",
        message:
          json?.message ??
          `User ${form.user_id} berhasil dibuat. Password awal: ${
            json?.data?.default_password ?? form.password
          }`,
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

  /* ===== Render ===== */

  return (
    <div className="relative mt-5 space-y-8 px-4 pb-12 pt-6 sm:px-6 md:px-8 md:pt-8">
      {/* neon background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[8%] top-[-25%] h-[900px] w-[900px] rounded-full bg-cyan-500/20 blur-[220px]" />
        <div className="absolute right-[12%] bottom-[-30%] h-[900px] w-[900px] rounded-full bg-fuchsia-600/15 blur-[220px]" />
      </div>

      <section className="rounded-3xl border border-cyan-800/40 bg-[#0b0b1a]/85 shadow-[0_0_34px_#00ffff22] backdrop-blur-xl">
        {/* header */}
        <header className="flex flex-wrap items-center gap-3 border-b border-cyan-900/50 px-5 py-4">
          <button
            type="button"
            onClick={() => router.push("/setting/user")}
            className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/40 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </button>
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-[0.4em] text-cyan-400/60">
              Setting User
            </p>
            <h1 className="text-base font-semibold text-cyan-100">
              Tambah User Baru
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-cyan-200/80">
            <span className="rounded-full border border-cyan-500/30 px-3 py-1">
              Creator:{" "}
              {(user as any)?.S_NAMA_LGKP ??
                (user as any)?.S_USER_ID ??
                "-"}
            </span>
          </div>
        </header>

        <div className="space-y-6 px-5 py-6">
          {notice && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-100">
              {notice}
            </div>
          )}

          {/* Data Pribadi */}
          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyan-200/90">
              Data Pribadi
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="User ID">
                <div className="flex gap-2">
                  <input
                    value={form.user_id}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        user_id: e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, ""),
                      }))
                    }
                    className="field-input flex-1"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => void runUserIdAvailability()}
                    disabled={userIdStatus.state === "checking"}
                    className="rounded-xl border border-cyan-400/40 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 disabled:opacity-60"
                  >
                    {userIdStatus.state === "checking"
                      ? "Memeriksa..."
                      : "Cek"}
                  </button>
                </div>
                {userIdStatus.state !== "idle" &&
                  userIdStatus.message && (
                    <p
                      className={`mt-1 text-xs ${
                        userIdStatus.state === "available"
                          ? "text-emerald-300"
                          : userIdStatus.state === "exists"
                          ? "text-amber-300"
                          : "text-rose-300"
                      }`}
                    >
                      {userIdStatus.message}
                    </p>
                  )}
              </Field>

              <Field label="Nama Lengkap">
                <input
                  value={form.nama_lgkp}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      nama_lgkp: e.target.value.toUpperCase(),
                    }))
                  }
                  className="field-input uppercase"
                />
              </Field>

              <Field label="Nama Depan">
                <input
                  value={form.nama_dpn}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      nama_dpn: e.target.value.toUpperCase(),
                    }))
                  }
                  className="field-input uppercase"
                />
              </Field>

              <Field label="NIK">
                <input
                  value={form.nik}
                  onChange={(e) => {
                    const nik = e.target.value
                      .replace(/[^\d]/g, "")
                      .slice(0, 16);
                    setForm((prev) => ({
                      ...prev,
                      nik,
                      akun: { ...prev.akun, user_siak: nik },
                    }));
                  }}
                  className="field-input"
                  maxLength={16}
                  inputMode="numeric"
                />
              </Field>

              <Field label="Tempat Lahir">
                <input
                  value={form.tmpt_lhr}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      tmpt_lhr: e.target.value.toUpperCase(),
                    }))
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
                <select
                  value={form.jenis_klmin}
                  onChange={handleChange("jenis_klmin")}
                  className="field-input"
                >
                  {genderOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Golongan Darah">
                <select
                  value={form.gol_drh}
                  onChange={handleChange("gol_drh")}
                  className="field-input"
                >
                  {bloodOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {/* Informasi Kantor */}
          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyan-200/90">
              Informasi Kantor
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Telepon">
                <input
                  value={form.telp}
                  onChange={handleChange("telp")}
                  className="field-input"
                />
              </Field>

              <Field label="Nama Kantor">
                <input
                  value={form.nama_kantor}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      nama_kantor: e.target.value.toUpperCase(),
                    }))
                  }
                  className="field-input uppercase"
                />
              </Field>

              <Field label="Alamat Kantor" full>
                <textarea
                  value={form.alamat_kantor}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      alamat_kantor: e.target.value.toUpperCase(),
                    }))
                  }
                  className="field-input uppercase"
                  rows={2}
                />
              </Field>

              <Field label="Alamat Rumah" full>
                <textarea
                  value={form.alamat_rumah}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      alamat_rumah: e.target.value.toUpperCase(),
                    }))
                  }
                  className="field-input uppercase"
                  rows={2}
                />
              </Field>
            </div>
          </div>

          {/* Level & Wilayah */}
          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyan-200/90">
              Level & Wilayah
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Level User">
                <select
                  value={form.level_group}
                  onChange={handleChange("level_group")}
                  className="field-input"
                >
                  <option value="">-- Pilih Level User --</option>
                  {levelGroups.map((g) => (
                    <option key={g.level_code} value={g.level_code}>
                      {g.level_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Group User">
                <select
                  value={form.user_level}
                  onChange={handleChange("user_level")}
                  className="field-input"
                >
                  <option value="">-- Pilih Group User --</option>
                  {levels.map((lvl) => (
                    <option key={lvl.user_level} value={lvl.user_level}>
                      {lvl.user_level} - {lvl.level_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Provinsi">
                <select
                  value={form.wilayah.no_prop}
                  onChange={handleWilayahChange("no_prop")}
                  className="field-input"
                  disabled={loadingLocation}
                >
                  <option value="">-- Pilih Provinsi --</option>
                  {provOptions.map((opt) => (
                    <option key={opt.no_prop} value={opt.no_prop}>
                      ({opt.no_prop}) {opt.nama_prop}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Kab/Kota">
                <select
                  value={form.wilayah.no_kab}
                  onChange={handleWilayahChange("no_kab")}
                  className="field-input"
                >
                  <option value="">-- Pilih Kab/Kota --</option>
                  {kabOptions.map((opt) => (
                    <option key={opt.no_kab} value={opt.no_kab}>
                      ({opt.no_kab}) {opt.nama_kab}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Kecamatan">
                <select
                  value={form.wilayah.no_kec}
                  onChange={handleWilayahChange("no_kec")}
                  className="field-input"
                  disabled={isKab}
                >
                  <option value="">-- Pilih Kecamatan --</option>
                  {kecOptions.map((opt) => (
                    <option key={opt.no_kec} value={opt.no_kec}>
                      ({opt.no_kec}) {opt.nama_kec}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Kelurahan">
                <select
                  value={form.wilayah.no_kel}
                  onChange={handleWilayahChange("no_kel")}
                  className="field-input"
                  disabled={isKab || isKec}
                >
                  <option value="">-- Pilih Kelurahan --</option>
                  {kelOptions.map((opt) => (
                    <option key={opt.no_kel} value={opt.no_kel}>
                      ({opt.no_kel}) {opt.nama_kel}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {/* Akun Layanan */}
          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyan-200/90">
              Akun Layanan
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Akun SIAK">
                <input
                  value={form.akun.user_siak}
                  readOnly
                  className="field-input cursor-not-allowed"
                  placeholder="Otomatis dari NIK"
                />
              </Field>
              <Field label="Akun Biomorf Card">
                <input
                  value={form.akun.user_bcard}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      akun: { ...prev.akun, user_bcard: e.target.value },
                    }))
                  }
                  className="field-input"
                />
              </Field>
              <Field label="Akun Biomorf Enrol">
                <input
                  value={form.akun.user_benrol}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      akun: { ...prev.akun, user_benrol: e.target.value },
                    }))
                  }
                  className="field-input"
                />
              </Field>
            </div>
          </div>

          {/* Pengaturan & Status */}
          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyan-200/90">
              Pengaturan & Status
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {Object.entries(form.flags).map(([key, value]) => (
                <Field key={key} label={key.replace(/_/g, " ").toUpperCase()}>
                  <select
                    value={value}
                    onChange={handleFlagsChange(key as keyof FormState["flags"])}
                    className="field-input"
                  >
                    {yesNoOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
          </div>

          {/* Pejabat Atasan */}
          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyan-200/90">
              Pejabat Atasan
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Atasan Satu">
                <select
                  value={form.supervisors.pejabat_satu}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      supervisors: {
                        ...prev.supervisors,
                        pejabat_satu: e.target.value,
                      },
                    }))
                  }
                  className="field-input"
                  disabled={loadingPejabat}
                >
                  <option value="">-- Pilih Atasan --</option>
                  {pejabatOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Atasan Dua">
                <select
                  value={form.supervisors.pejabat_dua}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      supervisors: {
                        ...prev.supervisors,
                        pejabat_dua: e.target.value,
                      },
                    }))
                  }
                  className="field-input"
                  disabled={loadingPejabat}
                >
                  <option value="">-- Pilih Atasan --</option>
                  {pejabatOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {/* Password Awal */}
          <div className="rounded-2xl border border-cyan-900/40 bg-[#05070d]/60 p-5">
            <h2 className="mb-4 text-sm font-semibold text-cyan-200/90">
              Password Awal
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Password">
                <input
                  type="password"
                  value={form.password}
                  onChange={handleChange("password")}
                  className="field-input"
                />
              </Field>
              <Field label="Re-Password">
                <input
                  type="password"
                  value={form.re_password}
                  onChange={handleChange("re_password")}
                  className="field-input"
                />
              </Field>
            </div>
          </div>

          {/* Footer actions */}
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
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Simpan User
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

/* ===== Small Field component ===== */

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col ${full ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-cyan-200/70">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
