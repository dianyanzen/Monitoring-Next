// FILE: src/app/chat/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback, ReactNode } from "react";
import { useSession } from "@/contexts/session";
import { useSearchParams } from "next/navigation";

/* ========= Types ========= */
type Contact = {
  id: string;
  name: string;
  avatar?: string | null;
  lastMessage?: string | null;
  unread?: number;
};

type Msg = {
  id: number;
  fromId: string;
  toId: string;
  text: string;
  img?: string | null;
  createdAt: string;
  _pending?: boolean;
  _error?: boolean;
};

/* ========= Utils ========= */
const clsx = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(" ");

const getAvatarUrl = (id: string) => `/assets/upload/pp/${id}.jpg`;

const isNearBottom = (el: HTMLElement | null, px = 120) =>
  !el || el.scrollHeight - el.scrollTop - el.clientHeight < px;

const debounce = <F extends (...a: any[]) => void>(fn: F, ms = 250) => {
  let t: any;
  return (...args: Parameters<F>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

// tanggal
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const dayLabel = (d: Date) => {
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yest)) return "Yesterday";
  return d.toLocaleDateString();
};

const renderMessageNodes = (text: string): ReactNode[] => {
  const urlRegex = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/gi;
  type Fragment = { type: "text"; value: string } | { type: "link"; value: string };
  const fragments: Fragment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      fragments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    fragments.push({ type: "link", value: match[0] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    fragments.push({ type: "text", value: text.slice(lastIndex) });
  }

  if (!fragments.length) {
    fragments.push({ type: "text", value: text });
  }

  const nodes: ReactNode[] = [];
  let key = 0;

  fragments.forEach((fragment, fragmentIndex) => {
    if (fragment.type === "link") {
      const display = fragment.value;
      const href = display.startsWith("http") ? display : `https://${display}`;
      nodes.push(
        <a
          key={`msg-link-${fragmentIndex}-${key++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="cp-link"
        >
          {display}
        </a>
      );
      return;
    }

    const parts = fragment.value.split(/\n/);
    parts.forEach((part, partIndex) => {
      if (part.length) {
        nodes.push(
          <span key={`msg-text-${fragmentIndex}-${partIndex}-${key++}`}>{part}</span>
        );
      }
      if (partIndex < parts.length - 1) {
        nodes.push(<br key={`msg-br-${fragmentIndex}-${partIndex}-${key++}`} />);
      }
    });

    if (fragment.value === "") {
      nodes.push(<br key={`msg-empty-${fragmentIndex}-${key++}`} />);
    }
  });

  return nodes;
};

export default function ChatPage() {
  const { user } = useSession();
  const myId = useMemo(() => String(user?.S_NIK ?? ""), [user]);

  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from") || null; // deep link target (NIK)
  const textParam = searchParams.get("text") || "";   // optional prefill

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [search, setSearch] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const applySearch = useMemo(() => debounce((s: string) => setSearchQ(s), 250), []);
  useEffect(() => applySearch(search), [search, applySearch]);

  const shownContacts = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.name?.toLowerCase().includes(q));
  }, [contacts, searchQ]);

  const listRef = useRef<HTMLUListElement>(null);
  const pollTimer = useRef<any>(null);

  /* ========= Small visual ping ========= */
  const energizeHeader = () => {
    const el = document.querySelector<HTMLElement>(".cp section > header");
    if (!el) return;
    el.classList.add("energize");
    setTimeout(() => el.classList.remove("energize"), 500);
  };

  /* ========= Contacts ========= */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/chat/contacts", { cache: "no-store", credentials: "include" });
        const json = await res.json().catch(() => []);
        const raw: Contact[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : [];

        const clean = raw.filter((c) => String(c.id) !== myId);
        if (!alive) return;
        setContacts(clean);

        const saved = sessionStorage.getItem("chat.selected");
        const target = fromParam && fromParam !== myId ? fromParam : saved;

        let pref =
          (target ? clean.find((c) => c.id === target) : null) ||
          clean[0] ||
          null;

        // jika ?from= tidak ada di kontak, buat placeholder agar bisa langsung buka
        if (!pref && fromParam && fromParam !== myId) {
          pref = { id: fromParam, name: fromParam } as Contact;
          setContacts((prev) =>
            prev.some((x) => x.id === fromParam) ? prev : [pref!, ...prev]
          );
        }

        if (pref) setSelected(pref);
      } catch (e) {
        console.error("Failed load contacts", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [myId, fromParam]);

  // apply prefill text (sekali saat mount)
  useEffect(() => {
    if (textParam) setText(textParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected?.id) sessionStorage.setItem("chat.selected", selected.id);
  }, [selected?.id]);

  /* ========= Messages ========= */
  const loadMessages = async (withNik: string, opts?: { delta?: boolean }) => {
    if (!withNik) return;
    const keepAtBottom = isNearBottom(listRef.current);
    setLoadingMessages(!opts?.delta);

    try {
      const url = new URL("/api/chat/messages", window.location.origin);
      url.searchParams.set("with", withNik);
      const res = await fetch(url.toString(), { cache: "no-store", credentials: "include" });
      const json = await res.json();

      const arr: Msg[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
        ? json.data
        : [];

      setMessages(arr);
      energizeHeader();

      if (keepAtBottom) {
        requestAnimationFrame(() => {
          listRef.current?.lastElementChild?.scrollIntoView({ behavior: "auto", block: "end" });
        });
      }
    } catch (e) {
      console.error("loadMessages failed", e);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (selected?.id && selected.id !== myId) loadMessages(selected.id);
    else setMessages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, myId]);

  /* ========= React to ?from change ========= */
  useEffect(() => {
    if (!fromParam || fromParam === myId) return;
    setSelected((prev) => {
      if (prev?.id === fromParam) return prev;
      const found = contacts.find((c) => c.id === fromParam);
      if (found) return found;
      const ghost = { id: fromParam, name: fromParam } as Contact;
      setContacts((p) => (p.some((c) => c.id === fromParam) ? p : [ghost, ...p]));
      return ghost;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromParam]);

  /* ========= Polling ========= */
  useEffect(() => {
    if (!selected?.id) return;
    clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => loadMessages(selected.id!, { delta: true }), 10_000);
    return () => clearInterval(pollTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  /* ========= Send / Retry ========= */
  const send = async () => {
    if (!selected || !text.trim()) return;
    if (String(selected.id) === String(myId)) return;

    const optimistic: Msg = {
      id: -Date.now(),
      fromId: myId,
      toId: selected.id,
      text,
      img: null,
      createdAt: new Date().toISOString(),
      _pending: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setSending(true);

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toId: selected.id, text }),
      });
      if (res.ok) await loadMessages(selected.id, { delta: true });
      else
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...m, _error: true, _pending: false } : m))
        );
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? { ...m, _error: true, _pending: false } : m))
      );
    } finally {
      setSending(false);
      requestAnimationFrame(() =>
        listRef.current?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" })
      );
    }
  };

  const retrySend = async (m: Msg) => {
    if (!selected) return;
    setMessages((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, _pending: true, _error: false } : x))
    );
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toId: selected.id, text: m.text }),
      });
      if (res.ok) await loadMessages(selected.id, { delta: true });
      else
        setMessages((prev) =>
          prev.map((x) => (x.id === m.id ? { ...x, _pending: false, _error: true } : x))
        );
    } catch {
      setMessages((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, _pending: false, _error: true } : x))
      );
    }
  };

  /* ========= Scroll-to-bottom FAB ========= */
  const [showDown, setShowDown] = useState(false);
  const onScroll = useCallback(() => setShowDown(!isNearBottom(listRef.current!, 120)), []);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  /* ========= Render ========= */
  return (
    <div className="cp relative px-8 pb-8 pt-6 md:pt-8 text-gray-200 space-y-8 mt-5">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-15%] left-[15%] w-[1100px] h-[1100px] bg-cyan-500/15 blur-[220px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[18%] w-[1000px] h-[1000px] bg-fuchsia-600/12 blur-[190px] rounded-full" />
      </div>

      <section className="rounded-2xl border border-cyan-800/40 bg-[#0b0b1a]/80 backdrop-blur-xl shadow-[0_0_34px_#00ffff22] overflow-hidden">
        <header className="px-5 py-4 border-b border-cyan-900/50 flex items-center gap-3">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
          <h1 className="text-base font-semibold tracking-wide text-cyan-200">Chat</h1>
          <div className="ml-auto h-[2px] w-48 bg-gradient-to-r from-cyan-400 via-pink-400 to-transparent opacity-70" />
        </header>

        <div className="p-5 grid grid-cols-12 gap-5 min-h-[560px]">
          {/* Contacts */}
          <aside className="col-span-12 md:col-span-4 lg:col-span-3 rounded-xl border border-cyan-700/40 bg-white/5 overflow-hidden">
            <div className="p-3 border-b border-cyan-700/40">
              <div className="relative">
                <input
                  id="chat-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari kontak… (Ctrl+K)"
                  className="w-full rounded-lg bg-[#0f1120] border border-cyan-800/60 focus:border-cyan-400/70 outline-none pl-9 pr-3 py-2 text-sm"
                />
                <svg
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-300/70"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </svg>
              </div>
            </div>

            <div className="max-h-[64vh] overflow-y-auto cp-scroll">
              {shownContacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-3 py-3 text-left transition relative",
                    "hover:bg-white/10 hover:shadow-[0_0_20px_#22d3ee22]",
                    selected?.id === c.id &&
                      "bg-white/10 shadow-[0_0_24px_#22d3ee22] contact-selected"
                  )}
                >
                  <span className="avatar-ring">
                    <img
                      src={getAvatarUrl(c.id)}
                      onError={(e) =>
                        ((e.currentTarget as HTMLImageElement).src =
                          "/assets/upload/pp/3273000000000000.jpg")
                      }
                      className="w-9 h-9 rounded-full object-cover border border-cyan-700/60"
                      alt={c.name}
                      loading="lazy"
                    />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-cyan-100 truncate">{c.name}</p>
                    {c.lastMessage && (
                      <p className="text-[11px] text-cyan-300/70 truncate">
                        {c.lastMessage}
                      </p>
                    )}
                  </div>
                  {c.unread ? <span className="notiv_mini">{c.unread}</span> : null}
                </button>
              ))}
            </div>
          </aside>

          {/* Chat area */}
          <section className="col-span-12 md:col-span-8 lg:col-span-9 rounded-xl border border-cyan-700/40 bg-white/5 overflow-hidden flex flex-col relative">
            {/* Header penerima */}
            <div className="p-4 border-b border-cyan-700/40 flex items-center gap-3">
              {selected ? (
                <>
                  <span className="avatar-ring w-10 h-10">
                    <img
                      src={getAvatarUrl(selected.id)}
                      onError={(e) =>
                        ((e.currentTarget as HTMLImageElement).src =
                          "/assets/upload/pp/3273000000000000.jpg")
                      }
                      className="w-10 h-10 rounded-full object-cover border border-cyan-700/60"
                      alt={selected.name}
                    />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-cyan-100">
                      {selected.name}
                    </h3>
                    <p className="text-[11px] text-cyan-300/70">Chat Message</p>
                  </div>
                </>
              ) : (
                <h3 className="text-sm font-semibold text-cyan-100">
                  Pilih kontak untuk mulai chat
                </h3>
              )}
              <div className="ml-auto h-[2px] w-40 bg-gradient-to-r from-cyan-400 via-pink-400 to-transparent opacity-70" />
            </div>

            {/* Messages */}
            <ul ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-1 cp-scroll">
              {loadingMessages && (
                <li className="text-xs text-cyan-200/70 animate-pulse">
                  Memuat pesan…
                </li>
              )}
              {!loadingMessages && messages.length === 0 && (
                <li className="text-xs text-cyan-200/70">Belum ada pesan.</li>
              )}

              {messages.map((m, idx) => {
                const mine = m.fromId === myId;
                const prev = messages[idx - 1];
                const curD = new Date(m.createdAt);
                const showDivider = !prev || !sameDay(new Date(prev.createdAt), curD);

                const groupTop = !prev || prev.fromId !== m.fromId || showDivider;
                const next = messages[idx + 1];
                const groupBottom =
                  !next || next.fromId !== m.fromId || !sameDay(new Date(next.createdAt), curD);

                return (
                  <li key={m.id}>
                    {showDivider && (
                      <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 py-1">
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
                        <span className="px-2 py-0.5 text-[10px] rounded bg-[#0f1120]/80 border border-cyan-800/40 text-cyan-200/80">
                          {dayLabel(curD)}
                        </span>
                        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-pink-500/30 to-transparent" />
                      </div>
                    )}

                    <div className={clsx("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={clsx(
                          "msg-bubble max-w-[78%] px-4 py-2 text-sm shadow transition backdrop-blur-sm",
                          mine ? "bubble-me" : "bubble-you",
                          m._pending && "bubble-pulse"
                        )}
                        style={{
                          borderTopLeftRadius: mine ? 16 : groupTop ? 16 : 8,
                          borderTopRightRadius: mine ? (groupTop ? 16 : 8) : 16,
                          borderBottomLeftRadius: mine ? 16 : groupBottom ? 16 : 8,
                          borderBottomRightRadius: mine ? (groupBottom ? 16 : 8) : 16,
                        }}
                      >
                        <div className="text-cyan-100 leading-relaxed">
                          {renderMessageNodes(m.text)}
                        </div>
                        <div className="mt-1 flex items-center gap-2 justify-end text-[10px]">
                          {m._error ? (
                            <button
                              onClick={() => retrySend(m)}
                              className="text-rose-400/90 hover:underline"
                            >
                              ⟳ Retry
                            </button>
                          ) : m._pending ? (
                            <span className="text-cyan-300/70 italic">…</span>
                          ) : (
                            <span className="text-cyan-300/70">✓</span>
                          )}
                          <span className="text-cyan-300/60">
                            {new Date(m.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Scroll-to-bottom FAB */}
            {showDown && (
              <button
                onClick={() =>
                  listRef.current?.lastElementChild?.scrollIntoView({
                    behavior: "smooth",
                    block: "end",
                  })
                }
                className="cp-fab"
                title="Scroll to latest"
                aria-label="Scroll to latest"
              >
                ↓
              </button>
            )}

            {/* Input (sejajar & rapi) */}
            <div className="p-4 border-t border-cyan-700/40">
              <div className="flex items-center gap-3">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    selected
                      ? "Tulis pesan… (Enter kirim, Shift+Enter baris baru)"
                      : "Pilih kontak dahulu"
                  }
                  disabled={!selected || sending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  className="cp-input flex-1 h-12 max-h-40 resize-y rounded-xl bg-[#0f1120] border border-cyan-800/60 focus:border-cyan-400/70 outline-none px-3 py-2 text-sm"
                />
                <button
                  onClick={send}
                  disabled={!selected || sending || !text.trim()}
                  className={clsx(
                    "cp-btn h-12 px-5 select-none rounded-xl text-sm font-semibold transition",
                    "bg-gradient-to-r from-fuchsia-600 to-cyan-500 hover:from-fuchsia-500 hover:to-cyan-400",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>

      {/* ====== THEME / EFFECTS (global) ====== */}
      <style jsx global>{`
        /* Tokens */
        .cp {
          --cp-rail: linear-gradient(90deg, #22d3ee, #ff3fad 60%, transparent);
          --cp-rail-v: linear-gradient(180deg, #22d3ee, #ff3fad 70%, transparent);
          --cp-ring: radial-gradient(circle at 30% 30%, #22d3ee, #ff3fad);
        }

        /* Header rail + energize */
        .cp section > header { position: relative; }
        .cp section > header::after {
          content: "";
          position: absolute;
          right: 16px; top: 10px;
          height: 2px; width: 160px;
          background: var(--cp-rail); opacity: .85;
          border-radius: 999px;
          filter: drop-shadow(0 0 8px rgba(34,211,238,.35));
          animation: railFlow 4s linear infinite;
          background-size: 200% 100%;
        }
        .cp section > header.energize::after {
          filter: drop-shadow(0 0 18px rgba(255,63,173,.55));
        }
        @keyframes railFlow { 0%{background-position:0 0} 100%{background-position:200% 0} }

        /* Selected contact: neon edge */
        .cp .contact-selected::after{
          content:""; position:absolute; inset:2px -2px -2px auto; width:3px; border-radius:2px;
          background: var(--cp-rail-v);
          filter: drop-shadow(0 0 10px rgba(255,63,173,.35));
        }
        .cp .contact-selected{ box-shadow: 0 0 24px #22d3ee22, inset 0 0 0 1px rgba(255,255,255,.04); }

        /* Avatar ring */
        .cp .avatar-ring{ position:relative; display:inline-flex; padding:2px; border-radius:9999px; background: var(--cp-ring); }
        .cp .avatar-ring img{ border:1px solid rgba(255,255,255,.12); }

        /* Linkified URL */
        .cp .cp-link { text-decoration: underline; text-underline-offset: 2px; }
        .cp .cp-link:hover { filter: brightness(1.1); }

        /* Bubbles */
        .cp .msg-bubble{ border:1px solid rgba(255,255,255,.06); box-shadow: 0 6px 24px rgba(0,0,0,.25); }
        .cp .bubble-me{
          background: linear-gradient(180deg, rgba(34,211,238,.18), rgba(34,211,238,.08));
          border-color: rgba(34,211,238,.35);
          box-shadow: 0 0 22px rgba(34,211,238,.16), inset 0 0 0 1px rgba(255,255,255,.04);
        }
        .cp .bubble-you{
          background: linear-gradient(180deg, rgba(13,16,30,.92), rgba(13,16,28,.86));
          border-color: rgba(0,255,255,.12);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.03);
        }
        .cp .bubble-pulse{ animation: bubblePulse 1.5s ease-in-out infinite; }
        @keyframes bubblePulse{ 0%,100%{box-shadow:0 0 22px rgba(34,211,238,.14)} 50%{box-shadow:0 0 36px rgba(34,211,238,.28)} }

        /* Button & input alignment */
        .cp .cp-btn{ position:relative; overflow:hidden; line-height:1; }
        .cp .cp-btn::after{
          content:""; position:absolute; inset:-1px; border-radius:inherit; pointer-events:none;
          box-shadow:0 0 28px rgba(255,63,173,.25), 0 0 28px rgba(34,211,238,.22) inset; opacity:.85;
        }
        .cp .cp-btn:not(:disabled):active{ transform: translateY(1px); }
        .cp .cp-input:focus{ box-shadow:0 0 0 3px rgba(34,211,238,.12); }

        /* Scrollbar custom */
        .cp .cp-scroll{ scrollbar-width: thin; scrollbar-color: rgba(34,211,238,.35) transparent; }
        .cp .cp-scroll::-webkit-scrollbar{ width:10px; }
        .cp .cp-scroll::-webkit-scrollbar-track{ background: transparent; }
        .cp .cp-scroll::-webkit-scrollbar-thumb{
          background: linear-gradient(180deg, rgba(34,211,238,.45), rgba(255,63,173,.45));
          border-radius: 999px; border: 2px solid transparent; background-clip: padding-box;
        }

        /* FAB */
        .cp .cp-fab{
          position: absolute; right: 14px; bottom: 92px;
          width: 38px; height: 38px; border-radius: 9999px;
          display:flex; align-items:center; justify-content:center;
          background: linear-gradient(135deg,#22d3ee,#ff3fad);
          box-shadow: 0 10px 28px rgba(34,211,238,.25);
          color: white; font-weight: 700;
        }
        .cp .cp-fab:hover{ filter: saturate(1.05) brightness(1.05); }

        /* Mini badge */
        .notiv_mini{
          text-align:center; background-color:#06d755; color:#fff; font-weight:600; font-size:12px;
          border-radius:600px; padding:4px 7px 3px; box-shadow:0 0 12px #06d75566;
        }
      `}</style>
    </div>
  );
}
