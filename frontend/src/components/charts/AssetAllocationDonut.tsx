import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { colorForKey } from "../../lib/palette";
import { formatMoney } from "../../lib/format";
import { tooltipStyle } from "./chartTheme";
import { ChartLegend } from "./ChartLegend";

export interface AllocationSlice {
  name: string;
  value: number;
}

export function AssetAllocationDonut({
  data,
  currency,
  fill = false,
}: {
  data: AllocationSlice[];
  currency: string;
  fill?: boolean;
}) {
  // Sorted by magnitude so the pie's slice order and the ChartLegend list
  // order below it agree on "biggest first"; color lookup uses the original
  // (unsorted) name order so colors stay stable regardless of display order.
  const names = data.map((d) => d.name);
  const sorted = [...data].sort((a, b) => b.value - a.value);

  return (
    <div className={fill ? "flex-1 min-h-0 flex flex-col" : undefined}>
      <ResponsiveContainer width="100%" height={fill ? "100%" : 280} minHeight={fill ? 280 : undefined}>
        <PieChart>
          <Pie data={sorted} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={1}>
            {sorted.map((d) => (
              <Cell key={d.name} fill={colorForKey(d.name, names)} stroke="var(--surface-1)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      {sorted.length > 0 && (
        <ChartLegend
          items={sorted.map((d) => ({ name: d.name, value: d.value, color: colorForKey(d.name, names) }))}
          formatValue={(v) => formatMoney(v, currency)}
          className="mt-2"
        />
      )}
    </div>
  );
}
