import { useMemo, useState } from "react";
import { Briefcase, PieChart as PieChartIcon, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import type { Holding } from "../types";
import { useHoldings } from "../hooks/api";
import { useAuth } from "../auth/AuthContext";
import { StatCard } from "../components/StatCard";
import { ChartCard } from "../components/ChartCard";
import { HoldingsTable } from "../components/charts/HoldingsTable";
import { MarketHoldingsTable } from "../components/charts/MarketHoldingsTable";
import { formatMoney, formatPct } from "../lib/format";
import { CURRENCY_MARKET } from "../lib/markets";
import { Input, TabToggle, Card } from "../components/ui";
import { LoadingFinn } from "../components/LoadingFinn";

type HoldingFilter = "all" | "gainers" | "losers";

export function PortfolioPage() {
  const { mainCurrency: currency } = useAuth();
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

  const holdingsByMarket = useMemo(() => {
    const groups = new Map<string, { currency: string; holdings: Holding[] }>();
    for (const h of holdings) {
      const nativeCurrency = h.price_currency ?? h.cost_currency;
      const market = CURRENCY_MARKET[nativeCurrency] ?? nativeCurrency;
      if (!groups.has(market)) groups.set(market, { currency: nativeCurrency, holdings: [] });
      groups.get(market)!.holdings.push(h);
    }
    return groups;
  }, [holdings]);

  return (
    <div className="space-y-3">
      <h1 className="flex items-center gap-2 text-xl font-semibold" style={{ color: "var(--text-heading)" }}>
        <PieChartIcon size={22} />
        Portfolio
      </h1>

      {holdingsQuery.isLoading ? (
        <LoadingFinn />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-6">
              <StatCard
                label="Total Market Value"
                value={formatMoney(holdingsQuery.data?.total_market_value ?? 0, currency)}
                icon={<Briefcase size={20} />}
                hero
              />
            </div>
            <div className="lg:col-span-6 flex flex-col gap-4">
              <StatCard
                label="Total Cost Basis"
                value={formatMoney(costBasis, currency)}
                icon={<Receipt size={20} />}
                tint="amber"
              />
              <StatCard
                label="Unrealized Gain"
                value={formatMoney(gain, currency)}
                icon={gain >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                tint={gain >= 0 ? "green" : "red"}
                delta={{ value: formatPct(gainPct), direction: gain >= 0 ? "up" : "down" }}
              />
            </div>
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

          {[...holdingsByMarket.entries()].map(([market, group]) => {
            const marketCostBasis = group.holdings.reduce((sum, h) => sum + h.native_cost_basis, 0);
            const marketMarketValue = group.holdings.reduce(
              (sum, h) => sum + (h.native_market_value ?? 0),
              0,
            );
            const marketGain = group.holdings.reduce((sum, h) => sum + (h.native_unrealized_gain ?? 0), 0);
            const marketGainPct = marketCostBasis !== 0 ? (marketGain / marketCostBasis) * 100 : 0;
            return (
              <ChartCard key={market} title={`${market} Market (${group.currency})`}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <StatCard
                    label="Amount Invested"
                    value={formatMoney(marketCostBasis, group.currency)}
                    icon={<Receipt size={20} />}
                    tint="amber"
                  />
                  <StatCard
                    label="Market Value"
                    value={formatMoney(marketMarketValue, group.currency)}
                    icon={<Briefcase size={20} />}
                    tint="brand"
                  />
                  <StatCard
                    label="Return"
                    value={formatMoney(marketGain, group.currency)}
                    icon={marketGain >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    tint={marketGain >= 0 ? "green" : "red"}
                    delta={{ value: formatPct(marketGainPct), direction: marketGain >= 0 ? "up" : "down" }}
                  />
                </div>
                <MarketHoldingsTable holdings={group.holdings} currency={group.currency} />
              </ChartCard>
            );
          })}
        </>
      )}
    </div>
  );
}
