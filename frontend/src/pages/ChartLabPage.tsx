import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { useAuth } from "../auth/AuthContext";
import { useMeta, useSnapshotHistory, useTransactions } from "../hooks/api";
import { ChartCard } from "../components/ChartCard";
import { NetWorthLineChart, type NetWorthPoint } from "../components/charts/NetWorthLineChart";
import { NetWorthLineChartEcharts } from "../components/charts/echarts-pilot/NetWorthLineChartEcharts";
import { SpendByCategoryDonut } from "../components/charts/SpendByCategoryDonut";
import { SpendByCategoryDonutEcharts, type CategoryTotal } from "../components/charts/echarts-pilot/SpendByCategoryDonutEcharts";
import { categoryColorOrder } from "../lib/palette";

const today = format(new Date(), "yyyy-MM-dd");
const ninetyDaysAgo = format(subDays(new Date(), 90), "yyyy-MM-dd");

// Hidden dev-only route (not linked from Layout's nav) for comparing the
// current Recharts charts against an ECharts pilot side by side, using real
// data. See CLAUDE.md-adjacent plan doc for why this exists — no production
// page references this component.
export function ChartLabPage() {
  const { mainCurrency } = useAuth();
  const metaQuery = useMeta();
  const historyQuery = useSnapshotHistory(mainCurrency);
  const txQuery = useTransactions(ninetyDaysAgo, today, mainCurrency);

  const netWorthPoints: NetWorthPoint[] = useMemo(() => {
    const totals = new Map<string, number>();
    for (const s of historyQuery.data ?? []) {
      totals.set(s.snapshot_date, (totals.get(s.snapshot_date) ?? 0) + s.converted_value);
    }
    return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
  }, [historyQuery.data]);

  const classifications = metaQuery.data?.category_classifications ?? {};
  const categories = metaQuery.data?.categories ?? [];
  const categoryColors = useMemo(
    () => categoryColorOrder(categories, classifications),
    [categories, classifications],
  );

  const categoryTotals: CategoryTotal[] = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of txQuery.data ?? []) {
      if (t.amount >= 0) continue;
      const cat = t.category || "Other";
      totals.set(cat, (totals.get(cat) ?? 0) + Math.abs(t.converted_amount ?? t.amount));
    }
    return [...totals.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [txQuery.data]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-heading)" }}>
          Chart Lab
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Pilot comparison: current Recharts charts vs. an ECharts rebuild, same live data. Not linked from
          navigation — this page is for evaluation only.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Net Worth — Recharts (current)">
          {netWorthPoints.length > 0 ? (
            <NetWorthLineChart points={netWorthPoints} />
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No asset snapshots yet.</p>
          )}
        </ChartCard>
        <ChartCard title="Net Worth — ECharts (pilot)">
          {netWorthPoints.length > 0 ? (
            <NetWorthLineChartEcharts points={netWorthPoints} />
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No asset snapshots yet.</p>
          )}
        </ChartCard>

        <ChartCard title="Spend by Category — Recharts (current)">
          <SpendByCategoryDonut
            transactions={txQuery.data ?? []}
            categoryColors={categoryColors}
            currency={mainCurrency}
            categories={categories}
            allAccounts={[]}
          />
        </ChartCard>
        <ChartCard title="Spend by Category — ECharts (pilot)">
          {categoryTotals.length > 0 ? (
            <SpendByCategoryDonutEcharts data={categoryTotals} categoryColors={categoryColors} currency={mainCurrency} />
          ) : (
            <p style={{ color: "var(--text-secondary)" }}>No spending in the last 90 days.</p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
