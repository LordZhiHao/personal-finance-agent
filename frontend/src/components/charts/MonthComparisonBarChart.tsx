import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Transaction } from "../../types";
import { monthComparison } from "../../lib/dates";
import { CHROME } from "../../lib/palette";
import { axisTickStyle, legendStyle, tooltipStyle } from "./chartTheme";

export function MonthComparisonBarChart({ transactions }: { transactions: Transaction[] }) {
  const rows = monthComparison(transactions).slice(0, 8);

  if (rows.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>Not enough data for a month-over-month comparison yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHROME.gridline} vertical={false} />
        <XAxis dataKey="category" tick={axisTickStyle} axisLine={{ stroke: CHROME.baseline }} tickLine={false} />
        <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={legendStyle} />
        <Bar dataKey="yearAgo" name="Same month last year" fill="var(--series-7)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="previous" name="Previous month" fill="var(--series-4)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="current" name="This month" fill="var(--series-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
