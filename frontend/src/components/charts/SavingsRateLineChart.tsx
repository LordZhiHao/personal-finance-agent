import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Transaction } from "../../types";
import { sumByMonth } from "../../lib/dates";
import { CHROME } from "../../lib/palette";
import { axisTickStyle, tooltipStyle } from "./chartTheme";

export function SavingsRateLineChart({ transactions }: { transactions: Transaction[] }) {
  const income = sumByMonth(
    transactions.filter((t) => t.amount > 0),
    (t) => t.date,
    (t) => t.amount,
  );
  const expense = sumByMonth(
    transactions.filter((t) => t.amount < 0),
    (t) => t.date,
    (t) => Math.abs(t.amount),
  );
  const expenseByMonth = new Map(expense.map((p) => [p.month, p.value]));
  const data = income.map((p) => {
    const spend = expenseByMonth.get(p.month) ?? 0;
    const rate = p.value ? ((p.value - spend) / p.value) * 100 : 0;
    return { month: p.month, label: p.label, rate: Math.round(rate * 10) / 10 };
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHROME.gridline} vertical={false} />
        <XAxis dataKey="label" tick={axisTickStyle} axisLine={{ stroke: CHROME.baseline }} tickLine={false} />
        <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} unit="%" />
        <Tooltip {...tooltipStyle} />
        <ReferenceLine y={50} stroke="var(--status-good)" strokeDasharray="4 4" label={{ value: "50% target", fill: "var(--status-good)", fontSize: 11, position: "insideTopRight" }} />
        <Line type="monotone" dataKey="rate" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
