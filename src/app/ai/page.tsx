"use client";

import { useEffect } from "react";
import { Bot, ExternalLink } from "lucide-react";

const DUK_AI_GPT_URL =
  "https://chatgpt.com/g/g-682dca285c348191b3281acc6bcb91eb-duk-ai-asisten-disdukcapil-kota-bandung";

export default function AiPage() {
  useEffect(() => {
    window.location.href = DUK_AI_GPT_URL;
  }, []);

  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-[#080b10] px-4 text-slate-100">
      <div className="w-full max-w-md rounded-xl border border-cyan-300/20 bg-[#111827] p-6 text-center shadow-[0_0_28px_rgba(34,211,238,0.22)]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-400 text-slate-950">
          <Bot size={24} />
        </div>
        <h1 className="text-xl font-semibold text-cyan-100">Membuka DUK AI</h1>
        <p className="mt-2 text-sm text-slate-400">
          Anda sedang diarahkan ke DUK AI di ChatGPT.
        </p>
        <a
          href={DUK_AI_GPT_URL}
          target="_self"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          Buka sekarang
          <ExternalLink size={16} />
        </a>
      </div>
    </div>
  );
}
