"use client";

import { Children, isValidElement, useMemo } from "react";
import SelectFancy from "@/components/ui/SelectFancy";

type NativeOption = {
  value: string;
  label: string;
};

type TypeableSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  children?: React.ReactNode;
};

function readOptionText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node) return "";
  const parts: string[] = [];
  Children.forEach(node, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      parts.push(String(child));
      return;
    }
    if (isValidElement<{ children?: React.ReactNode }>(child)) {
      parts.push(readOptionText(child.props.children));
    }
  });
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function extractOptions(children: React.ReactNode): NativeOption[] {
  const options: NativeOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: unknown; children?: React.ReactNode }>(child)) return;

    const tag = typeof child.type === "string" ? child.type.toLowerCase() : "";
    if (tag === "option") {
      const rawValue = child.props.value;
      options.push({
        value: rawValue == null ? "" : String(rawValue),
        label: readOptionText(child.props.children),
      });
      return;
    }

    if (tag === "optgroup") {
      options.push(...extractOptions(child.props.children));
    }
  });
  return options;
}

export default function TypeableSelect({
  value,
  onChange,
  disabled,
  required,
  className,
  children,
  ...rest
}: TypeableSelectProps) {
  const options = useMemo(() => extractOptions(children), [children]);
  const firstEmpty = options.find((opt) => opt.value === "");
  const normalizedOptions = useMemo(() => options.filter((opt) => opt.value !== ""), [options]);
  const normalizedValue = value == null ? "" : String(value);

  const fallbackPlaceholder = firstEmpty?.label || "Pilih data";

  const handleChange = (nextValue: string) => {
    if (!onChange) return;
    const syntheticEvent = {
      target: { value: nextValue },
      currentTarget: { value: nextValue },
    } as React.ChangeEvent<HTMLSelectElement>;
    onChange(syntheticEvent);
  };

  return (
    <SelectFancy
      value={normalizedValue}
      onValueChange={handleChange}
      options={normalizedOptions}
      placeholder={fallbackPlaceholder}
      isDisabled={!!disabled}
      isClearable={!required}
      className={`w-full [--accent:#22d3ee] [--panel-bg:#0f172a] [--surface-1:#0f172a] [--panel-border:rgba(34,211,238,0.35)] [--panel-shadow:0_12px_28px_rgba(0,0,0,0.45)] [--ink:#e0f2fe] [--ink-muted:#a5c9df] ${className || ""}`}
      {...(rest as any)}
    />
  );
}
