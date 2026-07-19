import type { ReactNode } from "react";

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
    >
      <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}
