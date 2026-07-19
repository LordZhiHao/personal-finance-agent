import { useState } from "react";
import { useHoldings, useMeta } from "../hooks/api";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { HoldingsTable } from "../components/charts/HoldingsTable";
import { formatMoney } from "../lib/format";

export function PortfolioPage() {
  const metaQuery = useMeta();
  const [currency, setCurrency] = useState("SGD");
  const holdingsQuery = useHoldings(currency);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
          📊 Portfolio
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

      {holdingsQuery.isLoading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Total Market Value" value={formatMoney(holdingsQuery.data?.total_market_value ?? 0, currency)} />
            <StatCard label="Total Cost Basis" value={formatMoney(holdingsQuery.data?.total_cost_basis ?? 0, currency)} />
            <StatCard label="Unrealized Gain" value={formatMoney(holdingsQuery.data?.total_unrealized_gain ?? 0, currency)} />
          </div>
          <ChartCard title="Holdings">
            <HoldingsTable holdings={holdingsQuery.data?.holdings ?? []} currency={currency} />
          </ChartCard>
        </>
      )}
    </div>
  );
}
