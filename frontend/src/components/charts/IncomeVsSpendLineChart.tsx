// See echarts-pilot/NetWorthLineChartEcharts.tsx (still present until this
// migration's later phases) for why /esm/core is used instead of /lib/core.
import ReactEChartsCore from "echarts-for-react/esm/core";
import type { Transaction } from "../../types";
import { sumByMonth } from "../../lib/dates";
import { useEchartsPalette } from "../../lib/echartsTheme";
import { echarts } from "./echartsCore";
import { ChartLegend } from "./ChartLegend";

export function IncomeVsSpendLineChart({
  transactions,
  fill = false,
}: {
  transactions: Transaction[];
  fill?: boolean;
}) {
  const palette = useEchartsPalette();
  const income = sumByMonth(
    transactions.filter((t) => t.amount > 0),
    (t) => t.date,
    (t) => t.converted_amount ?? t.amount,
  );
  const expense = sumByMonth(
    transactions.filter((t) => t.amount < 0),
    (t) => t.date,
    (t) => Math.abs(t.converted_amount ?? t.amount),
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

  // var(--series-7) / var(--series-1) in the pre-migration Recharts version.
  const incomeColor = palette.categoricalA[6];
  const spendColor = palette.categoricalA[0];
  const totalIncome = data.reduce((sum, d) => sum + d.Income, 0);
  const totalSpend = data.reduce((sum, d) => sum + d.Spend, 0);

  const option = {
    animationDuration: 700,
    animationEasing: "cubicOut" as const,
    grid: { left: 48, right: 16, top: 16, bottom: 32 },
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      textStyle: { color: palette.textSecondary, fontSize: 12 },
      valueFormatter: (v: unknown) => (typeof v === "number" ? v.toFixed(2) : String(v)),
    },
    xAxis: {
      type: "category" as const,
      data: data.map((d) => d.label),
      boundaryGap: false,
      axisLine: { lineStyle: { color: palette.baseline } },
      axisTick: { show: false },
      axisLabel: { color: palette.textMuted, fontSize: 12 },
    },
    yAxis: {
      type: "value" as const,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: palette.gridline, type: "dashed" as const } },
      axisLabel: { color: palette.textMuted, fontSize: 12 },
    },
    series: [
      {
        name: "Income",
        type: "line" as const,
        data: data.map((d) => d.Income),
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: incomeColor, width: 2 },
        itemStyle: { color: incomeColor },
      },
      {
        name: "Spend",
        type: "line" as const,
        data: data.map((d) => d.Spend),
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: spendColor, width: 2 },
        itemStyle: { color: spendColor },
      },
    ],
  };

  return (
    <div className={fill ? "flex-1 min-h-0 flex flex-col" : undefined}>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        notMerge
        lazyUpdate
        style={{ width: "100%", height: fill ? "100%" : 280, minHeight: fill ? 280 : undefined }}
      />
      <ChartLegend
        items={[
          { name: "Income", value: totalIncome, color: incomeColor },
          { name: "Spend", value: totalSpend, color: spendColor },
        ]}
        formatValue={(v) => v.toFixed(2)}
        className="mt-2 shrink-0"
      />
    </div>
  );
}
