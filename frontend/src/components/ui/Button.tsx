import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

export type ButtonVariant = "primary" | "outline" | "ghost";

export function Button({
  variant = "primary",
  className,
  style,
  ...rest
}: { variant?: ButtonVariant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = "text-sm font-medium px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  if (variant === "primary") {
    return (
      <button
        type="button"
        className={clsx(base, "text-white hover:brightness-95", className)}
        style={{ background: "var(--brand)", borderRadius: "var(--radius-control)", ...style }}
        {...rest}
      />
    );
  }

  if (variant === "outline") {
    return (
      <button
        type="button"
        className={clsx(base, "hover:bg-black/[0.03]", className)}
        style={{
          borderRadius: "var(--radius-control)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          background: "transparent",
          ...style,
        }}
        {...rest}
      />
    );
  }

  return (
    <button
      type="button"
      className={clsx(base, "hover:bg-black/[0.03]", className)}
      style={{ borderRadius: "var(--radius-control)", color: "var(--text-secondary)", background: "transparent", ...style }}
      {...rest}
    />
  );
}
