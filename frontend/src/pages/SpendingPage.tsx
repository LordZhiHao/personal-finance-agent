import { useEffect, useMemo, useState } from "react";
import {
  differenceInCalendarDays,
  endOfMonth,
  format,
  getMonth,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { Plus, Receipt } from "lucide-react";
import { useAccounts, useCreateBudget, useMeta, useTransactions } from "../hooks/api";
import { useAuth } from "../auth/AuthContext";
import { FilterBar, type FilterValue } from "../components/FilterBar";
import { ChartCard } from "../components/ChartCard";
import { TransactionsList } from "../components/TransactionsList";
import { AddTransactionDialog } from "../components/AddTransactionDialog";
import { SwipeableSections } from "../components/SwipeableSections";
import { MobileSectionTabs } from "../components/MobileSectionTabs";
import { SectionPairRow } from "../components/SectionPairRow";
import { MoreInsights } from "../components/MoreInsights";
import { FinnInsightCard } from "../components/FinnInsightCard";
import { SpendRingCard, type RingCategoryRow } from "../components/charts/SpendRingCard";
import { MonthlySpendBarChart } from "../components/charts/MonthlySpendBarChart";
import { SpendByCategoryDonut } from "../components/charts/SpendByCategoryDonut";
import { IncomeVsSpendLineChart } from "../components/charts/IncomeVsSpendLineChart";
import { SavingsRateLineChart } from "../components/charts/SavingsRateLineChart";
import { SpendingHeatmap } from "../components/charts/SpendingHeatmap";
import { MonthComparisonBarChart } from "../components/charts/MonthComparisonBarChart";
import { sectionKey } from "../lib/dashboardSections";
import { categoryColorOrder, colorForKey } from "../lib/palette";
import { formatMoney } from "../lib/format";
import { Button, Fab, TabToggle } from "../components/ui";
import { LoadingFinn } from "../components/LoadingFinn";

type SpendPeriod = "thisMonth" | "lastMonth" | "3m" | "6m" | "1y";
const SPEND_PERIOD_OPTIONS: { value: SpendPeriod; label: string }[] = [
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "Year" },
];

function periodRange(period: SpendPeriod): { startDate: string; endDate: string } {
  const now = new Date();
  switch (period) {
    case "thisMonth":
      return { startDate: format(startOfMonth(now), "yyyy-MM-dd"), endDate: format(now, "yyyy-MM-dd") };
    case "lastMonth": {
      const lm = subMonths(now, 1);
      return { startDate: format(startOfMonth(lm), "yyyy-MM-dd"), endDate: format(endOfMonth(lm), "yyyy-MM-dd") };
    }
    case "3m":
      return { startDate: format(subMonths(now, 3), "yyyy-MM-dd"), endDate: format(now, "yyyy-MM-dd") };
    case "1y":
      return { startDate: format(subMonths(now, 12), "yyyy-MM-dd"), endDate: format(now, "yyyy-MM-dd") };
    case "6m":
    default:
      return { startDate: format(subMonths(now, 6), "yyyy-MM-dd"), endDate: format(now, "yyyy-MM-dd") };
  }
}

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
  | "savingsRate"
  | "calendar"
  | "byCategory"
  | "incomeVsSpend"
  | "momComparison"
  | "transactions";
const SPENDING_TABS: { value: SpendingTab; label: string }[] = [
  { value: "summary", label: "Summary" },
  { value: "monthlyTrend", label: "Monthly Trend" },
  { value: "savingsRate", label: "Savings Rate" },
  { value: "calendar", label: "Calendar" },
  { value: "byCategory", label: "By Category" },
  { value: "incomeVsSpend", label: "Income vs Spend" },
  { value: "momComparison", label: "MoM Comparison" },
  { value: "transactions", label: "Transactions" },
];

