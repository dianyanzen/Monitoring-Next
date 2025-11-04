// FILE: src/components/ui/SelectFancy.tsx
"use client";

import { useEffect, useMemo, useState, useId } from "react";
import dynamic from "next/dynamic";
import type { Props as RSProps, StylesConfig, ThemeConfig } from "react-select";
import chroma from "chroma-js";

// React Select hanya di client (no SSR, hindari hydration warning)
const Select = dynamic(() => import("react-select"), { ssr: false });

type Option = { value: string; label: string };

export type SelectFancyProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  isDisabled?: boolean;
  isLoading?: boolean;
  isClearable?: boolean;
  menuPlacement?: RSProps<Option, false>["menuPlacement"];
  className?: string;
};

/** =======================
 *  Styles — TOKEN-BASED
 *  ======================= */
const baseStyles: StylesConfig<Option, false> = {
  control: (p, s) => ({
    ...p,
    borderRadius: 12,
    borderColor: s.isFocused ? "var(--accent)" : "var(--panel-border)",
    background: "var(--panel-bg)",
    minHeight: 40,
    boxShadow: s.isFocused
      ? "0 0 0 3px rgba(34,211,238,.25)" // ring aksen (tetap oke di light)
      : "inset 0 1px 0 rgba(0,0,0,.04)",
    transition: "all .18s ease",
    cursor: "pointer",
    "&:hover": { borderColor: "var(--accent)" },
  }),
  valueContainer: (p) => ({ ...p, paddingInline: 12, color: "var(--ink)", fontSize: 13, fontWeight: 500 }),
  input: (p) => ({ ...p, color: "var(--ink)" }),
  placeholder: (p) => ({ ...p, color: "var(--ink-muted)", fontWeight: 400 }),
  singleValue: (p) => ({ ...p, color: "var(--ink)", fontWeight: 600 }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (p, s) => ({
    ...p,
    color: s.isFocused ? "var(--accent)" : "var(--ink-muted)",
    "&:hover": { color: "var(--accent)" },
  }),
  menu: (p) => ({
    ...p,
    background: "var(--surface-1)",
    borderRadius: 12,
    border: "1px solid var(--panel-border)",
    boxShadow: "var(--panel-shadow)",
    overflow: "hidden",
    zIndex: 30,
  }),
  menuList: (p) => ({ ...p, paddingBlock: 4, maxHeight: 240 }),
  option: (p, s) => {
    const sel = chroma("#22d3ee").alpha(0.22).css();
    const focus = chroma("#0ea5e9").alpha(0.25).css();
    return {
      ...p,
      backgroundColor: s.isFocused ? focus : s.isSelected ? sel : "transparent",
      color: s.isSelected ? "var(--ink)" : s.isFocused ? "var(--ink)" : "var(--ink-muted)",
      cursor: "pointer",
      fontSize: 13,
      fontWeight: s.isSelected ? 700 : 500,
      paddingBlock: 8,
      paddingInline: 14,
      transition: "all .15s ease",
    };
  },
  noOptionsMessage: (p) => ({ ...p, color: "var(--ink-muted)", fontSize: 12 }),
  clearIndicator: (p) => ({ ...p, color: "#ef4444", "&:hover": { color: "#fca5a5" } }),
};

const theme: ThemeConfig = (base) => ({
  ...base,
  colors: {
    ...base.colors,
    // React Select mewarnai beberapa elemen via theme.colors.
    // CSS var() aman di inline-style browser modern.
    primary: "var(--accent)",
    primary75: "var(--accent)",
    primary50: "var(--accent)",
    primary25: "var(--accent)",
    neutral0: "var(--surface-1)",
    neutral5: "var(--surface-1)",
    neutral10: "var(--panel-border)",
    neutral20: "var(--panel-border)",
    neutral30: "var(--panel-border)",
    neutral40: "var(--ink-muted)",
    neutral50: "var(--ink-muted)",
    neutral60: "var(--ink)",
    neutral70: "var(--ink)",
    neutral80: "var(--ink)",
    neutral90: "var(--ink)",
  },
  spacing: { ...base.spacing, controlHeight: 40, baseUnit: 4 },
});

export default function SelectFancy({
  value,
  onValueChange,
  options,
  placeholder,
  isDisabled,
  isLoading,
  isClearable = false,
  menuPlacement = "auto",
  className,
}: SelectFancyProps) {
  // Hindari SSR/hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const reactId = useId();
  const current = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value],
  );

  if (!mounted) {
    // skeleton mengikuti token (supaya light gelapnya tidak “nabrak”)
    return (
      <div
        className={`min-w-[220px] h-10 rounded-lg border border-[var(--panel-border)] bg-[var(--surface-1)] ${className || ""}`}
      />
    );
  }

  return (
    <div className={className} suppressHydrationWarning>
      {/* Penting: komponen dynamic() bukan generic; jangan beri type args di JSX */}
      <Select
        classNamePrefix="rs"
        instanceId={placeholder || reactId}
        options={options}
        value={current}
        isDisabled={!!isDisabled}
        isClearable={isClearable}
        placeholder={placeholder}
        isLoading={!!isLoading}
        onChange={(opt: any) => onValueChange(opt?.value ?? "")}
        styles={baseStyles}
        theme={theme}
        menuPlacement={menuPlacement}
        classNames={{ container: () => "!text-[13px]" }}
        noOptionsMessage={() => "Tidak ada pilihan"}
      />
    </div>
  );
}

export type { Option };
