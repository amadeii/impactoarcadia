import React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DateInputBRProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Input de data no formato brasileiro (DD/MM/AAAA).
 * Armazena o valor no formato ISO (YYYY-MM-DD) internamente.
 */
export function DateInputBR({ value, onChange, placeholder = "DD/MM/AAAA", className, disabled, id }: DateInputBRProps) {
  const displayValue = isoToBR(value ?? "");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    let formatted = raw;
    if (raw.length > 2) formatted = raw.slice(0, 2) + "/" + raw.slice(2);
    if (raw.length > 4) formatted = raw.slice(0, 2) + "/" + raw.slice(2, 4) + "/" + raw.slice(4);
    e.target.value = formatted;
    if (raw.length === 8) {
      const iso = brToIso(formatted);
      onChange?.(iso);
    } else {
      onChange?.("");
    }
  }

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      defaultValue={displayValue}
      key={displayValue}
      onChange={handleChange}
      disabled={disabled}
      className={cn("font-mono", className)}
      maxLength={10}
    />
  );
}

export function formatDateBR(iso?: string | null): string {
  if (!iso) return "";
  return isoToBR(iso);
}

function isoToBR(iso: string): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function brToIso(br: string): string {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}
