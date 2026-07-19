import { useState } from "react";
import { useBalances, useMeta } from "../hooks/api";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { BalancesTable } from "../components/charts/BalancesTable";
import { formatMoney } from "../lib/format";

export function BalancesPage() {
  const metaQuery = useMeta();
  const [currency, setCurrency] = useState("SGD");
  const balancesQuery = useBalances(currency);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
          💳 Balances
        </h1>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="rounded px-2 py-1.5 text-sm outline-none"
          style={{ border: "1px solid var(--baseline)", color: "var(--text-primary)", background: "var(--surface-1)" }}
        >
          {(metaQuery.data?.currencies ?? ["SGD"]).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {balancesQuery.isLoading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading…</p>
      ) : (
        <>
          <StatCard label="Total Net Worth" value={formatMoney(balancesQuery.data?.total ?? 0, currency)} />
          <ChartCard title="Accounts">
            <BalancesTable summary={balancesQuery.data!} />
          </ChartCard>
        </>
      )}
    </div>
  );
}
