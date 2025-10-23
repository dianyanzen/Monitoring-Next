// FILE: src/components/ui/SelectDark.tsx
"use client";
import * as React from "react";

export type SelectDarkProps =
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    className?: string;
  };

const SelectDark = React.forwardRef<HTMLSelectElement, SelectDarkProps>(
  ({ className = "", style, ...props }, ref) => {
    return (
      <select
        ref={ref}
        {...props}
        className={[
          // base dark look
          "w-full rounded-xl border border-cyan-400/35",
          "bg-[linear-gradient(180deg,#121523_0%,#0b0f1a_100%)]",
          "px-3 py-2 text-sm text-cyan-50 outline-none",
          // glossy + depth
          "shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_6px_20px_rgba(0,0,0,.35)]",
          // focus/hover
          "transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/30",
          "hover:border-cyan-400/55",
          // disabled
          "disabled:cursor-not-allowed disabled:opacity-60",
          // room for custom caret
          "pr-9 appearance-none",
          className,
        ].join(" ")}
        style={{
          // caret emas
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='%23d2b68a' viewBox='0 0 20 20'><path d='M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z'/></svg>\")",
          backgroundRepeat: "no-repeat",
          backgroundSize: "16px 16px",
          backgroundPosition: "right 0.7rem center",
          ...style,
        }}
      />
    );
  }
);

SelectDark.displayName = "SelectDark";
export default SelectDark;
