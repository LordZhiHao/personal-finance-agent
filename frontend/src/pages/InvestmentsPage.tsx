import { useMemo, useState } from "react";
import { format, subDays, subMonths, subYears } from "date-fns";
import { useAccounts, useMeta, usePortfolioEvents, useSnapshots } from "../hooks/api";
import { FilterBar, type FilterValue } from "../components/FilterBar";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { AddTradeDialog } from "../components/AddTradeDialog";
import { NetWorthLineChart } from "../components/charts/NetWorthLineChart";
import { AssetAllocationDonut } from "../components/charts/AssetAllocationDonut";
import { AllocationBarChart } from "../components/charts/AllocationBarChart";
import { DividendCalendar } from "../components/charts/DividendCalendar";
import { TradeHistoryTable } from "../components/charts/TradeHistoryTable";
import { formatMoney } from "../lib/format";
import { Button, Select } from "../components/ui";

const today = format(new Date(), "yyyy-MM-dd");
const defaultFilters: FilterValue = {
  startDate: format(subDays(new Date(), 180), "yyyy-MM-dd"),
  endDate: today,
  account: "All",
  currency: "SGD",
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

export function InvestmentsPage() {
  const [filters, setFilters] = useState<FilterValue>(defaultFilters);
  const [hasCustomFilters, setHasCustomFilters] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("All");

  const displayCurrency = filters.currency ?? "SGD";
  const accountsQuery = useAccounts(["brokerage"]);
  const metaQuery = useMeta();
  const snapshotsQuery = useSnapshots(displayCurrency);
  const eventsQuery = usePortfolioEvents(
    hasCustomFilters ? filters.startDate : undefined,
    hasCustomFilters ? filters.endDate : undefined,
  );

  const snapshots = useMemo(() => {
    const rows = snapshotsQuery.data ?? [];
    if (filters.account === "All") return rows;
    return rows.filter((s) => s.accounts?.name === filters.account);
  }, [snapshotsQuery.data, filters.account]);

  const events = useMemo(() => {
    const rows = eventsQuery.data ?? [];
    if (filters.account === "All") return rows;
    return rows.filter((e) => e.accounts?.name === filters.account);
  }, [eventsQuery.data, filters.account]);

  const netWorth = snapshots.reduce((sum, s) => sum + s.converted_value, 0);

  const netWorthPoints = useMemo(() => {
    const totals = new Map<string, number>();
    for (const s of snapshots) {
      totals.set(s.snapshot_date, (totals.get(s.snapshot_date) ?? 0) + s.converted_value);
    }
    return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
  }, [snapshots]);

  const filteredNetWorthPoints = useMemo(() => {
    const cutoff = periodCutoff(period);
    if (!cutoff) return netWorthPoints;
    return netWorthPoints.filter((p) => p.date >= cutoff);
  }, [netWorthPoints, period]);

  const allocation = useMemo(
    () =>
      snapshots.map((s) => ({ name: s.accounts?.name ?? "Unknown", value: s.converted_value })),
    [snapshots],
  );

  const eventsSorted = useMemo(() => [...events].sort((a, b) => b.date.localeCompare(a.date)), [events]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold" style={{ color: "var(--text-heading)" }}>
        📈 Investments
      </h1>
      <FilterBar
        accounts={accountsQuery.data ?? []}
        value={filters}
        currencies={metaQuery.data?.currencies}
        onChange={(v) => {
          setFilters(v);
          setHasCustomFilters(true);
        }}
      />

      <StatCard label="Net Worth" value={formatMoney(netWorth, displayCurrency)} icon="💰" tint="brand" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
          {filteredNetWorthPoints.length > 0 ? (
            <NetWorthLineChart points={filteredNetWorthPoints} />
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No asset snapshots yet.</p>
          )}
        </ChartCard>
        <ChartCard title="Asset Allocation">
          {allocation.length > 0 ? (
            <AssetAllocationDonut data={allocation} />
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No asset snapshots yet.</p>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Allocation by Account">
          {allocation.length > 0 ? (
            <AllocationBarChart data={allocation} currency={displayCurrency} />
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No asset snapshots yet.</p>
          )}
        </ChartCard>
        <ChartCard title="Dividend Calendar">
          <DividendCalendar events={events} />
        </ChartCard>
      </div>

      <ChartCard
        title="Trade History"
        headerRight={
          <Button variant="primary" onClick={() => setDialogOpen(true)}>
            ＋ Add Entry
          </Button>
        }
      >
        <TradeHistoryTable events={eventsSorted} refetchKey={["portfolio-events"]} />
      </ChartCard>

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
