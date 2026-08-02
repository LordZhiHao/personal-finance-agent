import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Transaction } from "../../types";
import { colorForCategory } from "../../lib/palette";
import { legendStyle, tooltipStyle } from "./chartTheme";

export function SpendByCategoryDonut({
  transactions,
  fill = false,
}: {
  transactions: Transaction[];
  fill?: boolean;
}) {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const cat = t.category || "Other";
    totals.set(cat, (totals.get(cat) ?? 0) + Math.abs(t.amount));
  }
  const data = [...totals.entries()].map(([name, value]) => ({ name, value }));

  return (
    <ResponsiveContainer width="100%" height={fill ? "100%" : 280} minHeight={fill ? 280 : undefined}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={1}>
          {data.map((d) => (
            <Cell key={d.name} fill={colorForCategory(d.name)} stroke="var(--surface-1)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={legendStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
