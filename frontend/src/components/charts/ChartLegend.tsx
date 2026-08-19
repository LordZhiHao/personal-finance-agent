import clsx from "clsx";

export interface ChartLegendItem {
  name: string;
  value: number;
  color: string;
}

// Shared replacement for Recharts' default <Legend> across the donut charts
// and MonthlySpendBarChart — a vertical, sorted-by-magnitude list that also
// shows each item's value (Recharts' own legend shows only a swatch+name).
// Sorting here (not by the caller) is the single source of truth for "top to
// bottom by magnitude" everywhere this is used.
export function ChartLegend({
  items,
  formatValue,
  onSelect,
  className,
}: {
  items: ChartLegendItem[];
  formatValue: (value: number) => string;
  onSelect?: (name: string) => void;
  className?: string;
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value);

  return (
    <ul className={clsx("flex flex-col gap-1 text-sm", className)}>
      {sorted.map((item) => {
        const Tag = onSelect ? "button" : "div";
        return (
          <li key={item.name}>
            <Tag
              {...(onSelect ? { type: "button" as const, onClick: () => onSelect(item.name) } : {})}
              className={clsx(
                "w-full flex items-center gap-2 py-0.5 text-left",
                onSelect && "rounded hover:bg-black/[0.03] cursor-pointer",
              )}
            >
              <span
                className="shrink-0 rounded-sm"
                style={{ width: 10, height: 10, background: item.color }}
              />
              <span className="flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
                {item.name}
              </span>
              <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>
                {formatValue(item.value)}
              </span>
            </Tag>
          </li>
        );
      })}
    </ul>
  );
}
