import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import clsx from "clsx";

export function Table({ className, children, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={clsx("w-full border-collapse", className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr style={{ background: "var(--tint-peach-header)" }}>{children}</tr>
    </thead>
  );
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function Tr({ className, children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={className} style={{ borderBottom: "1px solid var(--gridline)" }} {...rest}>
      {children}
    </tr>
  );
}

export function Th({
  align = "left",
  className,
  children,
  ...rest
}: { align?: "left" | "right" } & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={clsx(
        "text-xs font-medium uppercase tracking-wide py-3 px-3",
        align === "right" ? "text-right" : "text-left",
        className
      )}
      style={{ color: "var(--text-secondary)" }}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({
  align = "left",
  className,
  children,
  ...rest
}: { align?: "left" | "right" } & TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={clsx(
        "text-sm py-3 px-3 tabular-nums",
        align === "right" ? "text-right" : "text-left",
        className
      )}
      style={{ color: "var(--text-primary)" }}
      {...rest}
    >
      {children}
    </td>
  );
}
