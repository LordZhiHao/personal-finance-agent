import type { ReactNode } from "react";
import { Card, type CardTint } from "./ui/Card";
import { IconBadge } from "./ui/IconBadge";

export interface StatCardDelta {
  value: string;
  /** Drives the ▲/▼ glyph — always the true direction of movement. */
  direction: "up" | "down";
  /** Drives the color, when it would otherwise disagree with `direction` (e.g. a
   * spend trend, where "up" is bad). Omit to keep the default up=green/down=red
   * mapping used by gain/loss-style cards. */
  sentiment?: "good" | "bad";
}

export function StatCard({
  label,
  value,
  icon,
  tint,
  delta,
  headerRight,
  hero = false,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  tint?: CardTint;
  delta?: StatCardDelta;
  headerRight?: ReactNode;
  /** Vivid solid-brand treatment for the single primary stat on a page — follows
   * the user's orange/green theme choice via var(--brand). Not the same as
   * tint="brand", which is a pale wash used elsewhere for a secondary accent. */
  hero?: boolean;
}) {
  const body = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-sm" style={{ color: hero ? "rgba(255, 255, 255, 0.8)" : "var(--text-secondary)" }}>
          {label}
        </div>
        <div
          className={hero ? "text-4xl font-extrabold tabular-nums mt-1" : "text-3xl font-bold tabular-nums mt-1"}
          style={{ color: hero ? "#fff" : "var(--text-heading)" }}
        >
          {value}
        </div>
        {delta && (
          <div
            className="text-xs font-medium mt-1"
            style={{
              color: hero
                ? "rgba(255, 255, 255, 0.9)"
                : (delta.sentiment ? delta.sentiment === "good" : delta.direction === "up")
                  ? "var(--tint-green-text)"
                  : "var(--tint-red-text)",
            }}
          >
            {delta.direction === "up" ? "▲" : "▼"} {delta.value}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {headerRight}
        {icon && <IconBadge icon={icon} tint={tint ?? "brand"} onDark={hero} />}
      </div>
    </div>
  );

  if (hero) {
    return (
      <div
        className="rounded-card p-5 h-full"
        style={{
          background: "var(--brand)",
          boxShadow: "var(--shadow-card)",
          borderRadius: "var(--radius-card)",
        }}
      >
        {body}
      </div>
    );
  }

  return <Card tint={tint ?? "white"}>{body}</Card>;
}
