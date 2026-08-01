import type { ReactNode } from "react";
import { Card } from "./ui/Card";

export function ChartCard({
  title,
  subtitle,
  headerRight,
  badge,
  children,
  /** Stretch the card to fill its grid row (matching a taller sibling chart)
   * and let its content grow to fill the remaining space. */
  fill = false,
}: {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  fill?: boolean;
}) {
  return (
    <Card className={fill ? "h-full flex flex-col" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold" style={{ color: "var(--text-heading)" }}>
              {title}
            </h3>
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {headerRight}
      </div>
      {fill ? <div className="flex-1 min-h-0 flex flex-col">{children}</div> : children}
    </Card>
  );
}
