import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { useAccounts, useMeta, useTransactions } from "../hooks/api";
import { FilterBar, type FilterValue } from "../components/FilterBar";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { TransactionsTable } from "../components/TransactionsTable";
import { MonthlySpendBarChart } from "../components/charts/MonthlySpendBarChart";
import { SpendByCategoryDonut } from "../components/charts/SpendByCategoryDonut";
import { IncomeVsSpendLineChart } from "../components/charts/IncomeVsSpendLineChart";
import { SavingsRateLineChart } from "../components/charts/SavingsRateLineChart";
import { SpendingHeatmap } from "../components/charts/SpendingHeatmap";
import { MonthComparisonBarChart } from "../components/charts/MonthComparisonBarChart";
import { dailySpendTotals, monthKey } from "../lib/dates";

const today = format(new Date(), "yyyy-MM-dd");
const defaultFilters: FilterValue = { startDate: format(subDays(new Date(), 180), "yyyy-MM-dd"), endDate: today, account: "All" };

export function SpendingPage() {
  const [filters, setFilters] = useState<FilterValue>(defaultFilters);
  const accountsQuery = useAccounts(["bank", "ewallet"]);
  const metaQuery = useMeta();
  const txQuery = useTransactions(filters.startDate, filters.endDate);

  const filtered = useMemo(() => {
    const txns = txQuery.data ?? [];
    if (filters.account === "All") return txns;
    return txns.filter((t) => t.accounts?.name === filters.account);
  }, [txQuery.data, filters.account]);

  const { monthlyIncome, monthlySpend, savingsRate } = useMemo(() => {
    if (filtered.length === 0) return { monthlyIncome: 0, monthlySpend: 0, savingsRate: 0 };
    const latestMonth = filtered.reduce((max, t) => (monthKey(t.date) > max ? monthKey(t.date) : max), "");
    const income = filtered
      .filter((t) => t.amount > 0 && monthKey(t.date) === latestMonth)
      .reduce((sum, t) => sum + t.amount, 0);
    const spend = filtered
      .filter((t) => t.amount < 0 && monthKey(t.date) === latestMonth)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const rate = income ? Math.round(((income - spend) / income) * 10000) / 100 : 0;
    return { monthlyIncome: income, monthlySpend: spend, savingsRate: rate };
  }, [filtered]);

  const categories = metaQuery.data?.categories ?? [];

  if (txQuery.isLoading || accountsQuery.isLoading) {
    return <p style={{ color: "var(--text-secondary)" }}>Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
        💸 Spending
      </h1>
      <FilterBar accounts={accountsQuery.data ?? []} value={filters} onChange={setFilters} />

      {filtered.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>
          No transactions found for this period. Start by sending a screenshot to your bot.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Monthly Income" value={`SGD ${monthlyIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            <StatCard label="Monthly Spend" value={`SGD ${monthlySpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            <StatCard label="Savings Rate" value={`${savingsRate}%`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Monthly Spend by Category">
              <MonthlySpendBarChart transactions={filtered} categories={categories} />
            </ChartCard>
            <ChartCard title="Spend by Category">
              <SpendByCategoryDonut transactions={filtered} />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Income vs Spend Over Time">
              <IncomeVsSpendLineChart transactions={filtered} />
            </ChartCard>
            <ChartCard title="Savings Rate Over Time (%)">
              <SavingsRateLineChart transactions={filtered} />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Spending Calendar">
              <SpendingHeatmap daily={dailySpendTotals(filtered)} currency="SGD" />
            </ChartCard>
            <ChartCard title="Month-over-Month by Category">
              <MonthComparisonBarChart transactions={filtered} />
            </ChartCard>
          </div>

          <ChartCard title="Recent Transactions">
            <TransactionsTable
              transactions={filtered}
              categories={categories}
              refetchKey={["transactions", filters.startDate, filters.endDate]}
            />
          </ChartCard>
        </>
      )}
    </div>
  );
}