export function SpendingPage() {
  const { mainCurrency, hiddenDashboardSections } = useAuth();
  const [filters, setFilters] = useState<FilterValue>(defaultFilters);
  const [period, setPeriod] = useState<SpendPeriod>("6m");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<SpendingTab>("summary");
  const [capSet, setCapSet] = useState(false);
  const accountsQuery = useAccounts(["bank", "ewallet"]);
  const metaQuery = useMeta();
  const txQuery = useTransactions(filters.startDate, filters.endDate, mainCurrency);
  const createBudget = useCreateBudget();
  const classifications = metaQuery.data?.category_classifications ?? {};

  function handlePeriodChange(p: SpendPeriod) {
    setPeriod(p);
    setFilters((f) => ({ ...f, ...periodRange(p) }));
  }

  const visible = (id: SpendingTab) => !hiddenDashboardSections.includes(sectionKey("spending", id));
  const visibleTabs = useMemo(
    () => SPENDING_TABS.filter((t) => t.value === "summary" || visible(t.value)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hiddenDashboardSections],
  );

  useEffect(() => {
    if (!visibleTabs.some((t) => t.value === mobileTab)) setMobileTab("summary");
  }, [visibleTabs, mobileTab]);

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

  // Only "expense"-classified negative-amount rows count as spending — an
  // Investment/Transfer-classified transaction (e.g. a brokerage top-up) is real
  // cash movement but not spending, so it's excluded from every spend chart/KPI
  // below and surfaced separately via monthlyInvested instead. Positive-amount
  // (income) rows are always kept, same as before this classification existed.
  const spendTxns = useMemo(
    () => filtered.filter((t) => t.amount >= 0 || (classifications[t.category || "Other"] ?? "expense") === "expense"),
    [filtered, classifications],
  );

  // Totals for the whole selected period (not just its latest calendar month) —
  // this is what the insight-first hero card below actually describes, since the
  // period control now lets the user pick a range wider than one month.
  const { periodIncome, periodSpend, periodSavingsRate } = useMemo(() => {
    const income = filtered.filter((t) => t.amount > 0).reduce((sum, t) => sum + (t.converted_amount ?? t.amount), 0);
    const spend = spendTxns
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.converted_amount ?? t.amount), 0);
    const rate = income ? Math.round(((income - spend) / income) * 10000) / 100 : 0;
    return { periodIncome: income, periodSpend: spend, periodSavingsRate: rate };
  }, [filtered, spendTxns]);

  // Equal-length prior period (immediately before the selected range), for the
  // hero card's per-category deltas and the Finn nudge — same account/type filters
  // as the current period, but not the `months` filter (which is month-of-year,
  // not meaningful across two different periods).
  const periodDays = differenceInCalendarDays(parseISO(filters.endDate), parseISO(filters.startDate)) + 1;
  const prevRangeStart = format(subDays(parseISO(filters.startDate), periodDays), "yyyy-MM-dd");
  const prevRangeEnd = format(subDays(parseISO(filters.startDate), 1), "yyyy-MM-dd");
  const prevTxQuery = useTransactions(prevRangeStart, prevRangeEnd, mainCurrency);

  const prevSpendTxns = useMemo(() => {
    return (prevTxQuery.data ?? []).filter((t) => {
      if (filters.accounts.length > 0 && !filters.accounts.includes(t.accounts?.name ?? "")) return false;
      if (filters.types && filters.types.length > 0) {
        const type = t.amount > 0 ? "income" : "expense";
        if (!filters.types.includes(type)) return false;
      }
      return t.amount >= 0 || (classifications[t.category || "Other"] ?? "expense") === "expense";
    });
  }, [prevTxQuery.data, filters.accounts, filters.types, classifications]);

  const categoryDeltas = useMemo(() => {
    const current = new Map<string, number>();
    for (const t of spendTxns) {
      if (t.amount >= 0) continue;
      const cat = t.category || "Other";
      current.set(cat, (current.get(cat) ?? 0) + Math.abs(t.converted_amount ?? t.amount));
    }
    const prev = new Map<string, number>();
    for (const t of prevSpendTxns) {
      if (t.amount >= 0) continue;
      const cat = t.category || "Other";
      prev.set(cat, (prev.get(cat) ?? 0) + Math.abs(t.converted_amount ?? t.amount));
    }
    return [...current.entries()]
      .map(([category, amount]) => {
        const prevAmount = prev.get(category) ?? 0;
        const deltaAbs = amount - prevAmount;
        return { category, amount, deltaAbs, deltaPct: prevAmount > 0 ? (deltaAbs / prevAmount) * 100 : undefined };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [spendTxns, prevSpendTxns]);

  const nudge = useMemo(
    () => categoryDeltas.find((c) => c.deltaAbs > 30 && (c.deltaPct ?? 0) > 15) ?? null,
    [categoryDeltas],
  );

  function handleSetCap() {
    if (!nudge) return;
    const suggestedLimit = Math.ceil(nudge.amount / 10) * 10;
    createBudget.mutate(
      { category: nudge.category, monthly_limit: suggestedLimit, currency: mainCurrency },
      { onSuccess: () => setCapSet(true) },
    );
  }

  const categories = metaQuery.data?.categories ?? [];
  // Color order is scoped to categories actually present in this period's
  // transactions (not the full built-in+custom meta list) — otherwise unused
  // built-in categories (e.g. "Groceries") permanently occupy color slots
  // that a used custom category (e.g. "Apparels") could otherwise get.
  // Derived from the unfiltered period data (txQuery.data), not `filtered`,
  // so toggling the account/month/type FilterBar doesn't repaint colors.
  const categoryColors = useMemo(() => {
    const present = new Set<string>();
    for (const t of txQuery.data ?? []) {
      if (t.amount < 0) present.add(t.category || "Other");
    }
    return categoryColorOrder(categories.filter((c) => present.has(c)), classifications);
  }, [txQuery.data, categories, classifications]);

  if (txQuery.isLoading || accountsQuery.isLoading) {
    return <LoadingFinn />;
  }

  const topCategories = categoryDeltas.slice(0, 5);
  const maxCategoryAmount = topCategories[0]?.amount ?? 1;
  const ringRows: RingCategoryRow[] = topCategories.map((c) => ({
    name: c.category,
    color: colorForKey(c.category, categoryColors),
    amount: c.amount,
    widthPct: (c.amount / maxCategoryAmount) * 100,
    deltaPct: c.deltaPct !== undefined ? Math.round(c.deltaPct) : undefined,
  }));
  const restCount = Math.max(0, categoryDeltas.length - topCategories.length);
  const restAmount = categoryDeltas.slice(topCategories.length).reduce((sum, c) => sum + c.amount, 0);

  const summaryPanel = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
      <div className="lg:col-span-7">
        <SpendRingCard
          headline={
            <>
              You've spent <b style={{ color: "var(--brand-hover)" }}>{formatMoney(periodSpend, mainCurrency)}</b>
              {periodIncome > 0 ? (
                <>
                  {" "}
                  · income {formatMoney(periodIncome, mainCurrency)} · {periodSavingsRate}% saved this period.
                </>
              ) : (
                " this period."
              )}
            </>
          }
          pctUsed={null}
          categories={ringRows}
          currency={mainCurrency}
          footnote={
            restCount > 0 ? (
              <span style={{ color: "var(--text-muted)" }}>
                {restCount} more categories · {formatMoney(restAmount, mainCurrency)}
              </span>
            ) : undefined
          }
        />
      </div>
      <div className="lg:col-span-5">
        {nudge && !capSet ? (
          <FinnInsightCard
            body={
              <>
                <b>{nudge.category}</b> is up {formatMoney(nudge.deltaAbs, mainCurrency)} on the prior period
                {nudge.deltaPct !== undefined ? ` (+${Math.round(nudge.deltaPct)}%)` : ""}. Want a cap with a nudge at
                80%?
              </>
            }
            actions={[
              {
                label: createBudget.isPending ? "Setting…" : "Set the cap",
                onClick: handleSetCap,
                disabled: createBudget.isPending,
              },
            ]}
          />
        ) : capSet && nudge ? (
          <FinnInsightCard
            body={
              <>
                Done — I set a {formatMoney(Math.ceil(nudge.amount / 10) * 10, mainCurrency)} cap on {nudge.category}.
              </>
            }
          />
        ) : (
          <FinnInsightCard body="Nothing jumped out at me this period — spending looks steady across your categories." />
        )}
      </div>
    </div>
  );

  // Sized so the whole card (title + chart) fits in the space actually left over
  // on a phone screen — viewport height minus the sticky header, subheader, page
  // title, filter bar, and bottom nav — instead of overflowing below the fold.
  const mobileChartHeight = "min-h-[calc(100dvh_-_400px)] md:min-h-0";

  const monthlySpendChart = (
    <ChartCard title="Monthly Spend by Category" fill className={mobileChartHeight}>
      <MonthlySpendBarChart
        transactions={spendTxns}
        categories={categories}
        categoryColors={categoryColors}
        currency={mainCurrency}
        fill
      />
    </ChartCard>
  );
  const spendByCategoryChart = (
    <ChartCard title="Spend by Category" fill className={mobileChartHeight}>
      <SpendByCategoryDonut
        transactions={spendTxns}
        categoryColors={categoryColors}
        currency={mainCurrency}
        accounts={filters.accounts}
        categories={categories}
        allAccounts={accountsQuery.data ?? []}
        fill
      />
    </ChartCard>
  );
  const incomeVsSpendChart = (
    <ChartCard title="Income vs Spend Over Time" fill className={mobileChartHeight}>
      <IncomeVsSpendLineChart transactions={spendTxns} fill />
    </ChartCard>
  );
  const savingsRateChart = (
    <ChartCard title="Savings Rate Over Time (%)" fill className={mobileChartHeight}>
      <SavingsRateLineChart transactions={spendTxns} fill />
    </ChartCard>
  );
  const spendingCalendarChart = (
    <ChartCard title="Spending Calendar" fill className={mobileChartHeight}>
      <SpendingHeatmap
        accounts={filters.accounts}
        currency={mainCurrency}
        categories={categories}
        allAccounts={accountsQuery.data ?? []}
        fill
      />
    </ChartCard>
  );
  const momComparisonChart = (
    <ChartCard title="Month-over-Month by Category" fill className={mobileChartHeight}>
      <MonthComparisonBarChart transactions={spendTxns} fill />
    </ChartCard>
  );
  const transactionsPanel = (
    <ChartCard title="Recent Transactions">
      <TransactionsList
        transactions={filtered}
        categories={categories}
        accounts={accountsQuery.data ?? []}
        currency={mainCurrency}
        refetchKey={["transactions", filters.startDate, filters.endDate]}
      />
    </ChartCard>
  );

  return (
    <div className="space-y-3">
      <div className="md:hidden -mt-3 mb-4">
        <MobileSectionTabs tabs={visibleTabs} active={mobileTab} onChange={setMobileTab} />
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1
          className="flex items-center gap-2 text-lg sm:text-xl font-semibold shrink-0"
          style={{ color: "var(--text-heading)" }}
        >
          <Receipt size={22} />
          Spending
        </h1>
        <div className="flex items-center gap-2 shrink-0 relative flex-wrap">
          <TabToggle options={SPEND_PERIOD_OPTIONS} value={period} onChange={handlePeriodChange} />
          <FilterBar accounts={accountsQuery.data ?? []} value={filters} onChange={setFilters} />
          <Button variant="primary" className="hidden md:inline-flex" onClick={() => setDialogOpen(true)}>
            ＋ Add Transaction
          </Button>
        </div>
      </div>

      <Fab onClick={() => setDialogOpen(true)} aria-label="Add transaction">
        <Plus size={24} />
      </Fab>

      {filtered.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>
          No transactions found for this period. Start by sending a screenshot to your bot.
        </p>
      ) : (
        <SwipeableSections
          tabs={visibleTabs}
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

              <SectionPairRow
                leftVisible={visible("monthlyTrend")}
                left={monthlySpendChart}
                rightVisible={visible("savingsRate")}
                right={savingsRateChart}
                className="items-stretch"
              />

              {visible("calendar") && spendingCalendarChart}

              {(visible("byCategory") || visible("incomeVsSpend") || visible("momComparison")) && (
                <MoreInsights>
                  {visible("byCategory") && spendByCategoryChart}
                  {visible("incomeVsSpend") && incomeVsSpendChart}
                  {visible("momComparison") && momComparisonChart}
                </MoreInsights>
              )}

              {visible("transactions") && transactionsPanel}
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
