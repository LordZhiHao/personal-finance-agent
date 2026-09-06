import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, getMonth, parseISO, startOfYear, subDays, subMonths, subYears } from "date-fns";
import { Briefcase, PieChart, Plus, Receipt, TrendingDown, TrendingUp } from "lucide-react";
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
import { SectionPairRow } from "../components/SectionPairRow";
import { FinnInsightCard } from "../components/FinnInsightCard";
import { NetWorthHeroCard } from "../components/charts/NetWorthHeroCard";
import { NetWorthLineChart } from "../components/charts/NetWorthLineChart";
import { AllocationBarChart } from "../components/charts/AllocationBarChart";
import { DividendCalendar } from "../components/charts/DividendCalendar";
import { DividendsByCurrencyDonut } from "../components/charts/DividendsByCurrencyDonut";
import { UpcomingDividends, type TickerCostBasis } from "../components/charts/UpcomingDividends";
import { TradeHistoryTable } from "../components/charts/TradeHistoryTable";
import { HoldingsTable } from "../components/charts/HoldingsTable";
import { MarketHoldingsTable } from "../components/charts/MarketHoldingsTable";
import { BalancesTable } from "../components/charts/BalancesTable";
import { LoadingFinn } from "../components/LoadingFinn";
import { sectionKey } from "../lib/dashboardSections";
import { sumByMonth } from "../lib/dates";
import { formatMoney, formatPct } from "../lib/format";
import { CURRENCY_MARKET } from "../lib/markets";
import { Button, Fab, Input, TabToggle, Card } from "../components/ui";

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

type InvestmentsSectionId =
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

