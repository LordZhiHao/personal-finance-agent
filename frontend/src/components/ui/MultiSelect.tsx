import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({ options, value, onChange, placeholder = "All", className }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? placeholder)
        : `${value.length} selected`;

  return (
    <div ref={ref} className={clsx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left outline-none focus:border-[var(--brand)]"
        style={{
          background: "var(--field-bg)",
          color: "var(--text-primary)",
          border: "1px solid transparent",
          borderRadius: "var(--radius-control)",
        }}
      >
        <span className="truncate">{label}</span>
        <span aria-hidden="true" style={{ color: "var(--text-muted)" }}>
          ▾
        </span>
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 p-1 max-h-56 overflow-y-auto"
          style={{
            background: "var(--surface-1)",
            borderRadius: "var(--radius-control)",
            boxShadow: "var(--shadow-card)",
            border: "1px solid var(--border)",
            minWidth: "100%",
            width: "max-content",
          }}
        >
          {options.map((o) => (
            <label
              key={o.value}
              className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-black/[0.03] whitespace-nowrap"
              style={{ color: "var(--text-primary)", borderRadius: "var(--radius-control)" }}
            >
              <input
                type="checkbox"
                checked={value.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="accent-[var(--brand)]"
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
