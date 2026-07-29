import type { ReactNode } from "react";

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {children}
      {error && (
        <span className="text-xs" style={{ color: "var(--tint-red-text)" }}>
          {error}
        </span>
      )}
    </label>
  );
}
