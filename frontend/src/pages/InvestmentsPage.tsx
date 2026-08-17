import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format, getMonth, parseISO, startOfYear, subDays, subMonths, subYears } from "date-fns";
import { Briefcase, Coins, PieChart, Receipt, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { Holding } from "../types";
import {
  useAccounts,
  useBalances,
  useDividendForecast,
  useDividendSummary,
  useHoldings,
  useMeta,
  usePortfolioEvents,
  useRefreshPrices,
  useSnapshotHistory,
  useSnapshots,
} from "../hooks/api";
import { useAuth } from "../auth/AuthContext";
import { FilterBar, type FilterValue } from "../components/FilterBar";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { AddTradeDialog } from "../components/AddTradeDialog";
import { SwipeableSections } from "../components/SwipeableSections";
import { MobileSectionTabs } from "../components/MobileSectionTabs";
import { SectionPairRow } from "../components/SectionPairRow";
import { NetWorthLineChart } from "../components/charts/NetWorthLineChart";
import { AssetAllocationDonut } from "../components/charts/AssetAllocationDonut";
import { AllocationBarChart } from "../components/charts/AllocationBarChart";
import { DividendCalendar } from "../components/charts/DividendCalendar";
import { DividendsByCurrencyDonut } from "../components/charts/DividendsByCurrencyDonut";
import { UpcomingDividends, type TickerCostBasis } from "../components/charts/UpcomingDividends";
import { TradeHistoryTable } from "../components/charts/TradeHistoryTable";
import { HoldingsTable } from "../components/charts/HoldingsTable";
import { MarketHoldingsTable } from "../components/charts/MarketHoldingsTable";
import { BalancesTable } from "../components/charts/BalancesTable";
import { sectionKey } from "../lib/dashboardSections";
import { formatMoney, formatPct } from "../lib/format";
import { CURRENCY_MARKET } from "../lib/markets";
import { Button, Input, Select, TabToggle, Card } from "../components/ui";

const today = format(new Date(), "yyyy-MM-dd");
const defaultFilters: FilterValue = {
  startDate: format(subDays(new Date(), 180), "yyyy-MM-dd"),
  endDate: today,
  accounts: [],
  months: [],
};

type Period = "1W" | "1M" | "1Y" | "All";
const PERIODS: Period[] = ["1W", "1M", "1Y", "All"];

function periodCutoff(period: Period): string | null {
  const now = new Date();
  if (period === "1W") return format(subDays(now, 7), "yyyy-MM-dd");
  if (period === "1M") return format(subMonths(now, 1), "yyyy-MM-dd");
  if (period === "1Y") return format(subYears(now, 1), "yyyy-MM-dd");
  return null;
}

type AllocationView = "broker" | "currency";
type HoldingFilter = "all" | "gainers" | "losers";

type InvestmentsTab =
  | "netWorth"
  | "netWorthOverTime"
  | "assetAllocation"
  | "accountBalances"
  | "positions"
  | "topHoldings"
  | "dividendCalendar"
  | "dividendsByCurrency"
  | "upcomingDividends"
  | "trades";
const INVESTMENTS_TABS: { value: InvestmentsTab; label: string }[] = [
  { value: "netWorth", label: "Summary" },
  { value: "netWorthOverTime", label: "Net Worth Over Time" },
  { value: "assetAllocation", label: "Asset Allocation" },
  { value: "accountBalances", label: "Account Balances" },
  { value: "positions", label: "Positions" },
  { value: "topHoldings", label: "Top Holdings" },
  { value: "dividendCalendar", label: "Dividend Calendar" },
  { value: "dividendsByCurrency", label: "Dividends by Currency" },
  { value: "upcomingDividends", label: "Upcoming Dividends" },
  { value: "trades", label: "Trade History" },
];

export function InvestmentsPage() {
  const [filters, setFilters] = useState<FilterValue>(defaultFilters);
  const [hasCustomFilters, setHasCustomFilters] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<InvestmentsTab>("netWorth");
  const [period, setPeriod] = useState<Period>("All");
  const [selectedBrokerAccountId, setSelectedBrokerAccountId] = useState<string>("");
  const [allocationView, setAllocationView] = useState<AllocationView>("broker");
  const [holdingFilter, setHoldingFilter] = useState<HoldingFilter>("all");
  const [holdingSearch, setHoldingSearch] = useState("");

  const { mainCurrency: displayCurrency, hiddenDashboardSections } = useAuth();
  const accountsQuery = useAccounts(["brokerage"]);
  const metaQuery = useMeta();
  const snapshotsQuery = useSnapshots(displayCurrency);
  const historyQuery = useSnapshotHistory(displayCurrency, selectedBrokerAccountId || undefined);
  const holdingsQuery = useHoldings(displayCurrency);
  const balancesQuery = useBalances(displayCurrency);
  const refreshPricesMutation = useRefreshPrices();
  const dividendForecastQuery = useDividendForecast();
  const eventsQuery = usePortfolioEvents(
    hasCustomFilters ? filters.startDate : undefined,
    hasCustomFilters ? filters.endDate : undefined,
  );
  const dividendSummaryQuery = useDividendSummary(
    displayCurrency,
    format(startOfYear(new Date()), "yyyy-MM-dd"),
    today,
  );
  // Always unbounded (independent of the page's FilterBar date range) so the
  // Dividends by Currency chart's own year/month picker can browse any year in
  // history, not just whatever range the filter bar happens to cover. Dedupes
  // against eventsQuery in the common case (no custom filters applied).
  const allDividendEventsQuery = usePortfolioEvents(undefined, undefined);

  const visible = (id: InvestmentsTab) => !hiddenDashboardSections.includes(sectionKey("investments", id));
  const visibleTabs = useMemo(
    () => INVESTMENTS_TABS.filter((t) => t.value === "netWorth" || visible(t.value)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hiddenDashboardSections],
  );

  useEffect(() => {
    if (!visibleTabs.some((t) => t.value === mobileTab)) setMobileTab("netWorth");
  }, [visibleTabs, mobileTab]);

  const snapshots = useMemo(() => {
    const rows = snapshotsQuery.data ?? [];
    return rows.filter((s) => {
      if (filters.accounts.length > 0 && !filters.accounts.includes(s.accounts?.name ?? "")) return false;
      if (filters.months.length > 0 && !filters.months.includes(getMonth(parseISO(s.snapshot_date)))) return false;
      return true;
    });
  }, [snapshotsQuery.data, filters.accounts, filters.months]);

  const events = useMemo(() => {
    const rows = eventsQuery.data ?? [];
    return rows.filter((e) => {
      if (filters.accounts.length > 0 && !filters.accounts.includes(e.accounts?.name ?? "")) return false;
      if (filters.months.length > 0 && !filters.months.includes(getMonth(parseISO(e.date)))) return false;
      return true;
    });
  }, [eventsQuery.data, filters.accounts, filters.months]);

  const netWorthPoints = useMemo(() => {
    const totals = new Map<string, number>();
    for (const s of historyQuery.data ?? []) {
      totals.set(s.snapshot_date, (totals.get(s.snapshot_date) ?? 0) + s.converted_value);
    }
    return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
  }, [historyQuery.data]);

  const filteredNetWorthPoints = useMemo(() => {
    const cutoff = periodCutoff(period);
    if (!cutoff) return netWorthPoints;
    return netWorthPoints.filter((p) => p.date >= cutoff);
  }, [netWorthPoints, period]);

  const brokerOptions = useMemo(
    () => [
      { value: "", label: "All" },
      ...(accountsQuery.data ?? []).map((a) => ({ value: a.id, label: a.name })),
    ],
    [accountsQuery.data],
  );

  const brokerAllocation = useMemo(
    () =>
      snapshots.map((s) => ({ name: s.accounts?.name ?? "Unknown", value: s.converted_value })),
    [snapshots],
  );

  const currencyAllocation = useMemo(() => {
    const totals = new Map<string, number>();
    for (const h of holdingsQuery.data?.holdings ?? []) {
      if (h.market_value === null || h.price_currency === null) continue;
      totals.set(h.price_currency, (totals.get(h.price_currency) ?? 0) + h.market_value);
    }
    return [...totals.entries()].map(([name, value]) => ({ name, value }));
  }, [holdingsQuery.data]);

  const allocationData = allocationView === "broker" ? brokerAllocation : currencyAllocation;

  const tickerNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const h of holdingsQuery.data?.holdings ?? []) {
      if (h.name && !names[h.ticker]) names[h.ticker] = h.name;
    }
    return names;
  }, [holdingsQuery.data]);

  // Weighted-average cost basis per ticker, in its native (cost) currency — pools
  // quantity/cost across accounts holding the same ticker, for the dividend table's
  // "Effective Yield" (dividend / my avg buy price, vs the market-price-based yield).
  const avgCostByTicker = useMemo(() => {
    const totals = new Map<string, { cost: number; qty: number; currency: string }>();
    for (const h of holdingsQuery.data?.holdings ?? []) {
      const entry = totals.get(h.ticker) ?? { cost: 0, qty: 0, currency: h.cost_currency };
      entry.cost += h.native_cost_basis;
      entry.qty += h.quantity;
      totals.set(h.ticker, entry);
    }
    const result: Record<string, TickerCostBasis> = {};
    for (const [ticker, { cost, qty, currency }] of totals) {
      if (qty > 0) result[ticker] = { avgCost: cost / qty, currency };
    }
    return result;
  }, [holdingsQuery.data]);

  const topHoldings = useMemo(() => {
    const totals = new Map<string, number>();
    for (const h of holdingsQuery.data?.holdings ?? []) {
      if (h.market_value === null) continue;
      totals.set(h.ticker, (totals.get(h.ticker) ?? 0) + h.market_value);
    }
    return [...totals.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, subtitle: tickerNames[name], value }));
  }, [holdingsQuery.data, tickerNames]);

  const eventsSorted = useMemo(() => [...events].sort((a, b) => b.date.localeCompare(a.date)), [events]);

  const dividendEvents = useMemo(
    () => (allDividendEventsQuery.data ?? []).filter((e) => e.action === "DIVIDEND"),
    [allDividendEventsQuery.data],
  );

  // Summary KPI figures — Market Value/Cost Basis/Unrealized Gain from holdings,
  // Total Net Worth from accounts balances (cash + brokerage, unlike holdings which
  // is brokerage-only), Year to Date Dividends FX-converted server-side (see
  // utils/dividends.py::compute_dividend_total).
  const totalMarketValue = holdingsQuery.data?.total_market_value ?? 0;
  const costBasis = holdingsQuery.data?.total_cost_basis ?? 0;
  const gain = holdingsQuery.data?.total_unrealized_gain ?? 0;
  const gainPct = costBasis !== 0 ? (gain / costBasis) * 100 : 0;
  const totalNetWorth = balancesQuery.data?.total ?? 0;
  const ytdDividends = dividendSummaryQuery.data?.total ?? 0;

  const summaryPanel = (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Total Market Value"
          value={formatMoney(totalMarketValue, displayCurrency)}
          icon={<Briefcase size={20} />}
          hero
        />
        <StatCard
          label="Total Net Worth"
          value={formatMoney(totalNetWorth, displayCurrency)}
          icon={<Wallet size={20} />}
          hero
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Cost Basis"
          value={formatMoney(costBasis, displayCurrency)}
          icon={<Receipt size={20} />}
          tint="amber"
        />
        <StatCard
          label="Unrealized Gain"
          value={formatMoney(gain, displayCurrency)}
          icon={gain >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          tint={gain >= 0 ? "green" : "red"}
          delta={{ value: formatPct(gainPct), direction: gain >= 0 ? "up" : "down" }}
        />
        <StatCard
          label="Year to Date Dividends"
          value={formatMoney(ytdDividends, displayCurrency)}
          icon={<Coins size={20} />}
          tint="peach"
        />
      </div>
    </div>
  );

  // Sized so the whole card (title + chart) fits in the space actually left over
  // on a phone screen — viewport height minus the sticky header, subheader, page
  // title, filter bar, and bottom nav — instead of overflowing below the fold.
  const mobileChartHeight = "min-h-[calc(100dvh_-_400px)] md:min-h-0";

  const netWorthOverTimeChart = (
    <ChartCard
      title="Net Worth Over Time"
      fill
      className={mobileChartHeight}
      headerRight={
        <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="w-24">
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      }
    >
      <div className="mb-3">
        <TabToggle options={brokerOptions} value={selectedBrokerAccountId} onChange={setSelectedBrokerAccountId} />
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        {filteredNetWorthPoints.length > 0 ? (
          <NetWorthLineChart points={filteredNetWorthPoints} fill />
        ) : (
          <p style={{ color: "var(--text-secondary)" }}>No asset snapshots yet.</p>
        )}
      </div>
    </ChartCard>
  );

  const assetAllocationChart = (
    <ChartCard
      title="Asset Allocation"
      fill
      className={mobileChartHeight}
      headerRight={
        <TabToggle
          options={[
            { value: "broker", label: "Broker" },
            { value: "currency", label: "Currency" },
          ]}
          value={allocationView}
          onChange={setAllocationView}
        />
      }
    >
      {allocationData.length > 0 ? (
        <AssetAllocationDonut data={allocationData} fill />
      ) : (
        <p style={{ color: "var(--text-secondary)" }}>No asset snapshots yet.</p>
      )}
    </ChartCard>
  );

  const accountBalancesPanel = (
    <ChartCard title="Accounts">
      {balancesQuery.data ? (
        <BalancesTable summary={balancesQuery.data} />
      ) : (
        <p style={{ color: "var(--text-secondary)" }}>No accounts yet.</p>
      )}
    </ChartCard>
  );

  const holdings = holdingsQuery.data?.holdings ?? [];
  const filteredHoldings = useMemo(() => {
    return holdings.filter((h) => {
      if (holdingFilter === "gainers" && !(h.unrealized_gain !== null && h.unrealized_gain > 0)) return false;
      if (holdingFilter === "losers" && !(h.unrealized_gain !== null && h.unrealized_gain < 0)) return false;
      if (holdingSearch && !h.ticker.toLowerCase().includes(holdingSearch.trim().toLowerCase())) return false;
      return true;
    });
  }, [holdings, holdingFilter, holdingSearch]);

  const holdingsByMarket = useMemo(() => {
    const groups = new Map<string, { currency: string; holdings: Holding[] }>();
    for (const h of filteredHoldings) {
      const nativeCurrency = h.price_currency ?? h.cost_currency;
      const market = CURRENCY_MARKET[nativeCurrency] ?? nativeCurrency;
      if (!groups.has(market)) groups.set(market, { currency: nativeCurrency, holdings: [] });
      groups.get(market)!.holdings.push(h);
    }
    return groups;
  }, [filteredHoldings]);

  const marketCards = [...holdingsByMarket.entries()].map(([market, group]) => {
    const marketCostBasis = group.holdings.reduce((sum, h) => sum + h.native_cost_basis, 0);
    const marketMarketValue = group.holdings.reduce((sum, h) => sum + (h.native_market_value ?? 0), 0);
    const marketGain = group.holdings.reduce((sum, h) => sum + (h.native_unrealized_gain ?? 0), 0);
    const marketGainPct = marketCostBasis !== 0 ? (marketGain / marketCostBasis) * 100 : 0;
    return (
      <ChartCard key={market} title={`${market} Market (${group.currency})`}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <StatCard
            label="Amount Invested"
            value={formatMoney(marketCostBasis, group.currency)}
            icon={<Receipt size={20} />}
            tint="amber"
          />
          <StatCard
            label="Market Value"
            value={formatMoney(marketMarketValue, group.currency)}
            icon={<Briefcase size={20} />}
            tint="brand"
          />
          <StatCard
            label="Return"
            value={formatMoney(marketGain, group.currency)}
            icon={marketGain >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            tint={marketGain >= 0 ? "green" : "red"}
            delta={{ value: formatPct(marketGainPct), direction: marketGain >= 0 ? "up" : "down" }}
          />
        </div>
        <MarketHoldingsTable holdings={group.holdings} currency={group.currency} />
      </ChartCard>
    );
  });

  const positionsPanel = (
    <div className="space-y-3">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabToggle
            options={[
              { value: "all", label: "All" },
              { value: "gainers", label: "Gainers" },
              { value: "losers", label: "Losers" },
            ]}
            value={holdingFilter}
            onChange={setHoldingFilter}
          />
          <Input
            placeholder="Search ticker…"
            value={holdingSearch}
            onChange={(e) => setHoldingSearch(e.target.value)}
            className="w-full sm:w-48"
          />
        </div>
      </Card>
      <ChartCard title="Holdings">
        <div className="max-h-[420px] overflow-y-auto">
          <HoldingsTable
            holdings={filteredHoldings}
            currency={displayCurrency}
            totalMarketValue={holdingsQuery.data?.total_market_value}
          />
        </div>
      </ChartCard>
      {marketCards}
    </div>
  );

  const topHoldingsChart = (
    <ChartCard title="Top Holdings">
      {topHoldings.length > 0 ? (
        <div className="max-h-[420px] overflow-y-auto">
          <AllocationBarChart data={topHoldings} currency={displayCurrency} />
        </div>
      ) : (
        <p style={{ color: "var(--text-secondary)" }}>No holdings yet.</p>
      )}
    </ChartCard>
  );

  const dividendCalendarChart = (
    <ChartCard title="Dividend Calendar" fill className={mobileChartHeight}>
      <DividendCalendar events={events} fill />
    </ChartCard>
  );

  const dividendsByCurrencyChart = (
    <ChartCard title="Dividends by Currency" fill className={mobileChartHeight}>
      <DividendsByCurrencyDonut events={dividendEvents} fill />
    </ChartCard>
  );

  const upcomingDividendsPanel = (
    <ChartCard title="Upcoming Dividends">
      <UpcomingDividends
        forecast={dividendForecastQuery.data ?? []}
        names={tickerNames}
        costBasis={avgCostByTicker}
      />
    </ChartCard>
  );

  const tradesPanel = (
    <ChartCard
      title="Trade History"
      headerRight={
        <Button variant="primary" onClick={() => setDialogOpen(true)}>
          ＋ Add Entry
        </Button>
      }
    >
      {metaQuery.data && (
        <TradeHistoryTable
          events={eventsSorted}
          refetchKey={["portfolio-events"]}
          meta={metaQuery.data}
          accounts={accountsQuery.data ?? []}
        />
      )}
    </ChartCard>
  );

  const panels: Record<InvestmentsTab, ReactNode> = {
    netWorth: summaryPanel,
    netWorthOverTime: netWorthOverTimeChart,
    assetAllocation: assetAllocationChart,
    accountBalances: accountBalancesPanel,
    positions: positionsPanel,
    topHoldings: topHoldingsChart,
    dividendCalendar: dividendCalendarChart,
    dividendsByCurrency: dividendsByCurrencyChart,
    upcomingDividends: upcomingDividendsPanel,
    trades: tradesPanel,
  };

  return (
    <div className="space-y-3">
      <div className="md:hidden -mt-3 mb-4">
        <MobileSectionTabs tabs={visibleTabs} active={mobileTab} onChange={setMobileTab} />
      </div>
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold" style={{ color: "var(--text-heading)" }}>
          <PieChart size={22} />
          Investments
        </h1>
        <Button
          variant="ghost"
          onClick={() => refreshPricesMutation.mutate()}
          disabled={refreshPricesMutation.isPending}
        >
          {refreshPricesMutation.isPending ? "Refreshing…" : "🔄 Refresh Prices"}
        </Button>
      </div>
      <FilterBar
        accounts={accountsQuery.data ?? []}
        value={filters}
        onChange={(v) => {
          setFilters(v);
          setHasCustomFilters(true);
        }}
      />

      <SwipeableSections
        tabs={visibleTabs}
        active={mobileTab}
        onChange={setMobileTab}
        panels={panels}
        desktopContent={
          <>
            {summaryPanel}

            <SectionPairRow
              leftVisible={visible("netWorthOverTime")}
              left={netWorthOverTimeChart}
              rightVisible={visible("assetAllocation")}
              right={assetAllocationChart}
              className="items-stretch"
            />

            {visible("accountBalances") && accountBalancesPanel}
            {visible("positions") && positionsPanel}

            <SectionPairRow
              leftVisible={visible("topHoldings")}
              left={topHoldingsChart}
              rightVisible={visible("dividendCalendar")}
              right={dividendCalendarChart}
              className="items-stretch"
            />

            <SectionPairRow
              leftVisible={visible("dividendsByCurrency")}
              left={dividendsByCurrencyChart}
              rightVisible={visible("upcomingDividends")}
              right={upcomingDividendsPanel}
              className="items-stretch"
            />

            {visible("trades") && tradesPanel}
          </>
        }
      />

      {dialogOpen && metaQuery.data && (
        <AddTradeDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          accounts={accountsQuery.data ?? []}
          meta={metaQuery.data}
          refetchKey={["portfolio-events"]}
        />
      )}
    </div>
  );
}
