// See echarts-pilot/NetWorthLineChartEcharts.tsx (still present until this
// migration's later phases) for why /esm/core is used instead of /lib/core.
import ReactEChartsCore from "echarts-for-react/esm/core";
import type { Transaction } from "../../types";
import { sumByMonth } from "../../lib/dates";
import { resolveCssVar, useEchartsPalette } from "../../lib/echartsTheme";
import { echarts } from "./echartsCore";

export function SavingsRateLineChart({
  transactions,
  fill = false,
}: {
  transactions: Transaction[];
  fill?: boolean;
}) {
  const palette = useEchartsPalette();
  const statusGood = resolveCssVar("var(--status-good)");
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
  const expenseByMonth = new Map(expense.map((p) => [p.month, p.value]));
  const data = income.map((p) => {
    const spend = expenseByMonth.get(p.month) ?? 0;
    const rate = p.value ? ((p.value - spend) / p.value) * 100 : 0;
    return { month: p.month, label: p.label, rate: Math.round(rate * 10) / 10 };
  });

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
      valueFormatter: (v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}%` : String(v)),
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
      axisLabel: { color: palette.textMuted, fontSize: 12, formatter: "{value}%" },
    },
    series: [
      {
        type: "line" as const,
        data: data.map((d) => d.rate),
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: palette.brand, width: 2 },
        itemStyle: { color: palette.brand },
        markLine: {
          symbol: "none" as const,
          silent: true,
          animation: false,
          lineStyle: { color: statusGood, type: "dashed" as const },
          label: { formatter: "50% target", color: statusGood, fontSize: 11, position: "insideEndTop" as const },
          data: [{ yAxis: 50 }],
        },
      },
    ],
  };

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      notMerge
      lazyUpdate
      style={{ width: "100%", height: fill ? "100%" : 280, minHeight: fill ? 280 : undefined }}
    />
  );
}
