import ReactEChartsCore from "echarts-for-react/lib/core";
import { echarts } from "./echartsCore";
import { resolveCssVar, useEchartsPalette } from "../../../lib/echartsTheme";
import { colorForKey } from "../../../lib/palette";
import { formatMoney } from "../../../lib/format";

export interface CategoryTotal {
  name: string;
  value: number;
}

// Rendering-only counterpart to SpendByCategoryDonut's <PieChart> — deliberately
// scoped to just the chart (no month stepper, drill-down overlay, or edit
// dialog) since the pilot is judging ECharts' visual/motion/interactivity
// against Recharts, not re-implementing every page feature.
export function SpendByCategoryDonutEcharts({
  data,
  categoryColors,
  currency,
  fill = false,
}: {
  data: CategoryTotal[];
  categoryColors: string[];
  currency: string;
  fill?: boolean;
}) {
  const palette = useEchartsPalette();

  const option = {
    animationDuration: 700,
    animationEasing: "elasticOut" as const,
    tooltip: {
      trigger: "item" as const,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      textStyle: { color: palette.textSecondary, fontSize: 12 },
      formatter: (params: { name: string; value: number }) => `${params.name}: ${formatMoney(params.value, currency)}`,
    },
    series: [
      {
        type: "pie" as const,
        radius: ["45%", "75%"],
        padAngle: 2,
        itemStyle: {
          borderColor: palette.surface,
          borderWidth: 2,
          borderRadius: 6,
        },
        emphasis: {
          scale: true,
          scaleSize: 6,
          itemStyle: { shadowBlur: 12, shadowColor: "rgba(0, 0, 0, 0.25)" },
        },
        label: { show: false },
        data: data.map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: resolveCssVar(colorForKey(d.name, categoryColors)) },
        })),
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
