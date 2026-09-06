import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
// See echarts-pilot/SpendByCategoryDonutEcharts.tsx (still present until this
// migration's later phases) for why /esm/core is used instead of /lib/core.
import ReactEChartsCore from "echarts-for-react/esm/core";
import type { PortfolioEvent } from "../../types";
import { colorForKey } from "../../lib/palette";
import { formatMoney } from "../../lib/format";
import { resolveCssVar, useEchartsPalette } from "../../lib/echartsTheme";
import { echarts } from "./echartsCore";
import { ChartLegend } from "./ChartLegend";
import { MonthStepper } from "../MonthStepper";
import { TransactionDrillDownOverlay } from "../TransactionDrillDownOverlay";
import { Select, TabToggle } from "../ui";

function currencyTotals(events: PortfolioEvent[]) {
  const totals = new Map<string, { native: number; converted: number }>();
  for (const e of events) {
    const prev = totals.get(e.currency) ?? { native: 0, converted: 0 };
    totals.set(e.currency, {
      native: prev.native + e.quantity * e.price,
      converted: prev.converted + (e.converted_value ?? e.quantity * e.price),
    });
  }
  // Sorted by (converted) magnitude so the pie's slice order and the
  // ChartLegend list order below it agree on "biggest first".
  return [...totals.entries()]
    .map(([name, v]) => ({ name, value: v.converted, nativeValue: v.native }))
    .sort((a, b) => b.value - a.value);
}

type ViewMode = "year" | "month";

export function DividendsByCurrencyDonut({
  events,
  displayCurrency,
  fill = false,
}: {
  events: PortfolioEvent[];
  displayCurrency: string;
  fill?: boolean;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("year");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const palette = useEchartsPalette();

  // Stable, alphabetically-sorted currency order across all history (not just the
  // filtered period) so a currency keeps the same color as the user switches
  // year/month — same rationale as categoryColors passed into SpendByCategoryDonut.
  const knownCurrencies = useMemo(
    () => [...new Set(events.map((e) => e.currency))].sort(),
    [events],
  );

  const years = useMemo(() => {
    const ys = [...new Set(events.map((e) => parseISO(e.date).getFullYear()))].sort((a, b) => b - a);
    return ys.length > 0 ? ys : [new Date().getFullYear()];
  }, [events]);

  const periodEvents = useMemo(() => {
    if (viewMode === "year") {
      return events.filter((e) => parseISO(e.date).getFullYear() === selectedYear);
    }
    const monthStr = format(selectedMonth, "yyyy-MM");
    return events.filter((e) => e.date.startsWith(monthStr));
  }, [events, viewMode, selectedYear, selectedMonth]);

  const data = useMemo(() => currencyTotals(periodEvents), [periodEvents]);

  const selectedTotal = selectedCurrency ? (data.find((d) => d.name === selectedCurrency)?.nativeValue ?? 0) : 0;
  const selectedEvents = selectedCurrency
    ? periodEvents.filter((e) => e.currency === selectedCurrency).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const periodLabel = viewMode === "year" ? String(selectedYear) : format(selectedMonth, "MMMM yyyy");

  const option = {
    animationDuration: 700,
    animationEasing: "elasticOut" as const,
    tooltip: {
      trigger: "item" as const,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      textStyle: { color: palette.textSecondary, fontSize: 12 },
      formatter: (params: { name: string; value: number }) =>
        `${params.name}: ${formatMoney(params.value, displayCurrency)}`,
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
          itemStyle: { color: resolveCssVar(colorForKey(d.name, knownCurrencies)) },
        })),
      },
    ],
  };

  return (
    <div className={fill ? "flex-1 min-h-0 flex flex-col" : undefined}>
      <div className="flex flex-wrap items-center justify-center gap-3 mb-2">
        <TabToggle
          options={[
            { value: "year", label: "Year" },
            { value: "month", label: "Month" },
          ]}
          value={viewMode}
          onChange={setViewMode}
        />
        {viewMode === "year" ? (
          <Select
            value={String(selectedYear)}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-24"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        ) : (
          <MonthStepper value={selectedMonth} onChange={(d) => setSelectedMonth(d ?? new Date())} />
        )}
      </div>

      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--text-secondary)" }}>
          No dividends in {periodLabel}.
        </div>
      ) : (
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          notMerge
          lazyUpdate
          onEvents={{ click: (params: { name: string }) => setSelectedCurrency(params.name) }}
          style={{ width: "100%", height: fill ? "100%" : 280, minHeight: fill ? 280 : undefined }}
        />
      )}

      {data.length > 0 && (
        <ChartLegend
          items={data.map((d) => ({ name: d.name, value: d.value, color: colorForKey(d.name, knownCurrencies) }))}
          formatValue={(v) => formatMoney(v, displayCurrency)}
          onSelect={setSelectedCurrency}
          className="mt-2"
        />
      )}

      {selectedCurrency && (
        <TransactionDrillDownOverlay
          title={`${selectedCurrency} Dividends — ${periodLabel}`}
          subtitle={`Total received: ${formatMoney(selectedTotal, selectedCurrency)}`}
          rows={selectedEvents}
          onClose={() => setSelectedCurrency(null)}
          columns={[
            { header: "Ticker", render: (e) => e.ticker },
            { header: "Date", render: (e) => format(parseISO(e.date), "d MMM yyyy") },
            { header: "Amount", align: "right", render: (e) => formatMoney(e.quantity * e.price, e.currency) },
          ]}
        />
      )}
    </div>
  );
}
