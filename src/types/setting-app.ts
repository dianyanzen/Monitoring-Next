// FILE: src/types/setting-app.ts
export type SettingAppConfig = {
  no_prop: string;
  no_kab: string;
  nm_prop: string;
  nm_kab: string;
  siak_dblink: string;
  cetak_dblink: string;
  rekam_dblink: string;
  master_dblink: string;
  dkb_bio: string;
  dkb_kk: string;
  dkb_tahun: string;
  dkb_cutoff: string;
  default_pass: string;
  give_kec: string;
  give_kel: string;
};

export type SettingAppPayload = SettingAppConfig;
