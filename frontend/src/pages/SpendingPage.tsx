import { useMemo, useState } from "react";
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  getMonth,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { Banknote, PiggyBank, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { useAccounts, useMeta, useTransactions } from "../hooks/api";
import { useAuth } from "../auth/AuthContext";
import { FilterBar, type FilterValue } from "../components/FilterBar";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { TransactionsList } from "../components/TransactionsList";
import { AddTransactionDialog } from "../components/AddTransactionDialog";
import { SwipeableSections } from "../components/SwipeableSections";
import { MobileSectionTabs } from "../components/MobileSectionTabs";
import { MonthlySpendBarChart } from "../components/charts/MonthlySpendBarChart";
import { SpendByCategoryDonut } from "../components/charts/SpendByCategoryDonut";
import { IncomeVsSpendLineChart } from "../components/charts/IncomeVsSpendLineChart";
import { SavingsRateLineChart } from "../components/charts/SavingsRateLineChart";
import { SpendingHeatmap } from "../components/charts/SpendingHeatmap";
import { MonthComparisonBarChart } from "../components/charts/MonthComparisonBarChart";
import { monthKey } from "../lib/dates";
import { categoryColorOrder } from "../lib/palette";
import { formatMoney, formatPct } from "../lib/format";
import { Button } from "../components/ui";
import { LoadingFinn } from "../components/LoadingFinn";

const today = format(new Date(), "yyyy-MM-dd");
const defaultFilters: FilterValue = {
  startDate: format(subDays(new Date(), 180), "yyyy-MM-dd"),
  endDate: today,
  accounts: [],
  months: [],
  types: [],
};

type SpendingTab =
  | "summary"
  | "monthlyTrend"
  | "byCategory"
  | "incomeVsSpend"
  | "savingsRate"
  | "calendar"
  | "momComparison"
  | "transactions";
const SPENDING_TABS: { value: SpendingTab; label: string }[] = [
  { value: "summary", label: "Summary" },
  { value: "monthlyTrend", label: "Monthly Trend" },
  { value: "byCategory", label: "By Category" },
  { value: "incomeVsSpend", label: "Income vs Spend" },
  { value: "savingsRate", label: "Savings Rate" },
  { value: "calendar", label: "Calendar" },
  { value: "momComparison", label: "MoM Comparison" },
  { value: "transactions", label: "Transactions" },
];

export function SpendingPage() {
  const { mainCurrency } = useAuth();
  const [filters, setFilters] = useState<FilterValue>(defaultFilters);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<SpendingTab>("summary");
  const accountsQuery = useAccounts(["bank", "ewallet"]);
  const metaQuery = useMeta();
  const txQuery = useTransactions(filters.startDate, filters.endDate);

  const filtered = useMemo(() => {
    const txns = txQuery.data ?? [];
    return txns.filter((t) => {
      if (filters.accounts.length > 0 && !filters.accounts.includes(t.accounts?.name ?? "")) return false;
      if (filters.months.length > 0 && !filters.months.includes(getMonth(parseISO(t.date)))) return false;
      if (filters.types && filters.types.length > 0) {
        const type = t.amount > 0 ? "income" : "expense";
        if (!filters.types.includes(type)) return false;
      }
      return true;
    });
  }, [txQuery.data, filters.accounts, filters.months, filters.types]);

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

  // Month-to-date spend vs. the same day-of-month cutoff last month, for the
  // "Spend Trend" card — "up" (spending more) is unfavorable, unlike the
  // gain/loss cards elsewhere, hence StatCardDelta's `sentiment` override below.
  const { trendDelta, trendPct } = useMemo(() => {
    const now = new Date();
    const mtdStart = startOfMonth(now);
    const prevMtdStart = subMonths(mtdStart, 1);
    const prevMtdEnd = new Date(
      Math.min(
        addDays(prevMtdStart, differenceInCalendarDays(now, mtdStart)).getTime(),
        endOfMonth(prevMtdStart).getTime(),
      ),
    );

    const sumExpenses = (start: Date, end: Date) =>
      filtered
        .filter((t) => t.amount < 0 && parseISO(t.date) >= start && parseISO(t.date) <= end)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const mtdSpend = sumExpenses(mtdStart, now);
    const prevMtdSpend = sumExpenses(prevMtdStart, prevMtdEnd);
    const delta = mtdSpend - prevMtdSpend;
    return { trendDelta: delta, trendPct: prevMtdSpend > 0 ? (delta / prevMtdSpend) * 100 : null };
  }, [filtered]);

  const categories = metaQuery.data?.categories ?? [];
  const categoryColors = categoryColorOrder(categories);

  if (txQuery.isLoading || accountsQuery.isLoading) {
    return <LoadingFinn />;
  }

  const summaryPanel = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <StatCard
        label="Monthly Spend"
        value={formatMoney(monthlySpend, mainCurrency)}
        icon={<Receipt size={20} />}
        hero
      />
      <StatCard
        label="Monthly Income"
        value={formatMoney(monthlyIncome, mainCurrency)}
        icon={<Banknote size={20} />}
        tint="green"
      />
      <StatCard label="Savings Rate" value={`${savingsRate}%`} icon={<PiggyBank size={20} />} tint="amber" />
      <StatCard
        label="Spend Trend"
        value={`${trendDelta >= 0 ? "+" : ""}${formatMoney(trendDelta, mainCurrency)}`}
        icon={trendDelta >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
        tint={trendDelta >= 0 ? "red" : "green"}
        delta={
          trendPct !== null
            ? {
                value: `${formatPct(trendPct)} vs last month`,
                direction: trendDelta >= 0 ? "up" : "down",
                sentiment: trendDelta >= 0 ? "bad" : "good",
              }
            : undefined
        }
      />
    </div>
  );

  // Sized so the whole card (title + chart) fits in the space actually left over
  // on a phone screen — viewport height minus the sticky header, subheader, page
  // title, filter bar, and bottom nav — instead of overflowing below the fold.
  const mobileChartHeight = "min-h-[calc(100dvh_-_400px)] md:min-h-0";

  const monthlySpendChart = (
    <ChartCard title="Monthly Spend by Category" fill className={mobileChartHeight}>
      <MonthlySpendBarChart transactions={filtered} categories={categories} categoryColors={categoryColors} fill />
    </ChartCard>
  );
  const spendByCategoryChart = (
    <ChartCard title="Spend by Category" fill className={mobileChartHeight}>
      <SpendByCategoryDonut transactions={filtered} categoryColors={categoryColors} fill />
    </ChartCard>
  );
  const incomeVsSpendChart = (
    <ChartCard title="Income vs Spend Over Time" fill className={mobileChartHeight}>
      <IncomeVsSpendLineChart transactions={filtered} fill />
    </ChartCard>
  );
  const savingsRateChart = (
    <ChartCard title="Savings Rate Over Time (%)" fill className={mobileChartHeight}>
      <SavingsRateLineChart transactions={filtered} fill />
    </ChartCard>
  );
  const spendingCalendarChart = (
    <ChartCard title="Spending Calendar" fill className={mobileChartHeight}>
      <SpendingHeatmap accounts={filters.accounts} currency={mainCurrency} fill />
    </ChartCard>
  );
  const momComparisonChart = (
    <ChartCard title="Month-over-Month by Category" fill className={mobileChartHeight}>
      <MonthComparisonBarChart transactions={filtered} fill />
    </ChartCard>
  );
  const transactionsPanel = (
    <ChartCard title="Recent Transactions">
      <TransactionsList
        transactions={filtered}
        categories={categories}
        accounts={accountsQuery.data ?? []}
        refetchKey={["transactions", filters.startDate, filters.endDate]}
      />
    </ChartCard>
  );

  return (
    <div className="space-y-3">
      <div className="md:hidden -mt-3 mb-4">
        <MobileSectionTabs tabs={SPENDING_TABS} active={mobileTab} onChange={setMobileTab} />
      </div>
      <div className="flex items-center justify-between">
        <h1
          className="flex items-center gap-2 text-xl font-semibold"
          style={{ color: "var(--text-heading)" }}
        >
          <Receipt size={22} />
          Spending
        </h1>
        <Button variant="primary" onClick={() => setDialogOpen(true)}>
          ＋ Add Transaction
        </Button>
      </div>
      <FilterBar accounts={accountsQuery.data ?? []} value={filters} onChange={setFilters} />

      {filtered.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>
          No transactions found for this period. Start by sending a screenshot to your bot.
        </p>
      ) : (
        <SwipeableSections
          tabs={SPENDING_TABS}
          active={mobileTab}
          onChange={setMobileTab}
          panels={{
            summary: summaryPanel,
            monthlyTrend: monthlySpendChart,
            byCategory: spendByCategoryChart,
            incomeVsSpend: incomeVsSpendChart,
            savingsRate: savingsRateChart,
            calendar: spendingCalendarChart,
            momComparison: momComparisonChart,
            transactions: transactionsPanel,
          }}
          desktopContent={
            <>
              {summaryPanel}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8">{monthlySpendChart}</div>
                <div className="lg:col-span-4">{spendByCategoryChart}</div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8">{incomeVsSpendChart}</div>
                <div className="lg:col-span-4">{savingsRateChart}</div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                <div className="lg:col-span-8">{spendingCalendarChart}</div>
                <div className="lg:col-span-4">{momComparisonChart}</div>
              </div>

              {transactionsPanel}
            </>
          }
        />
      )}

      {dialogOpen && metaQuery.data && (
        <AddTransactionDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          accounts={accountsQuery.data ?? []}
          meta={metaQuery.data}
          refetchKey={["transactions", filters.startDate, filters.endDate]}
        />
      )}
    </div>
  );
}
