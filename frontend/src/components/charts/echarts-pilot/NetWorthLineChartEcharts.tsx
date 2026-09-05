import ReactEChartsCore from "echarts-for-react/lib/core";
import { format, parseISO } from "date-fns";
import { echarts } from "./echartsCore";
import { useEchartsPalette } from "../../../lib/echartsTheme";
import type { NetWorthPoint } from "../NetWorthLineChart";

// Same { points, fill } contract as the Recharts NetWorthLineChart this
// mirrors, so the two can be swapped in the chart-lab comparison without any
// data-shape translation.
export function NetWorthLineChartEcharts({ points, fill = false }: { points: NetWorthPoint[]; fill?: boolean }) {
  const palette = useEchartsPalette();
  const labels = points.map((p) => format(parseISO(p.date), "d MMM yyyy"));
  const values = points.map((p) => p.value);

  const option = {
    animationDuration: 900,
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
      data: labels,
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
        type: "line" as const,
        data: values,
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: palette.brand, width: 2 },
        itemStyle: { color: palette.brand },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: `${palette.brand}55` },
            { offset: 1, color: `${palette.brand}00` },
          ]),
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
