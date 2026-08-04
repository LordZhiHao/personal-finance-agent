import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import clsx from "clsx";

const fieldStyle = {
  background: "var(--field-bg)",
  color: "var(--text-primary)",
  border: "1px solid transparent",
  borderRadius: "var(--radius-control)",
};

export function Input({ className, style, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx("px-3 py-2 text-base md:text-sm outline-none focus:border-[var(--brand)]", className)}
      style={{ ...fieldStyle, ...style }}
      {...rest}
    />
  );
}

export function Select({ className, style, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx("px-3 py-2 text-base md:text-sm outline-none focus:border-[var(--brand)]", className)}
      style={{ ...fieldStyle, ...style }}
      {...rest}
    />
  );
}
