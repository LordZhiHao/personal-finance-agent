import { useMemo, useState } from "react";
import { useHoldings, useMeta } from "../hooks/api";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { HoldingsTable } from "../components/charts/HoldingsTable";
import { formatMoney, formatPct } from "../lib/format";
import { Select, Input, TabToggle, Card } from "../components/ui";

type HoldingFilter = "all" | "gainers" | "losers";

export function PortfolioPage() {
  const metaQuery = useMeta();
  const [currency, setCurrency] = useState("SGD");
  const holdingsQuery = useHoldings(currency);
  const [filter, setFilter] = useState<HoldingFilter>("all");
  const [search, setSearch] = useState("");

  const holdings = holdingsQuery.data?.holdings ?? [];
  const filteredHoldings = useMemo(() => {
    return holdings.filter((h) => {
      if (filter === "gainers" && !(h.unrealized_gain !== null && h.unrealized_gain > 0)) return false;
      if (filter === "losers" && !(h.unrealized_gain !== null && h.unrealized_gain < 0)) return false;
      if (search && !h.ticker.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [holdings, filter, search]);

  const gain = holdingsQuery.data?.total_unrealized_gain ?? 0;
  const costBasis = holdingsQuery.data?.total_cost_basis ?? 0;
  const gainPct = costBasis !== 0 ? (gain / costBasis) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-heading)" }}>
          📊 Portfolio
        </h1>
        <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {(metaQuery.data?.currencies ?? ["SGD"]).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      {holdingsQuery.isLoading ? (
        <p style={{ color: "var(--text-secondary)" }}>Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <StatCard
              label="Total Market Value"
              value={formatMoney(holdingsQuery.data?.total_market_value ?? 0, currency)}
              icon="💼"
              tint="brand"
            />
            <StatCard label="Total Cost Basis" value={formatMoney(costBasis, currency)} icon="🧾" tint="amber" />
            <StatCard
              label="Unrealized Gain"
              value={formatMoney(gain, currency)}
              icon={gain >= 0 ? "📈" : "📉"}
              tint={gain >= 0 ? "green" : "red"}
              delta={{ value: formatPct(gainPct), direction: gain >= 0 ? "up" : "down" }}
            />
          </div>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabToggle
                options={[
                  { value: "all", label: "All" },
                  { value: "gainers", label: "Gainers" },
                  { value: "losers", label: "Losers" },
                ]}
                value={filter}
                onChange={setFilter}
              />
              <Input
                placeholder="Search ticker…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-48"
              />
            </div>
          </Card>

          <ChartCard title="Holdings">
            <HoldingsTable holdings={filteredHoldings} currency={currency} />
          </ChartCard>
        </>
      )}
    </div>
  );
}
