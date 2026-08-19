import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Transaction } from "../../types";
import { sumByMonthAndGroup } from "../../lib/dates";
import { CHROME, colorForKey } from "../../lib/palette";
import { formatMoney } from "../../lib/format";
import { axisTickStyle, tooltipStyle } from "./chartTheme";
import { ChartLegend } from "./ChartLegend";

export function MonthlySpendBarChart({
  transactions,
  categories,
  categoryColors,
  currency,
  fill = false,
}: {
  transactions: Transaction[];
  categories: string[];
  categoryColors: string[];
  currency: string;
  fill?: boolean;
}) {
  const expenses = transactions.filter((t) => t.amount < 0);
  const data = sumByMonthAndGroup(
    expenses,
    (t) => t.date,
    (t) => t.category || "Other",
    (t) => Math.abs(t.converted_amount ?? t.amount),
  );
  const presentCategories = categories.filter((c) => data.some((row) => typeof row[c] === "number"));

  // Sum each category's spend across every month currently shown, then sort
  // descending — this drives both the stack order (biggest category's band
  // is drawn first/bottom-most) and the legend list below, so an unbounded
  // category count no longer means an unbounded, unsorted legend wrap that
  // fights the chart for the same fixed mobile card height (the legend is
  // now its own small scrollable strip instead).
  const categoryTotals = presentCategories.map((cat) => ({
    name: cat,
    value: data.reduce((sum, row) => sum + (typeof row[cat] === "number" ? (row[cat] as number) : 0), 0),
    color: colorForKey(cat, categoryColors),
  }));
  const sortedCategories = [...categoryTotals].sort((a, b) => b.value - a.value).map((c) => c.name);

  return (
    <div className={fill ? "flex-1 min-h-0 flex flex-col" : undefined}>
      <ResponsiveContainer width="100%" height={fill ? "100%" : 280} minHeight={fill ? 280 : undefined}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHROME.gridline} vertical={false} />
          <XAxis dataKey="label" tick={axisTickStyle} axisLine={{ stroke: CHROME.baseline }} tickLine={false} />
          <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle} />
          {sortedCategories.map((cat) => (
            <Bar
              key={cat}
              dataKey={cat}
              stackId="spend"
              fill={colorForKey(cat, categoryColors)}
              radius={[0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      {categoryTotals.length > 0 && (
        <ChartLegend
          items={categoryTotals}
          formatValue={(v) => formatMoney(v, currency)}
          className="mt-2 max-h-24 overflow-y-auto shrink-0"
        />
      )}
    </div>
  );
}
