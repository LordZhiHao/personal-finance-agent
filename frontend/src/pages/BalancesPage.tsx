import { useState } from "react";
import { useBalances, useMeta } from "../hooks/api";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { BalancesTable } from "../components/charts/BalancesTable";
import { formatMoney } from "../lib/format";
import { Select } from "../components/ui";

export function BalancesPage() {
  const metaQuery = useMeta();
  const [currency, setCurrency] = useState("SGD");
  const balancesQuery = useBalances(currency);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-heading)" }}>
          💳 Balances
        </h1>
        <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {(metaQuery.data?.currencies ?? ["SGD"]).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

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
