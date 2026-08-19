"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";

type VideoApiEnvelope = {
  success?: boolean;
  data?: unknown;
};

type QueuePayload = {
  loket?: string;
  urutan?: string;
  LOKET?: string;
  URUTAN?: string;
};

type LoketState = Record<string, string>;

const SOUND_BY_LETTER: Record<string, string> = {
  A: "/assets/sound/A.WAV",
  B: "/assets/sound/B.WAV",
  C: "/assets/sound/C.wav",
  D: "/assets/sound/D.wav",
  E: "/assets/sound/E.wav",
  F: "/assets/sound/F.wav",
  G: "/assets/sound/G.wav",
  H: "/assets/sound/H.wav",
};

const DEFAULT_SOCKET_URL = process.env.NEXT_PUBLIC_ESPASI_APP_HOST_URL ?? "http://10.32.73.7:1111";

type ConfigEnvelope = {
  success?: boolean;
  data?: {
    hostUrl?: string;
  };
};

export type EspasiLoketConfig = {
  label: string;
  image: string;
};

type EspasiDashboardScreenProps = {
  eventName: string;
  lokets: EspasiLoketConfig[];
  speakLetterPrefix?: boolean;
};

function normalizePath(item: string) {
  const value = String(item || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return value;
  if (value.startsWith("public/")) return `/${value.slice("public/".length)}`;
  return `/${value}`;
}

function extractItems(payload: unknown) {
  if (Array.isArray(payload)) return payload.map(String);

  const maybeEnvelope = payload as VideoApiEnvelope;
  if (Array.isArray(maybeEnvelope?.data)) return maybeEnvelope.data.map(String);

  return [] as string[];
}

function digitsOnly(v: string) {
  return String(v || "").replace(/[^0-9]+/g, "");
}

function sound(path: string) {
  return new Audio(path);
}

function playQueueSounds(queue: HTMLAudioElement[]) {
  if (!queue.length) return;

  let i = 0;
  const playNext = () => {
    const current = queue[i];
    current.onended = () => {
      i += 1;
      if (i < queue.length) playNext();
    };
    current.play().catch(() => {
      i += 1;
      if (i < queue.length) playNext();
    });
  };

  playNext();
}

function buildCallAudio(letter: string, rawNumber: string, speakLetterPrefix: boolean) {
  const urutan = digitsOnly(rawNumber);
  const len = urutan.length;
  const loketSound = SOUND_BY_LETTER[letter] ?? "/assets/sound/A.WAV";
  const prefix = speakLetterPrefix ? [sound(loketSound)] : [];

  if (!len) return [] as HTMLAudioElement[];

  if (len === 1) {
    return [
      sound("/assets/sound/BEL.WAV"),
      sound("/assets/sound/nomor_antrian.wav"),
      ...prefix,
      sound(`/assets/sound/${urutan}.wav`),
      sound("/assets/sound/Keloket.wav"),
      sound(loketSound),
    ];
  }

  if (len === 2) {
    const puluhan = `${urutan.substring(0, 1)}0`;
    const satuan = String(Number(urutan) - Number(puluhan));
    const useDirect =
      Number(urutan) < 21 || [30, 40, 50, 60, 70, 80, 90].includes(Number(urutan));

    if (useDirect) {
      return [
        sound("/assets/sound/BEL.WAV"),
        sound("/assets/sound/nomor_antrian.wav"),
        ...prefix,
        sound(`/assets/sound/${urutan}.wav`),
        sound("/assets/sound/Keloket.wav"),
        sound(loketSound),
      ];
    }

    return [
      sound("/assets/sound/BEL.WAV"),
      sound("/assets/sound/nomor_antrian.wav"),
      ...prefix,
      sound(`/assets/sound/${puluhan}.wav`),
      sound(`/assets/sound/${satuan}.wav`),
      sound("/assets/sound/Keloket.wav"),
      sound(loketSound),
    ];
  }

  if (len === 3) {
    const ratusan = `${urutan.substring(0, 1)}00`;
    const tempPuluhan = Number(urutan) - Number(ratusan);
    const puluhan = `${String(tempPuluhan).substring(0, 1)}0`;
    const satuan = String(tempPuluhan - Number(puluhan));

    if ([100, 200, 300].includes(Number(urutan))) {
      return [
        sound("/assets/sound/BEL.WAV"),
        sound("/assets/sound/nomor_antrian.wav"),
        ...prefix,
        sound(`/assets/sound/${urutan}.wav`),
        sound("/assets/sound/Keloket.wav"),
        sound(loketSound),
      ];
    }

    if (tempPuluhan <= 21 || [30, 40, 50, 60, 70, 80, 90].includes(tempPuluhan)) {
      return [
        sound("/assets/sound/BEL.WAV"),
        sound("/assets/sound/nomor_antrian.wav"),
        ...prefix,
        sound(`/assets/sound/${ratusan}.wav`),
        sound(`/assets/sound/${tempPuluhan}.wav`),
        sound("/assets/sound/Keloket.wav"),
        sound(loketSound),
      ];
    }

    return [
      sound("/assets/sound/BEL.WAV"),
      sound("/assets/sound/nomor_antrian.wav"),
      ...prefix,
      sound(`/assets/sound/${ratusan}.wav`),
      sound(`/assets/sound/${puluhan}.wav`),
      sound(`/assets/sound/${satuan}.wav`),
      sound("/assets/sound/Keloket.wav"),
      sound(loketSound),
    ];
  }

  return [sound("/assets/sound/BEL.WAV"), sound("/assets/sound/nomor_antrian.wav"), sound("/assets/sound/Keloket.wav"), sound(loketSound)];
}

function LoketCard({ label, value, image }: { label: string; value: string; image: string }) {
  return (
    <article className="overflow-hidden rounded-xl border border-[#2f7fdd] bg-[#2f80ed] text-white shadow-sm">
      <div className="relative grid h-24 place-items-center border-b border-white/30 text-4xl font-black">
        <img src={image} alt={`Loket ${label}`} className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <span className="relative">{value || "-"}</span>
      </div>
      <div className="px-3 py-2 text-center text-xl font-extrabold tracking-wide">LOKET {label}</div>
    </article>
  );
}

export default function EspasiDashboardScreen({
  eventName,
  lokets,
  speakLetterPrefix = false,
}: EspasiDashboardScreenProps) {
  const [items, setItems] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socketUrl, setSocketUrl] = useState(DEFAULT_SOCKET_URL);
  const [socketStatus, setSocketStatus] = useState("connecting");

  const loketLabels = useMemo(() => lokets.map((v) => v.label.toUpperCase()), [lokets]);

  const [loket, setLoket] = useState<LoketState>(() => {
    const initial: LoketState = {};
    for (const item of lokets) {
      initial[item.label.toUpperCase()] = "-";
    }
    return initial;
  });

  useEffect(() => {
    setLoket(() => {
      const initial: LoketState = {};
      for (const item of lokets) {
        initial[item.label.toUpperCase()] = "-";
      }
      return initial;
    });
  }, [lokets]);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/espasi/video", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      const parsed = extractItems(json)
        .map(normalizePath)
        .filter(Boolean);

      setItems(parsed);
      setIndex(0);

      if (!parsed.length) {
        setError("Belum ada file video yang ditemukan di folder public/assets/video.");
      }
    } catch (e: any) {
      setError(e?.message || "Gagal memuat daftar video");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        const res = await fetch("/api/espasi/config", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ConfigEnvelope | null;
        const url = String(json?.data?.hostUrl ?? "").trim();
        if (!cancelled && url) setSocketUrl(url);
      } catch {
        // Keep env fallback when config endpoint is unavailable.
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
    };
  }, []);

  useEffect(() => {
    let socket: Socket | null = null;

    try {
      setSocketStatus("connecting");
      socket = io(socketUrl, {
        transports: ["websocket", "polling"],
        reconnection: true,
      });

      socket.on("connect", () => {
        setSocketStatus("connected");
      });

      socket.on("disconnect", () => {
        setSocketStatus("disconnected");
      });

      socket.on("connect_error", () => {
        setSocketStatus("error");
      });

      socket.on(eventName, (payload: QueuePayload) => {
        const letter = String(payload?.loket ?? payload?.LOKET ?? "").toUpperCase();
        const urutan = digitsOnly(String(payload?.urutan ?? payload?.URUTAN ?? ""));
        if (!letter || !urutan) return;

        if (loketLabels.includes(letter)) {
          setLoket((prev) => ({ ...prev, [letter]: urutan }));
        }

        const queue = buildCallAudio(letter, urutan, speakLetterPrefix);
        playQueueSounds(queue);
      });
    } catch {
      setSocketStatus("error");
      // Keep dashboard alive even if socket is unavailable.
    }

    return () => {
      if (socket) {
        socket.off(eventName);
        socket.disconnect();
      }
    };
  }, [eventName, loketLabels, socketUrl, speakLetterPrefix]);

  const currentVideo = useMemo(() => {
    if (!items.length) return "";
    return items[index] ?? items[0] ?? "";
  }, [items, index]);

  const nextVideo = useCallback(() => {
    setIndex((prev) => {
      if (!items.length) return 0;
      return (prev + 1) % items.length;
    });
  }, [items.length]);

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[var(--widget-grey,#f3f5ff)] p-2 md:p-3">
      <img src="/assets/img/hexagons/accent.svg" alt="" className="pointer-events-none absolute -left-40 -top-40 h-[420px] w-[420px] animate-[spin_24s_linear_infinite] opacity-30" />
      <img src="/assets/img/hexagons/green.svg" alt="" className="pointer-events-none absolute bottom-14 right-14 h-[300px] w-[300px] animate-[spin_20s_linear_infinite] opacity-35" />
      <img src="/assets/img/hexagons/orange-heavy.svg" alt="" className="pointer-events-none absolute bottom-4 left-4 h-[420px] w-[420px] animate-[spin_28s_linear_infinite] opacity-20" />

      <div className="relative z-10 h-full">
        {/* <div className="mb-1 flex items-center justify-end gap-2 px-1 text-[11px] text-[#365991]">
          <span className="font-semibold">Socket:</span>
          <span className={socketStatus === "connected" ? "text-emerald-600" : socketStatus === "error" ? "text-red-600" : "text-amber-600"}>
            {socketStatus}
          </span>
          <span className="hidden truncate md:inline-block md:max-w-[420px]" title={socketUrl}>{socketUrl}</span>
        </div> */}
        <section className="hidden h-full gap-3 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-xl border border-[#cfdcf6] bg-white/95 p-1 shadow">
            {loading ? (
              <div className="grid h-full place-items-center rounded-lg bg-[#f6f8ff] text-sm text-[#4b6aa0]">
                Memuat daftar video...
              </div>
            ) : currentVideo ? (
              <video
                key={`${currentVideo}-${index}`}
                src={currentVideo}
                autoPlay
                muted
                controls={false}
                playsInline
                onEnded={nextVideo}
                onError={nextVideo}
                className="h-full w-full rounded-lg bg-white object-contain"
              />
            ) : (
              <div className="grid h-full place-items-center rounded-lg bg-[#f6f8ff] text-center text-sm text-[#4b6aa0]">
                <div>
                  <div>Tidak ada video untuk diputar.</div>
                  {error ? <div className="mt-1 text-[#5f7eb5]">{error}</div> : null}
                </div>
              </div>
            )}
            <div className="truncate px-1 py-1 text-xs text-[#4b6aa0]">{currentVideo || "-"}</div>
          </div>

          <div className="grid grid-cols-2 content-start gap-3">
            {lokets.map((item) => {
              const label = item.label.toUpperCase();
              return <LoketCard key={label} label={label} value={loket[label] || "-"} image={item.image} />;
            })}
          </div>
        </section>

        <section className="grid h-full gap-3 lg:hidden">
          <div className="overflow-hidden rounded-xl border border-[#cfdcf6] bg-white/95 p-1 shadow">
            {currentVideo ? (
              <video
                key={`${currentVideo}-${index}-mobile`}
                src={currentVideo}
                autoPlay
                muted
                controls={false}
                playsInline
                onEnded={nextVideo}
                onError={nextVideo}
                className="aspect-video w-full rounded-lg bg-white object-contain"
              />
            ) : (
              <div className="grid aspect-video place-items-center rounded-lg bg-[#f6f8ff] text-center text-sm text-[#4b6aa0]">
                <div>Tidak ada video untuk diputar.</div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {lokets.map((item) => {
              const label = item.label.toUpperCase();
              return <LoketCard key={label} label={label} value={loket[label] || "-"} image={item.image} />;
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
