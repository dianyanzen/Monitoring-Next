"use client";

import { ExternalLink, MessageCircle } from "lucide-react";

const DUK_AI_GPT_URL =
  "https://chatgpt.com/g/g-682dca285c348191b3281acc6bcb91eb-duk-ai-asisten-disdukcapil-kota-bandung";

export default function FloatingAiChat() {
  return (
    <a
      href={DUK_AI_GPT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-[8500] group flex h-14 items-center gap-3 rounded-xl border border-cyan-300/35 bg-[#111827]/95 px-4 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.35)] backdrop-blur transition hover:bg-[#142033]"
      aria-label="Buka DUK AI di ChatGPT"
      title="Buka DUK AI di ChatGPT"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400 text-slate-950">
        <MessageCircle size={20} />
      </span>
      <span className="hidden text-sm font-semibold sm:block">DUK AI</span>
      <ExternalLink className="hidden h-4 w-4 text-cyan-200/80 sm:block" />
    </a>
  );
}
