"use client";
import {
  createContext, useContext, useEffect, useMemo, useState, useCallback,
} from "react";

export type SessionUser = {
  S_USER_ID?: string; S_NAMA_DPN?: string; S_NAMA_LGKP?: string;
  S_NIK?: string | number; S_JENIS_KLMIN?: string; S_TGL_LHR?: string;
  S_ALAMAT_RUMAH?: string; S_TELP?: string; S_NAMA_KANTOR?: string; S_USER_LEVEL?: number;
};

type State = {
  user: SessionUser | null; setUser: (u: SessionUser | null) => void;
  unread: number; setUnread: (n: number) => void;
  messages: any[]; setMessages: (m: any[]) => void;
  loading: boolean;
  refresh: () => Promise<void>;            // unread + previews (kalau perlu)
  refreshUnread: () => Promise<void>;      // hanya unread (dipakai di first load + polling)
  refreshPreviews: () => Promise<void>;    // hanya previews (saat dropdown dibuka/hover)
};

const Ctx = createContext<State | null>(null);
export const useSession = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession must be used within SessionProvider");
  return s;
};

export function SessionProvider({
  children,
  initialUser = null,
}: { children: React.ReactNode; initialUser?: SessionUser | null }) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // --- fetchers ---------------------------------------------------------------
  const fetchUnread = useCallback(async () => {
    const res = await fetch("/api/messages/unread", { credentials: "include", cache: "no-store" });
    if (res.ok) {
      const json = await res.json(); // { ok: true, count: number } atau { ok, count }
      setUnread(Number(json?.count ?? 0));
    }
  }, []);

  const fetchPreviews = useCallback(async () => {
    const res = await fetch("/api/messages/previews", { credentials: "include", cache: "no-store" });
    if (res.ok) {
      const json = await res.json(); // { success: true, data: { items: [], count } }
      const items = json?.data?.items ?? json?.items ?? [];
      setMessages(Array.isArray(items) ? items : []);
    }
  }, []);

  // --- APIs yang diexpose ke komponen ----------------------------------------
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchUnread(), fetchPreviews()]);
    } finally {
      setLoading(false);
    }
  }, [fetchUnread, fetchPreviews]);

  const refreshUnread = useCallback(async () => {
    try { await fetchUnread(); } catch {}
  }, [fetchUnread]);

  const refreshPreviews = useCallback(async () => {
    setLoading(true);
    try { await fetchPreviews(); } finally { setLoading(false); }
  }, [fetchPreviews]);

  // --- lifecycle -------------------------------------------------------------
  // First load → hanya unread (biar badge cepat muncul)
  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  // Polling ringan tiap 30 detik → hanya unread
  useEffect(() => {
    const id = window.setInterval(() => { void refreshUnread(); }, 30_000);
    return () => window.clearInterval(id);
  }, [refreshUnread]);

  const value = useMemo(
    () => ({
      user, setUser,
      unread, setUnread,
      messages, setMessages,
      loading,
      refresh,           // lengkap (kalau mau dipakai tempat lain)
      refreshUnread,     // dipakai Topbar untuk badge
      refreshPreviews,   // dipakai Topbar saat buka/hover menu Mail
    }),
    [user, unread, messages, loading, refresh, refreshUnread, refreshPreviews]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
