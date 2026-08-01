import type { ReactNode } from "react";
import type { CardTint } from "./Card";

const TINT_STYLE: Record<CardTint, { bg: string; text: string }> = {
  white: { bg: "var(--field-bg)", text: "var(--text-secondary)" },
  brand: { bg: "var(--brand-tint)", text: "var(--brand-hover)" },
  amber: { bg: "var(--tint-amber-bg)", text: "var(--tint-amber-text)" },
  peach: { bg: "var(--tint-peach-bg)", text: "var(--tint-peach-text)" },
  green: { bg: "var(--tint-green-bg)", text: "var(--tint-green-text)" },
  red: { bg: "var(--tint-red-bg)", text: "var(--tint-red-text)" },
  neutral: { bg: "var(--tint-neutral-bg)", text: "var(--tint-neutral-text)" },
};

export function IconBadge({
  icon,
  tint = "brand",
  onDark = false,
}: {
  icon: ReactNode;
  tint?: CardTint;
  /** For placement on a solid, saturated background (e.g. StatCard's hero variant) —
   * a translucent white circle instead of the normal tint pairing, which would be
   * unreadable against a solid brand-color card. */
  onDark?: boolean;
}) {
  const { bg, text } = onDark
    ? { bg: "rgba(255, 255, 255, 0.2)", text: "#fff" }
    : TINT_STYLE[tint];
  return (
    <div
      className="flex items-center justify-center shrink-0 text-lg"
      style={{ width: 40, height: 40, borderRadius: "var(--radius-control)", background: bg, color: text }}
    >
      {icon}
    </div>
  );
}
