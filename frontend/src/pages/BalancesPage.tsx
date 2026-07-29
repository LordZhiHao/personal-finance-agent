import { useBalances } from "../hooks/api";
import { useAuth } from "../auth/AuthContext";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { BalancesTable } from "../components/charts/BalancesTable";
import { formatMoney } from "../lib/format";

export function BalancesPage() {
  const { mainCurrency: currency } = useAuth();
  const balancesQuery = useBalances(currency);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold" style={{ color: "var(--text-heading)" }}>
        💳 Balances
      </h1>

      {balancesQuery.isLoading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading…</p>
      ) : (
        <>
          <StatCard
            label="Total Net Worth"
            value={formatMoney(balancesQuery.data?.total ?? 0, currency)}
            icon="🏦"
            tint="brand"
          />
          <ChartCard title="Accounts">
            <BalancesTable summary={balancesQuery.data!} />
          </ChartCard>
        </>
      )}
    </div>
  );
}
