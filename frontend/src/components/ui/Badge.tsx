import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export type BadgeTint = "brand" | "amber" | "peach" | "green" | "red" | "neutral";

const TINT_STYLE: Record<BadgeTint, { bg: string; text: string }> = {
  brand: { bg: "var(--brand-tint)", text: "var(--brand-hover)" },
  amber: { bg: "var(--tint-amber-bg)", text: "var(--tint-amber-text)" },
  peach: { bg: "var(--tint-peach-bg)", text: "var(--tint-peach-text)" },
  green: { bg: "var(--tint-green-bg)", text: "var(--tint-green-text)" },
  red: { bg: "var(--tint-red-bg)", text: "var(--tint-red-text)" },
  neutral: { bg: "var(--tint-neutral-bg)", text: "var(--tint-neutral-text)" },
};

export function Badge({
  tint = "neutral",
  className,
  children,
  ...rest
}: { tint?: BadgeTint; className?: string; children?: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  const { bg, text } = TINT_STYLE[tint];
  return (
    <span
      className={clsx("inline-flex items-center rounded-full text-xs font-medium px-2.5 py-1", className)}
      style={{ background: bg, color: text }}
      {...rest}
    >
      {children}
    </span>
  );
}

export function Pill(props: Parameters<typeof Badge>[0]) {
  return <Badge {...props} />;
}
