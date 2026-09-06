import { useMemo, useState } from "react";
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
// See echarts-pilot/SpendByCategoryDonutEcharts.tsx (still present until this
// migration's later phases) for why /esm/core is used instead of /lib/core.
import ReactEChartsCore from "echarts-for-react/esm/core";
import type { Account, Transaction } from "../../types";
import { useMeta, useTransactions } from "../../hooks/api";
import { colorForKey } from "../../lib/palette";
import { formatMoney } from "../../lib/format";
import { resolveCssVar, useEchartsPalette } from "../../lib/echartsTheme";
import { echarts } from "./echartsCore";
import { ChartLegend } from "./ChartLegend";
import { MonthStepper } from "../MonthStepper";
import { TransactionDrillDownOverlay } from "../TransactionDrillDownOverlay";
import { EditTransactionDialog } from "../EditTransactionDialog";

function categoryTotals(transactions: Transaction[]) {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const cat = t.category || "Other";
    totals.set(cat, (totals.get(cat) ?? 0) + Math.abs(t.converted_amount ?? t.amount));
  }
  // Sorted by magnitude so the pie's slice order (12 o'clock, clockwise) and
  // the ChartLegend list order below it agree on "biggest first".
  return [...totals.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function SpendByCategoryDonut({
  transactions,
  categoryColors,
  currency,
  accounts,
  categories,
  allAccounts,
  fill = false,
}: {
  transactions: Transaction[];
  categoryColors: string[];
  currency: string;
  accounts?: string[];
  categories: string[];
  allAccounts: Account[];
  fill?: boolean;
}) {
  const [monthFilter, setMonthFilter] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const palette = useEchartsPalette();

  // Independent per-month fetch once a month is picked, mirroring
  // SpendingHeatmap — so any month in history works immediately, not just
  // whatever the page's own FilterBar date range already loaded. "All Time"
  // (monthFilter === null) instead reuses the `transactions` prop as-is,
  // preserving today's default total-value behavior exactly.
  const monthStart = monthFilter ? format(startOfMonth(monthFilter), "yyyy-MM-dd") : "";
  const monthEnd = monthFilter ? format(endOfMonth(monthFilter), "yyyy-MM-dd") : "";
  const monthTxQuery = useTransactions(monthStart, monthEnd, currency, monthFilter != null);
  const metaQuery = useMeta();
  const classifications = metaQuery.data?.category_classifications ?? {};

  const displayedTransactions = useMemo(() => {
    if (!monthFilter) return transactions;
    const txns = monthTxQuery.data ?? [];
    const spendOnly = txns.filter((t) => (classifications[t.category || "Other"] ?? "expense") === "expense");
    if (!accounts || accounts.length === 0) return spendOnly;
    return spendOnly.filter((t) => accounts.includes(t.accounts?.name ?? ""));
  }, [monthFilter, transactions, monthTxQuery.data, accounts, classifications]);

  const data = useMemo(() => categoryTotals(displayedTransactions), [displayedTransactions]);
  const isLoading = monthFilter != null && monthTxQuery.isLoading;

  const selectedTotal = selectedCategory ? (data.find((d) => d.name === selectedCategory)?.value ?? 0) : 0;
  const selectedTransactions = selectedCategory
    ? displayedTransactions
        .filter((t) => t.amount < 0 && (t.category || "Other") === selectedCategory)
        .sort((a, b) => a.amount - b.amount)
    : [];

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
    <div className={fill ? "flex-1 min-h-0 flex flex-col" : undefined}>
      <MonthStepper value={monthFilter} onChange={setMonthFilter} allowAllTime className="mb-2" />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--text-secondary)" }}>
          Loading…
        </div>
      ) : data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--text-secondary)" }}>
          {monthFilter ? `No spending in ${format(monthFilter, "MMMM yyyy")}.` : "No spending in this period."}
        </div>
      ) : (
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          notMerge
          lazyUpdate
          onEvents={{ click: (params: { name: string }) => setSelectedCategory(params.name) }}
          style={{ width: "100%", height: fill ? "100%" : 280, minHeight: fill ? 280 : undefined }}
        />
      )}

      {data.length > 0 && (
        <ChartLegend
          items={data.map((d) => ({ name: d.name, value: d.value, color: colorForKey(d.name, categoryColors) }))}
          formatValue={(v) => formatMoney(v, currency)}
          onSelect={setSelectedCategory}
          className="mt-2"
        />
      )}

      {selectedCategory && (
        <TransactionDrillDownOverlay
          title={selectedCategory}
          subtitle={`Total spent: ${formatMoney(selectedTotal, currency)}`}
          rows={selectedTransactions}
          onClose={() => setSelectedCategory(null)}
          onRowClick={setEditingTransaction}
          columns={[
            { header: "Description", render: (t) => t.description },
            { header: "Date", render: (t) => format(parseISO(t.date), "d MMM yyyy") },
            { header: "Amount", align: "right", render: (t) => formatMoney(Math.abs(t.amount), t.currency) },
          ]}
        />
      )}

      {editingTransaction && (
        <EditTransactionDialog
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          categories={categories}
          accounts={allAccounts}
          refetchKey={["transactions"]}
        />
      )}
    </div>
  );
}
