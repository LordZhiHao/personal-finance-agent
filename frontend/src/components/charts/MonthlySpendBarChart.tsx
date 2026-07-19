import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Transaction } from "../../types";
import { sumByMonthAndGroup } from "../../lib/dates";
import { CHROME, colorForCategory } from "../../lib/palette";
import { axisTickStyle, legendStyle, tooltipStyle } from "./chartTheme";

export function MonthlySpendBarChart({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: string[];
}) {
  const expenses = transactions.filter((t) => t.amount < 0);
  const data = sumByMonthAndGroup(
    expenses,
    (t) => t.date,
    (t) => t.category || "Other",
    (t) => Math.abs(t.amount),
  );
  const presentCategories = categories.filter((c) => data.some((row) => typeof row[c] === "number"));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHROME.gridline} vertical={false} />
        <XAxis dataKey="label" tick={axisTickStyle} axisLine={{ stroke: CHROME.baseline }} tickLine={false} />
        <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={legendStyle} />
        {presentCategories.map((cat) => (
          <Bar
            key={cat}
            dataKey={cat}
            stackId="spend"
            fill={colorForCategory(cat)}
            radius={[0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
