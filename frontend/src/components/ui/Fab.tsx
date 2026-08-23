import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

export function Fab({ className, style, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={clsx(
        "md:hidden fixed z-40 flex items-center justify-center rounded-full text-white hover:brightness-95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      style={{
        right: "1.25rem",
        bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
        width: "3.5rem",
        height: "3.5rem",
        background: "var(--brand)",
        boxShadow: "var(--shadow-card)",
        ...style,
      }}
      {...rest}
    />
  );
}
