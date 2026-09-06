// See echarts-pilot/NetWorthLineChartEcharts.tsx (still present until this
// migration's later phases) for why /esm/core is used instead of /lib/core.
import ReactEChartsCore from "echarts-for-react/esm/core";
import type { Transaction } from "../../types";
import { sumByMonthAndGroup } from "../../lib/dates";
import { colorForKey } from "../../lib/palette";
import { formatMoney } from "../../lib/format";
import { resolveCssVar, useEchartsPalette } from "../../lib/echartsTheme";
import { echarts } from "./echartsCore";
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
  const palette = useEchartsPalette();
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
      valueFormatter: (v: unknown) => (typeof v === "number" ? formatMoney(v, currency) : String(v)),
    },
    xAxis: {
      type: "category" as const,
      data: data.map((d) => d.label),
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
    series: sortedCategories.map((cat) => ({
      name: cat,
      type: "bar" as const,
      stack: "spend",
      data: data.map((row) => (typeof row[cat] === "number" ? (row[cat] as number) : 0)),
      itemStyle: { color: resolveCssVar(colorForKey(cat, categoryColors)) },
    })),
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
