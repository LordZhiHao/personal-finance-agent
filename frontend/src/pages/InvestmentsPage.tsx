import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { useAccounts, useMeta, usePortfolioEvents, useSnapshots } from "../hooks/api";
import { FilterBar, type FilterValue } from "../components/FilterBar";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { AddTradeDialog } from "../components/AddTradeDialog";
import { NetWorthLineChart } from "../components/charts/NetWorthLineChart";
import { AssetAllocationDonut } from "../components/charts/AssetAllocationDonut";
import { formatMoney } from "../lib/format";

const today = format(new Date(), "yyyy-MM-dd");
const defaultFilters: FilterValue = {
  startDate: format(subDays(new Date(), 180), "yyyy-MM-dd"),
  endDate: today,
  account: "All",
  currency: "SGD",
};

const th = "text-left text-xs font-medium py-2 px-3";
const td = "text-sm py-1.5 px-3";

export function InvestmentsPage() {
  const [filters, setFilters] = useState<FilterValue>(defaultFilters);
  const [hasCustomFilters, setHasCustomFilters] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const allocation = useMemo(
    () =>
      snapshots.map((s) => ({ name: s.accounts?.name ?? "Unknown", value: s.converted_value })),
    [snapshots],
  );

  const eventsSorted = useMemo(() => [...events].sort((a, b) => b.date.localeCompare(a.date)), [events]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
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

      <StatCard label="Net Worth" value={formatMoney(netWorth, displayCurrency)} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Net Worth Over Time">
          {netWorthPoints.length > 0 ? (
            <NetWorthLineChart points={netWorthPoints} />
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

      <div className="rounded-lg p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Trade History
          </h3>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="rounded px-3 py-1.5 text-sm font-medium text-white"
            style={{ background: "var(--series-1)" }}
          >
            ＋ Add Entry
          </button>
        </div>
        {eventsSorted.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>No trades found for this period.</p>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0" style={{ background: "var(--surface-1)" }}>
                <tr style={{ borderBottom: "1px solid var(--gridline)", color: "var(--text-muted)" }}>
                  <th className={th}>Date</th>
                  <th className={th}>Ticker</th>
                  <th className={th}>Action</th>
                  <th className={th}>Quantity</th>
                  <th className={th}>Price</th>
                  <th className={th}>Currency</th>
                  <th className={th}>Fees</th>
                  <th className={th}>Notes</th>
                  <th className={th}>Account</th>
                </tr>
              </thead>
              <tbody>
                {eventsSorted.map((e) => (
                  <tr key={e.id} style={{ borderBottom: "1px solid var(--gridline)" }}>
                    <td className={`${td} tabular-nums`} style={{ color: "var(--text-secondary)" }}>{e.date}</td>
                    <td className={td} style={{ color: "var(--text-primary)" }}>{e.ticker}</td>
                    <td className={td} style={{ color: "var(--text-primary)" }}>{e.action}</td>
                    <td className={`${td} tabular-nums`} style={{ color: "var(--text-primary)" }}>{e.quantity}</td>
                    <td className={`${td} tabular-nums`} style={{ color: "var(--text-primary)" }}>{e.price}</td>
                    <td className={td} style={{ color: "var(--text-secondary)" }}>{e.currency}</td>
                    <td className={`${td} tabular-nums`} style={{ color: "var(--text-secondary)" }}>{e.fees ?? "—"}</td>
                    <td className={td} style={{ color: "var(--text-secondary)" }}>{e.notes ?? ""}</td>
                    <td className={td} style={{ color: "var(--text-secondary)" }}>{e.accounts?.name ?? "Unknown"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
