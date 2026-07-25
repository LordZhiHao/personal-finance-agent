import type { ReactNode } from "react";
import { Card, type CardTint } from "./ui/Card";
import { IconBadge } from "./ui/IconBadge";

export interface StatCardDelta {
  value: string;
  direction: "up" | "down";
}

export function StatCard({
  label,
  value,
  icon,
  tint,
  delta,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  tint?: CardTint;
  delta?: StatCardDelta;
}) {
  return (
    <Card tint={tint ?? "white"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {label}
          </div>
          <div className="text-2xl font-semibold tabular-nums mt-1" style={{ color: "var(--text-heading)" }}>
            {value}
          </div>
          {delta && (
            <div
              className="text-xs font-medium mt-1"
              style={{ color: delta.direction === "up" ? "var(--tint-green-text)" : "var(--tint-red-text)" }}
            >
              {delta.direction === "up" ? "▲" : "▼"} {delta.value}
            </div>
          )}
        </div>
        {icon && <IconBadge icon={icon} tint={tint ?? "brand"} />}
      </div>
    </Card>
  );
}
