// FILE: src/contexts/session.tsx
"use client";
import {
  createContext, useContext, useEffect, useMemo, useState, useCallback, useRef,
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
  refresh: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  refreshPreviews: () => Promise<void>;
};

const Ctx = createContext<State | null>(null);
export const useSession = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession must be used within SessionProvider");
  return s;
};

// ✅ Helper yang hilang: cek visibilitas tab dengan aman
const isVisible = () =>
  typeof document !== "undefined" && document.visibilityState === "visible";

export function SessionProvider({
  children,
  initialUser = null,
}: { children: React.ReactNode; initialUser?: SessionUser | null }) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const didInit = useRef(false); // cegah double-run di dev StrictMode

  const fetchUnread = useCallback(async () => {
    if (!isVisible()) return;
    const res = await fetch("/api/messages/unread", { credentials: "include", cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      setUnread(Number(json?.count ?? 0));
    }
  }, []);

  const fetchPreviews = useCallback(async () => {
    if (!isVisible()) return;
    const res = await fetch("/api/messages/previews", { credentials: "include", cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const items = json?.data?.items ?? json?.items ?? [];
      setMessages(Array.isArray(items) ? items : []);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { await Promise.all([fetchUnread(), fetchPreviews()]); }
    finally { setLoading(false); }
  }, [fetchUnread, fetchPreviews]);

  const refreshUnread = useCallback(async () => { try { await fetchUnread(); } catch {} }, [fetchUnread]);
  const refreshPreviews = useCallback(async () => {
    setLoading(true);
    try { await fetchPreviews(); } finally { setLoading(false); }
  }, [fetchPreviews]);

  // first load → hanya unread
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void refreshUnread();
  }, [refreshUnread]);

  // polling tiap 15 menit; refresh sekali saat tab kembali fokus
  useEffect(() => {
    const tick = () => { if (isVisible()) void refreshUnread(); };
    const id = window.setInterval(tick, 900_000); // 15 menit
    const onVis = () => { if (isVisible()) void refreshUnread(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshUnread]);

  const value = useMemo(() => ({
    user, setUser,
    unread, setUnread,
    messages, setMessages,
    loading,
    refresh,
    refreshUnread,
    refreshPreviews,
  }), [user, unread, messages, loading, refresh, refreshUnread, refreshPreviews]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
