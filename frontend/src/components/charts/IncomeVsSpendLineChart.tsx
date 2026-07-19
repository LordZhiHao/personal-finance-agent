import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Transaction } from "../../types";
import { sumByMonth } from "../../lib/dates";
import { CHROME } from "../../lib/palette";
import { axisTickStyle, legendStyle, tooltipStyle } from "./chartTheme";

export function IncomeVsSpendLineChart({ transactions }: { transactions: Transaction[] }) {
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
  const months = [...new Set([...income, ...expense].map((p) => p.month))].sort();
  const incomeByMonth = new Map(income.map((p) => [p.month, p.value]));
  const expenseByMonth = new Map(expense.map((p) => [p.month, p.value]));
  const data = months.map((month) => ({
    month,
    label: income.find((p) => p.month === month)?.label ?? expense.find((p) => p.month === month)?.label,
    Income: incomeByMonth.get(month) ?? 0,
    Spend: expenseByMonth.get(month) ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHROME.gridline} vertical={false} />
        <XAxis dataKey="label" tick={axisTickStyle} axisLine={{ stroke: CHROME.baseline }} tickLine={false} />
        <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={legendStyle} />
        <Line type="monotone" dataKey="Income" stroke="var(--series-2)" strokeWidth={2} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="Spend" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
