import { useMemo, useState } from "react";
import { addMonths, endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Transaction } from "../../types";
import { useMeta, useTransactions } from "../../hooks/api";
import { colorForKey } from "../../lib/palette";
import { formatMoney } from "../../lib/format";
import { legendStyle, tooltipStyle } from "./chartTheme";
import { Overlay, Table, Thead, Tbody, Tr, Th, Td } from "../ui";

function categoryTotals(transactions: Transaction[]) {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const cat = t.category || "Other";
    totals.set(cat, (totals.get(cat) ?? 0) + Math.abs(t.amount));
  }
  return [...totals.entries()].map(([name, value]) => ({ name, value }));
}

export function SpendByCategoryDonut({
  transactions,
  categoryColors,
  currency,
  accounts,
  fill = false,
}: {
  transactions: Transaction[];
  categoryColors: string[];
  currency: string;
  accounts?: string[];
  fill?: boolean;
}) {
  const [monthFilter, setMonthFilter] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Independent per-month fetch once a month is picked, mirroring
  // SpendingHeatmap — so any month in history works immediately, not just
  // whatever the page's own FilterBar date range already loaded. "All Time"
  // (monthFilter === null) instead reuses the `transactions` prop as-is,
  // preserving today's default total-value behavior exactly.
  const monthStart = monthFilter ? format(startOfMonth(monthFilter), "yyyy-MM-dd") : "";
  const monthEnd = monthFilter ? format(endOfMonth(monthFilter), "yyyy-MM-dd") : "";
  const monthTxQuery = useTransactions(monthStart, monthEnd, monthFilter != null);
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

  return (
    <div className={fill ? "flex-1 min-h-0 flex flex-col" : undefined}>
      <div className="flex items-center justify-center gap-3 mb-2 text-sm">
        <button
          type="button"
          onClick={() => setMonthFilter(null)}
          className="px-2 py-1 rounded font-medium"
          style={{
            color: monthFilter === null ? "var(--brand)" : "var(--text-secondary)",
            background: monthFilter === null ? "var(--brand-tint)" : "transparent",
          }}
        >
          All Time
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonthFilter((m) => subMonths(m ?? new Date(), 1))}
            className="px-2 py-1"
            style={{ color: "var(--text-secondary)" }}
          >
            ‹
          </button>
          <span style={{ color: "var(--text-primary)", minWidth: 110, textAlign: "center" }}>
            {format(monthFilter ?? new Date(), "MMMM yyyy")}
          </span>
          <button
            type="button"
            onClick={() => setMonthFilter((m) => addMonths(m ?? new Date(), 1))}
            className="px-2 py-1"
            style={{ color: "var(--text-secondary)" }}
          >
            ›
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--text-secondary)" }}>
          Loading…
        </div>
      ) : data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--text-secondary)" }}>
          {monthFilter ? `No spending in ${format(monthFilter, "MMMM yyyy")}.` : "No spending in this period."}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={fill ? "100%" : 280} minHeight={fill ? 280 : undefined}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={1}
              onClick={(entry) => setSelectedCategory(entry.name as string)}
            >
              {data.map((d) => (
                <Cell
                  key={d.name}
                  fill={colorForKey(d.name, categoryColors)}
                  stroke="var(--surface-1)"
                  strokeWidth={2}
                  style={{ cursor: "pointer" }}
                />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={legendStyle} />
          </PieChart>
        </ResponsiveContainer>
      )}

      {selectedCategory && (
        <Overlay onClose={() => setSelectedCategory(null)}>
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
            {selectedCategory}
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            Total spent: {formatMoney(selectedTotal, currency)}
          </p>
          <Table>
            <Thead>
              <Th>Description</Th>
              <Th>Date</Th>
              <Th align="right">Amount</Th>
            </Thead>
            <Tbody>
              {selectedTransactions.map((t) => (
                <Tr key={t.id}>
                  <Td>{t.description}</Td>
                  <Td>{format(parseISO(t.date), "d MMM yyyy")}</Td>
                  <Td align="right">{formatMoney(Math.abs(t.amount), t.currency)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Overlay>
      )}
    </div>
  );
}
