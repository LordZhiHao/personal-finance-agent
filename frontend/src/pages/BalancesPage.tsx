import { Wallet } from "lucide-react";
import { useBalances } from "../hooks/api";
import { useAuth } from "../auth/AuthContext";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { BalancesTable } from "../components/charts/BalancesTable";
import { formatMoney } from "../lib/format";
import { LoadingFinn } from "../components/LoadingFinn";

export function BalancesPage() {
  const { mainCurrency: currency } = useAuth();
  const balancesQuery = useBalances(currency);

  return (
    <div className="space-y-3">
      <h1 className="flex items-center gap-2 text-xl font-semibold" style={{ color: "var(--text-heading)" }}>
        <Wallet size={22} />
        Balances
      </h1>

      {balancesQuery.isLoading ? (
        <LoadingFinn />
      ) : (
        <>
          <StatCard
            label="Total Net Worth"
            value={formatMoney(balancesQuery.data?.total ?? 0, currency)}
            icon={<Wallet size={20} />}
            hero
          />
          <ChartCard title="Accounts">
            <BalancesTable summary={balancesQuery.data!} />
          </ChartCard>
        </>
      )}
    </div>
  );
}
