// FILE: src/components/system/ToastProvider.tsx
"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";


export type Toast = { id: string; title?: string; desc?: string; variant?: "default" | "success" | "warn" | "danger"; duration?: number };


type ToastCtx = { toasts: Toast[]; show: (t: Omit<Toast, "id">) => string; dismiss: (id: string) => void };


const Ctx = createContext<ToastCtx | null>(null);


export function ToastProvider({ children }: { children: React.ReactNode }){
const [toasts, setToasts] = useState<Toast[]>([]);


const dismiss = useCallback((id: string) => setToasts(t => t.filter(x => x.id !== id)), []);


const show = useCallback((t: Omit<Toast, "id">) => {
const id = Math.random().toString(36).slice(2);
const toast: Toast = { id, duration: 4000, ...t };
setToasts(prev => [...prev, toast]);
if (toast.duration) setTimeout(() => dismiss(id), toast.duration);
return id;
}, [dismiss]);


const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);


return (
<Ctx.Provider value={value}>
{children}
<div className="toast-viewport">
{toasts.map(t => (
<div key={t.id} className={`toast ${t.variant ? `toast--${t.variant}` : ""}`} role="status" aria-live="polite">
<div>
{t.title && <div className="toast__title">{t.title}</div>}
{t.desc && <div className="toast__desc">{t.desc}</div>}
</div>
<button className="toast__close" aria-label="Tutup" onClick={() => dismiss(t.id)}>✕</button>
</div>
))}
</div>
</Ctx.Provider>
);
}


export function useToast(){
const ctx = useContext(Ctx);
if (!ctx) throw new Error("useToast must be used within ToastProvider");
return ctx;
}