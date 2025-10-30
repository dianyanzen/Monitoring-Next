"use client";

import { useMemo } from "react";
import Select, { GroupBase, Props as RSProps, StylesConfig, ThemeConfig } from "react-select";
import chroma from "chroma-js";

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

const baseStyles: StylesConfig<Option, false> = {
  control: (provided, state) => ({
    ...provided,
    borderRadius: 12,
    borderColor: state.isFocused ? "#22d3ee" : "rgba(14,165,233,0.35)",
    background: "linear-gradient(180deg,#111827 0%,#0b1120 100%)",
    minHeight: 40,
    boxShadow: state.isFocused ? "0 0 0 3px rgba(45,211,254,0.25)" : "inset 0 1px 0 rgba(255,255,255,0.06)",
    transition: "all 0.18s ease",
    cursor: "pointer",
    "&:hover": {
      borderColor: "#38bdf8",
    },
  }),
  valueContainer: (provided) => ({
    ...provided,
    paddingInline: 12,
    color: "#e0f2fe",
    fontSize: 13,
    fontWeight: 500,
  }),
  input: (provided) => ({
    ...provided,
    color: "#e0f2fe",
  }),
  placeholder: (provided) => ({
    ...provided,
    color: "rgba(190,242,255,0.55)",
    fontWeight: 400,
  }),
  singleValue: (provided) => ({
    ...provided,
    color: "#e0f2fe",
    fontWeight: 600,
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  dropdownIndicator: (provided, state) => ({
    ...provided,
    color: state.isFocused ? "#22d3ee" : "#94a3b8",
    transition: "all 0.2s ease",
    "&:hover": {
      color: "#38bdf8",
    },
  }),
  menu: (provided) => ({
    ...provided,
    background: "#0f1729",
    borderRadius: 12,
    border: "1px solid rgba(56,189,248,0.35)",
    boxShadow: "0 22px 45px rgba(14,116,144,0.25)",
    overflow: "hidden",
    zIndex: 30,
  }),
  menuList: (provided) => ({
    ...provided,
    paddingBlock: 4,
    maxHeight: 240,
  }),
  option: (provided, state) => {
    const bg = state.isSelected ? chroma("#22d3ee").alpha(0.22).css() : "transparent";
    const color = state.isSelected ? "#f8fafc" : state.isFocused ? "#e0f2fe" : "#cbd5f5";
    return {
      ...provided,
      backgroundColor: state.isFocused ? chroma("#0ea5e9").alpha(0.25).css() : bg,
      color,
      cursor: "pointer",
      fontSize: 13,
      fontWeight: state.isSelected ? 700 : 500,
      paddingBlock: 8,
      paddingInline: 14,
      transition: "all 0.15s ease",
    };
  },
  noOptionsMessage: (provided) => ({
    ...provided,
    color: "rgba(190,242,255,0.6)",
    fontSize: 12,
  }),
  clearIndicator: (provided) => ({
    ...provided,
    color: "#f87171",
    "&:hover": {
      color: "#fca5a5",
    },
  }),
};

const theme: ThemeConfig = (base) => ({
  ...base,
  colors: {
    ...base.colors,
    primary: "#22d3ee",
    primary75: "#38bdf8",
    primary50: "#0ea5e9",
    primary25: "rgba(14,165,233,0.2)",
    neutral0: "#0f1729",
    neutral5: "rgba(14,165,233,0.08)",
    neutral10: "rgba(14,165,233,0.12)",
    neutral20: "rgba(148,163,184,0.35)",
    neutral30: "rgba(59,130,246,0.4)",
    neutral40: "#cbd5f5",
    neutral50: "rgba(148,163,184,0.65)",
    neutral60: "#bae6fd",
    neutral70: "#e2e8f0",
    neutral80: "#f8fafc",
    neutral90: "#f1f5f9",
  },
  spacing: {
    ...base.spacing,
    controlHeight: 40,
    baseUnit: 4,
  },
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
  const current = useMemo(() => options.find((opt) => opt.value === value) ?? null, [options, value]);

  return (
    <div className={className}>
      <Select<Option, false, GroupBase<Option>>
        instanceId={placeholder || "select"}
        options={options}
        value={current}
        isDisabled={isDisabled}
        isClearable={isClearable}
        placeholder={placeholder}
        isLoading={isLoading}
        onChange={(opt) => onValueChange(opt?.value ?? "")}
        styles={baseStyles}
        theme={theme}
        menuPlacement={menuPlacement}
        classNames={{
          container: () => "!text-[13px]",
        }}
        noOptionsMessage={() => "Tidak ada pilihan"}
      />
    </div>
  );
}

export type { Option };