export function InvestmentsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterValue>(defaultFilters);
  const [hasCustomFilters, setHasCustomFilters] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
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
  // Always unbounded (independent of the page's FilterBar date range) so the
  // Dividends by Currency chart's own year/month picker can browse any year in
  // history, not just whatever range the filter bar happens to cover. This is the
  // superset of what the trade-history view below needs in the common (no custom
  // filter) case, so it's the only unbounded portfolio-events fetch on the page —
  // see `events` below, which reuses this data instead of firing a second,
  // duplicate unbounded request.
  const allDividendEventsQuery = usePortfolioEvents(undefined, undefined, displayCurrency);
  // Only actually hits the network when the user has applied a custom (narrower)
  // date range — otherwise `events` below is derived from allDividendEventsQuery,
  // which already covers full unfiltered history.
  const eventsQuery = usePortfolioEvents(
    filters.startDate,
    filters.endDate,
    undefined,
    hasCustomFilters,
  );
  const dividendSummaryQuery = useDividendSummary(
    displayCurrency,
    format(startOfYear(new Date()), "yyyy-MM-dd"),
    today,
  );

  const visible = (id: InvestmentsSectionId) => !hiddenDashboardSections.includes(sectionKey("investments", id));

  const snapshots = useMemo(() => {
    const rows = snapshotsQuery.data ?? [];
    return rows.filter((s) => {
      if (filters.accounts.length > 0 && !filters.accounts.includes(s.accounts?.name ?? "")) return false;
      if (filters.months.length > 0 && !filters.months.includes(getMonth(parseISO(s.snapshot_date)))) return false;
      return true;
    });
  }, [snapshotsQuery.data, filters.accounts, filters.months]);

  const events = useMemo(() => {
    const rows = (hasCustomFilters ? eventsQuery.data : allDividendEventsQuery.data) ?? [];
    return rows.filter((e) => {
      if (filters.accounts.length > 0 && !filters.accounts.includes(e.accounts?.name ?? "")) return false;
      if (filters.months.length > 0 && !filters.months.includes(getMonth(parseISO(e.date)))) return false;
      return true;
    });
  }, [hasCustomFilters, eventsQuery.data, allDividendEventsQuery.data, filters.accounts, filters.months]);

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
      .map(([ticker, value]) => ({
        name: tickerNames[ticker] ?? ticker,
        subtitle: tickerNames[ticker] ? ticker : undefined,
        value,
      }));
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

  // Monthly-aggregated (last-value-per-month) net worth for the hero sparkline —
  // same reduction as OverviewPage's net-worth hero, kept local since it's the
  // only place on this page that wants a monthly-bucketed series.
  const monthlyNetWorthValues = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const p of netWorthPoints) byMonth.set(p.date.slice(0, 7), p.value);
    return [...byMonth.values()].slice(-6);
  }, [netWorthPoints]);

  const netWorthDelta = useMemo(() => {
    if (monthlyNetWorthValues.length < 2) return null;
    const last = monthlyNetWorthValues[monthlyNetWorthValues.length - 1];
    const prev = monthlyNetWorthValues[monthlyNetWorthValues.length - 2];
    const abs = last - prev;
    return { abs, pct: prev !== 0 ? (abs / prev) * 100 : null };
  }, [monthlyNetWorthValues]);

  // A stand-in for a real persisted portfolio-insight system (see CLAUDE.md's
  // Finance Q&A Agent) — a client-side heuristic over holdings already on the
  // page: flag concentration risk first, otherwise call out the best performer.
  const portfolioInsight = useMemo(() => {
    const list = holdingsQuery.data?.holdings ?? [];
    if (list.length === 0 || totalMarketValue <= 0) return null;
    const top = [...list].sort((a, b) => (b.market_value ?? 0) - (a.market_value ?? 0))[0];
    const concentrationPct = top.market_value !== null ? (top.market_value / totalMarketValue) * 100 : 0;
    if (concentrationPct > 30) {
      return { kind: "concentration" as const, name: top.name ?? top.ticker, pct: concentrationPct };
    }
    const best = [...list]
      .filter((h) => h.unrealized_gain_pct !== null)
      .sort((a, b) => (b.unrealized_gain_pct ?? 0) - (a.unrealized_gain_pct ?? 0))[0];
    if (!best) return null;
    return { kind: "performer" as const, name: best.name ?? best.ticker, pct: best.unrealized_gain_pct ?? 0 };
  }, [holdingsQuery.data, totalMarketValue]);

  // Realized dividend $ by month from actual DIVIDEND-action events — the
  // mockup's "dividend runway" bar chart, computed from data already fetched
  // for the Dividends by Currency chart rather than a new endpoint.
  const dividendMonthly = useMemo(
    () => sumByMonth(dividendEvents, (e) => e.date, (e) => e.converted_value ?? e.quantity * e.price).slice(-6),
    [dividendEvents],
  );
  const maxDividendMonth = Math.max(1, ...dividendMonthly.map((d) => d.value));

  const summaryPanel = (
    <NetWorthHeroCard
      label="Total Market Value"
      value={formatMoney(totalMarketValue, displayCurrency)}
      deltaText={
        netWorthDelta
          ? `${formatMoney(Math.abs(netWorthDelta.abs), displayCurrency)}${netWorthDelta.pct !== null ? ` (${netWorthDelta.pct >= 0 ? "+" : ""}${netWorthDelta.pct.toFixed(1)}%)` : ""} this month`
          : undefined
      }
      deltaDirection={netWorthDelta && netWorthDelta.abs < 0 ? "down" : "up"}
      sparkline={monthlyNetWorthValues}
      secondaryStats={[
        { label: "Total Net Worth", value: formatMoney(totalNetWorth, displayCurrency) },
        { label: "YTD Dividends", value: formatMoney(ytdDividends, displayCurrency) },
        { label: "Total Cost Basis", value: formatMoney(costBasis, displayCurrency) },
        {
          label: "Unrealized Gain",
          value: formatMoney(gain, displayCurrency),
          deltaText: formatPct(gainPct),
          deltaDirection: gain >= 0 ? "up" : "down",
        },
      ]}
    />
  );

  const insightRow = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
      <div className="lg:col-span-7">
        {portfolioInsight ? (
          <FinnInsightCard
            eyebrow="Finn on your portfolio"
            body={
              portfolioInsight.kind === "concentration" ? (
                <>
                  <b>{portfolioInsight.name}</b> is {portfolioInsight.pct.toFixed(0)}% of your portfolio — that's
                  meaningful concentration in one position.
                </>
              ) : (
                <>
                  <b>{portfolioInsight.name}</b> is your best performer, up {formatPct(portfolioInsight.pct)} since you
                  bought it.
                </>
              )
            }
            actions={[{ label: "Ask Finn about this", variant: "outline", onClick: () => navigate("/chat") }]}
          />
        ) : (
          <FinnInsightCard eyebrow="Finn on your portfolio" body="Add a few trades and I'll start surfacing insights here." />
        )}
      </div>
      <div className="lg:col-span-5">
        <ChartCard title="Dividend Runway" fill>
          {dividendMonthly.length > 0 ? (
            <div className="flex items-end gap-2" style={{ height: 96 }}>
              {dividendMonthly.map((d) => (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1.5 h-full">
                  <span className="text-xs font-medium tabular-nums" style={{ color: "var(--text-secondary)" }}>
                    {formatMoney(d.value, displayCurrency)}
                  </span>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t"
                      style={{ height: `${Math.max(4, (d.value / maxDividendMonth) * 100)}%`, background: "var(--brand)" }}
                    />
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                    {d.label.split(" ")[0].toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No dividends logged yet.</p>
          )}
        </ChartCard>
      </div>
    </div>
  );

  const netWorthOverTimeChart = (
    <ChartCard title="Net Worth Over Time" fill>
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
        <AllocationBarChart data={allocationData} currency={displayCurrency} />
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

  if (accountsQuery.isLoading || snapshotsQuery.isLoading || holdingsQuery.isLoading || balancesQuery.isLoading) {
    return <LoadingFinn />;
  }

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
    <ChartCard title="Dividend Calendar">
      <DividendCalendar events={events} />
    </ChartCard>
  );

  const dividendsByCurrencyChart = (
    <ChartCard title="Dividends by Currency">
      <DividendsByCurrencyDonut events={dividendEvents} displayCurrency={displayCurrency} />
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
        <Button variant="primary" className="hidden md:inline-flex" onClick={() => setDialogOpen(true)}>
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="flex items-center gap-2 text-lg sm:text-xl font-semibold shrink-0" style={{ color: "var(--text-heading)" }}>
          <PieChart size={22} />
          Investments
        </h1>
        <div className="flex items-center gap-2 shrink-0 relative flex-wrap">
          <TabToggle options={PERIODS.map((p) => ({ value: p, label: p }))} value={period} onChange={setPeriod} />
          <FilterBar
            accounts={accountsQuery.data ?? []}
            value={filters}
            onChange={(v) => {
              setFilters(v);
              setHasCustomFilters(true);
            }}
          />
          <Button
            variant="primary"
            onClick={() => refreshPricesMutation.mutate()}
            disabled={refreshPricesMutation.isPending}
          >
            {refreshPricesMutation.isPending ? "Refreshing…" : "⟳ Refresh"}
          </Button>
        </div>
      </div>

      <Fab onClick={() => setDialogOpen(true)} aria-label="Add entry">
        <Plus size={24} />
      </Fab>

      {summaryPanel}
      {insightRow}

      {visible("positions") && positionsPanel}

      <SectionPairRow
        leftVisible={visible("netWorthOverTime")}
        left={netWorthOverTimeChart}
        rightVisible={visible("assetAllocation")}
        right={assetAllocationChart}
        className="items-stretch"
      />

      {visible("trades") && tradesPanel}

      {visible("accountBalances") && accountBalancesPanel}
      {visible("topHoldings") && topHoldingsChart}
      {visible("dividendCalendar") && dividendCalendarChart}
      {visible("dividendsByCurrency") && dividendsByCurrencyChart}
      {visible("upcomingDividends") && upcomingDividendsPanel}

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
