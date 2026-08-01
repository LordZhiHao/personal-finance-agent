import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export type CardTint = "white" | "brand" | "amber" | "peach" | "green" | "red" | "neutral";

const TINT_BG: Record<CardTint, string> = {
  white: "var(--surface-1)",
  brand: "var(--brand-tint)",
  amber: "var(--tint-amber-bg)",
  peach: "var(--tint-peach-bg)",
  green: "var(--tint-green-bg)",
  red: "var(--tint-red-bg)",
  neutral: "var(--tint-neutral-bg)",
};

export function Card({
  tint = "white",
  padding = true,
  className,
  children,
  ...rest
}: {
  tint?: CardTint;
  padding?: boolean;
  className?: string;
  children?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("rounded-card", padding && "p-4", className)}
      style={{
        background: TINT_BG[tint],
        boxShadow: "var(--shadow-card)",
        borderRadius: "var(--radius-card)",
        border: tint === "white" ? "none" : "1px solid rgba(17, 24, 39, 0.06)",
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
