import type { ReactNode } from "react";
import { Card } from "./ui/Card";

export function ChartCard({
  title,
  subtitle,
  headerRight,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
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
      {children}
    </Card>
  );
}
