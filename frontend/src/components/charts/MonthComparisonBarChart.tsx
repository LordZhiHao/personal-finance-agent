// See echarts-pilot/NetWorthLineChartEcharts.tsx (still present until this
// migration's later phases) for why /esm/core is used instead of /lib/core.
import ReactEChartsCore from "echarts-for-react/esm/core";
import type { Transaction } from "../../types";
import { monthComparison } from "../../lib/dates";
import { useEchartsPalette } from "../../lib/echartsTheme";
import { echarts } from "./echartsCore";
import { ChartLegend } from "./ChartLegend";

export function MonthComparisonBarChart({
  transactions,
  fill = false,
}: {
  transactions: Transaction[];
  fill?: boolean;
}) {
  const palette = useEchartsPalette();
  const rows = monthComparison(transactions).slice(0, 8);

  if (rows.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>Not enough data for a month-over-month comparison yet.</p>;
  }

  // var(--series-7) / var(--series-4) / var(--series-1) in the pre-migration
  // Recharts version.
  const yearAgoColor = palette.categoricalA[6];
  const previousColor = palette.categoricalA[3];
  const currentColor = palette.categoricalA[0];

  const option = {
    animationDuration: 700,
    animationEasing: "cubicOut" as const,
    grid: { left: 48, right: 16, top: 16, bottom: 32 },
    tooltip: {
      trigger: "axis" as const,
      axisPointer: { type: "shadow" as const },
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      textStyle: { color: palette.textSecondary, fontSize: 12 },
      valueFormatter: (v: unknown) => (typeof v === "number" ? v.toFixed(2) : String(v)),
    },
    xAxis: {
      type: "category" as const,
      data: rows.map((r) => r.category),
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
        name: "Same month last year",
        type: "bar" as const,
        data: rows.map((r) => r.yearAgo),
        itemStyle: { color: yearAgoColor, borderRadius: [4, 4, 0, 0] },
      },
      {
        name: "Previous month",
        type: "bar" as const,
        data: rows.map((r) => r.previous),
        itemStyle: { color: previousColor, borderRadius: [4, 4, 0, 0] },
      },
      {
        name: "This month",
        type: "bar" as const,
        data: rows.map((r) => r.current),
        itemStyle: { color: currentColor, borderRadius: [4, 4, 0, 0] },
      },
    ],
  };

  const totals = {
    yearAgo: rows.reduce((sum, r) => sum + r.yearAgo, 0),
    previous: rows.reduce((sum, r) => sum + r.previous, 0),
    current: rows.reduce((sum, r) => sum + r.current, 0),
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
          { name: "This month", value: totals.current, color: currentColor },
          { name: "Previous month", value: totals.previous, color: previousColor },
          { name: "Same month last year", value: totals.yearAgo, color: yearAgoColor },
        ]}
        formatValue={(v) => v.toFixed(2)}
        className="mt-2 shrink-0"
      />
    </div>
  );
}
