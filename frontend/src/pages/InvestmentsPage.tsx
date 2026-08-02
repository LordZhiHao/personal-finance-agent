import { useMemo, useState } from "react";
import { format, getMonth, parseISO, subDays, subMonths, subYears } from "date-fns";
import { TrendingUp, Wallet } from "lucide-react";
import {
  useAccounts,
  useDividendForecast,
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
import { NetWorthLineChart } from "../components/charts/NetWorthLineChart";
import { AssetAllocationDonut } from "../components/charts/AssetAllocationDonut";
import { AllocationBarChart } from "../components/charts/AllocationBarChart";
import { DividendCalendar } from "../components/charts/DividendCalendar";
import { UpcomingDividends, type TickerCostBasis } from "../components/charts/UpcomingDividends";
import { TradeHistoryTable } from "../components/charts/TradeHistoryTable";
import { HoldingsTable } from "../components/charts/HoldingsTable";
import { formatMoney } from "../lib/format";
import { Button, Select, TabToggle } from "../components/ui";

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

type InvestmentsTab = "overview" | "holdings" | "trades";
const INVESTMENTS_TABS: { value: InvestmentsTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "holdings", label: "Holdings" },
  { value: "trades", label: "Trades" },
];

export function InvestmentsPage() {
  const [filters, setFilters] = useState<FilterValue>(defaultFilters);
  const [hasCustomFilters, setHasCustomFilters] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<InvestmentsTab>("overview");
  const [period, setPeriod] = useState<Period>("All");
  const [selectedBrokerAccountId, setSelectedBrokerAccountId] = useState<string>("");
  const [allocationView, setAllocationView] = useState<AllocationView>("broker");

  const { mainCurrency: displayCurrency } = useAuth();
  const accountsQuery = useAccounts(["brokerage"]);
  const metaQuery = useMeta();
  const snapshotsQuery = useSnapshots(displayCurrency);
  const historyQuery = useSnapshotHistory(displayCurrency, selectedBrokerAccountId || undefined);
  const holdingsQuery = useHoldings(displayCurrency);
  const refreshPricesMutation = useRefreshPrices();
  const dividendForecastQuery = useDividendForecast();
  const eventsQuery = usePortfolioEvents(
    hasCustomFilters ? filters.startDate : undefined,
    hasCustomFilters ? filters.endDate : undefined,
  );

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

  const netWorth = snapshots.reduce((sum, s) => sum + s.converted_value, 0);

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

  return (
    <div className="space-y-3">
      <h1 className="flex items-center gap-2 text-xl font-semibold" style={{ color: "var(--text-heading)" }}>
        <TrendingUp size={22} />
        Investments
      </h1>
      <FilterBar
        accounts={accountsQuery.data ?? []}
        value={filters}
        onChange={(v) => {
          setFilters(v);
          setHasCustomFilters(true);
        }}
      />

      <SwipeableSections
        tabs={INVESTMENTS_TABS}
        active={mobileTab}
        onChange={setMobileTab}
        panels={{
          overview: (
            <div className="space-y-3">
              <StatCard
                label="Net Worth"
                value={formatMoney(netWorth, displayCurrency)}
                icon={<Wallet size={20} />}
                hero
                headerRight={
                  <Button
                    variant="ghost"
                    onClick={() => refreshPricesMutation.mutate()}
                    disabled={refreshPricesMutation.isPending}
                  >
                    {refreshPricesMutation.isPending ? "Refreshing…" : "🔄 Refresh Prices"}
                  </Button>
                }
              />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                <div className="lg:col-span-8">
                  <ChartCard
                    title="Net Worth Over Time"
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
                      <TabToggle
                        options={brokerOptions}
                        value={selectedBrokerAccountId}
                        onChange={setSelectedBrokerAccountId}
                      />
                    </div>
                    {filteredNetWorthPoints.length > 0 ? (
                      <NetWorthLineChart points={filteredNetWorthPoints} />
                    ) : (
                      <p style={{ color: "var(--text-secondary)" }}>No asset snapshots yet.</p>
                    )}
                  </ChartCard>
                </div>
                <div className="lg:col-span-4">
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
                      <AssetAllocationDonut data={allocationData} fill />
                    ) : (
                      <p style={{ color: "var(--text-secondary)" }}>No asset snapshots yet.</p>
                    )}
                  </ChartCard>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                <div className="lg:col-span-8">
                  <ChartCard title="Top Holdings">
                    {topHoldings.length > 0 ? (
                      <div className="max-h-[420px] overflow-y-auto">
                        <AllocationBarChart data={topHoldings} currency={displayCurrency} />
                      </div>
                    ) : (
                      <p style={{ color: "var(--text-secondary)" }}>No holdings yet.</p>
                    )}
                  </ChartCard>
                </div>
                <div className="lg:col-span-4">
                  <ChartCard title="Dividend Calendar" fill>
                    <DividendCalendar events={events} fill />
                  </ChartCard>
                </div>
              </div>
            </div>
          ),
          holdings: (
            <div className="space-y-3">
              <ChartCard title="Upcoming Dividends">
                <UpcomingDividends
                  forecast={dividendForecastQuery.data ?? []}
                  names={tickerNames}
                  costBasis={avgCostByTicker}
                />
              </ChartCard>

              <ChartCard title="Positions">
                <div className="max-h-[420px] overflow-y-auto">
                  <HoldingsTable
                    holdings={holdingsQuery.data?.holdings ?? []}
                    currency={displayCurrency}
                    totalMarketValue={holdingsQuery.data?.total_market_value}
                  />
                </div>
              </ChartCard>
            </div>
          ),
          trades: (
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
          ),
        }}
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
