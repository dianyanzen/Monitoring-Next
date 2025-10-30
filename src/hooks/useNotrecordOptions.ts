// FILE: src/hooks/useNotrecordOptions.ts
"use client";

import { useEffect, useState } from "react";

export type Option = { value: string; label: string };

type MetaState = {
  akses: { aksesKecamatan: number; aksesKelurahan: number };
  defaults: { noProp: string; noKab: string; noKec: string; noKel: string };
  wilayah: { kecamatan: Option[]; kelurahan: Option[] };
};
type MetaResponse = { success: boolean; data?: MetaState; message?: string };

// ===== Sekolah Cache =====
const sekolahCache: {
  data?: Option[];
  error?: string;
  promise?: Promise<Option[]>;
} = {};

function normalizeSekolahOptions(json: any): Option[] {
  // Sumber paling umum: { success, data: { sekolah: [...] } }
  const src = json?.data?.sekolah ?? json?.sekolah ?? json?.data ?? [];
  if (!Array.isArray(src)) return [];

  const mapped = src
    .map((row: any) => {
      if (typeof row === "string") {
        const s = row.trim();
        return s ? { value: s, label: s } : null;
      }
      const nama = (row?.SEKOLAH ?? row?.NAMA_SEKOLAH ?? row?.label ?? row?.value ?? "").toString().trim();
      if (!nama) return null;
      const label = (row?.label ?? nama).toString().trim();
      return { value: nama, label };
    })
    .filter(Boolean) as Option[];

  // Dedup by value
  const seen = new Set<string>();
  return mapped.filter((opt) => {
    if (seen.has(opt.value)) return false;
    seen.add(opt.value);
    return true;
  });
}

export function useSekolahOptions() {
  const [options, setOptions] = useState<Option[]>(sekolahCache.data || []);
  const [loading, setLoading] = useState(!sekolahCache.data && !sekolahCache.error);
  const [error, setError] = useState<string | null>(sekolahCache.error ?? null);

  useEffect(() => {
    if (sekolahCache.data || sekolahCache.error) return;

    if (!sekolahCache.promise) {
      sekolahCache.promise = fetch("/api/check/notrecord/sekolah", {
        cache: "no-store",          // penting saat dev, hindari disk cache
        credentials: "include",
      })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json?.message || "Gagal memuat sekolah");
          const opts = normalizeSekolahOptions(json);
          sekolahCache.data = opts;
          return opts;
        })
        .catch((e) => {
          sekolahCache.error = e?.message || "Gagal memuat sekolah";
          throw e;
        });
    }

    sekolahCache.promise
      .then((opts) => {
        setOptions(opts);
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e?.message || "Gagal memuat sekolah");
        setLoading(false);
      });
  }, []);

  return { options, loading, error };
}

// ===== Meta Cache =====
const metaCache: {
  data?: MetaState;
  error?: string;
  promise?: Promise<MetaState>;
} = {};

export function useNotrecordMeta() {
  const [meta, setMeta] = useState<MetaState | null>(metaCache.data || null);
  const [loading, setLoading] = useState(!metaCache.data && !metaCache.error);
  const [error, setError] = useState<string | null>(metaCache.error ?? null);

  useEffect(() => {
    if (metaCache.data || metaCache.error) return;

    if (!metaCache.promise) {
      metaCache.promise = fetch("/api/check/ktpel/meta", {
        cache: "force-cache",
        credentials: "include",
      })
        .then(async (res) => {
          const json: MetaResponse = await res.json();
          if (!res.ok || !json?.success || !json.data) {
            throw new Error(json?.message || "Gagal memuat metadata wilayah");
          }
          metaCache.data = json.data;
          return json.data;
        })
        .catch((e) => {
          metaCache.error = e?.message || "Gagal memuat metadata wilayah";
          throw e;
        });
    }

    metaCache.promise
      .then((data) => {
        setMeta(data);
        setLoading(false);
      })
      .catch((e: any) => {
        setError(e?.message || "Gagal memuat metadata wilayah");
        setLoading(false);
      });
  }, []);

  return { meta, loading, error };
}

// ===== Kelurahan Cache per Kecamatan =====
const kelurahanCache = new Map<string, Option[]>();

export async function loadKelurahanOptions({
  noProp,
  noKab,
  noKec,
}: {
  noProp: string;
  noKab: string;
  noKec: string;
}) {
  if (!noKec || noKec === "0") return [{ value: "0", label: "-- Pilih Kelurahan --" }];

  const key = `${noProp}-${noKab}-${noKec}`;
  if (kelurahanCache.has(key)) return kelurahanCache.get(key)!;

  const params = new URLSearchParams({ no_prop: noProp, no_kab: noKab, no_kec: noKec });
  const res = await fetch(`/api/check/ktpel/kelurahan?${params.toString()}`, {
    cache: "force-cache",
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || "Gagal memuat kelurahan");

  const rows = json?.data?.kelurahan || json?.kelurahan || [];
  const options: Option[] = rows.map((row: any) => ({
    value: String(row.value ?? row.no_kel ?? row.NO_KEL ?? "0"),
    label: String(row.label ?? row.nama_kel ?? row.NAMA_KEL ?? row.nama ?? "-"),
  }));

  kelurahanCache.set(key, options);
  return options;
}

export function resetNotrecordCaches() {
  sekolahCache.data = undefined;
  sekolahCache.error = undefined;
  sekolahCache.promise = undefined;
  metaCache.data = undefined;
  metaCache.error = undefined;
  metaCache.promise = undefined;
  kelurahanCache.clear();
}
