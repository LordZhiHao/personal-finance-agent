import type { Holding } from "../../types";
import { formatMoney, formatPct } from "../../lib/format";
import { Table, Thead, Tbody, Tr, Th, Td } from "../ui/Table";
import { useSortableRows } from "../../lib/sort";

export function HoldingsTable({
  holdings,
  currency,
  totalMarketValue,
}: {
  holdings: Holding[];
  currency: string;
  totalMarketValue?: number;
}) {
  const showPortfolioShare = totalMarketValue !== undefined && totalMarketValue > 0;

  function portfolioShareFor(h: Holding): number | null {
    return h.market_value !== null && showPortfolioShare ? (h.market_value / totalMarketValue!) * 100 : null;
  }

  const { sorted, requestSort, directionFor } = useSortableRows(holdings, {
    ticker: (h) => h.ticker,
    account: (h) => h.account_name,
    quantity: (h) => h.quantity,
    avg_cost: (h) => h.avg_cost,
    price: (h) => h.price,
    market_value: (h) => h.market_value,
    cost_basis: (h) => h.cost_basis,
    gain: (h) => h.unrealized_gain,
    portfolio_share: (h) => portfolioShareFor(h),
  });

  if (holdings.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>No holdings found.</p>;
  }

  return (
    <Table>
      <Thead>
        <Th sortDirection={directionFor("ticker")} onSort={() => requestSort("ticker")}>
          Ticker
        </Th>
        <Th sortDirection={directionFor("account")} onSort={() => requestSort("account")}>
          Account
        </Th>
        <Th align="right" sortDirection={directionFor("quantity")} onSort={() => requestSort("quantity")}>
          Quantity
        </Th>
        <Th align="right" sortDirection={directionFor("avg_cost")} onSort={() => requestSort("avg_cost")}>
          Avg Cost
        </Th>
        <Th align="right" sortDirection={directionFor("price")} onSort={() => requestSort("price")}>
          Latest Price
        </Th>
        <Th align="right" sortDirection={directionFor("market_value")} onSort={() => requestSort("market_value")}>
          Market Value
        </Th>
        <Th align="right" sortDirection={directionFor("cost_basis")} onSort={() => requestSort("cost_basis")}>
          Cost Basis
        </Th>
        <Th align="right" sortDirection={directionFor("gain")} onSort={() => requestSort("gain")}>
          Gain/Loss
        </Th>
        {showPortfolioShare && (
          <Th align="right" sortDirection={directionFor("portfolio_share")} onSort={() => requestSort("portfolio_share")}>
            % of Portfolio
          </Th>
        )}
      </Thead>
      <Tbody>
        {sorted.map((h) => {
          const noPrice = h.market_value === null;
          const gainColor =
            h.unrealized_gain === null
              ? "var(--text-secondary)"
              : h.unrealized_gain >= 0
                ? "var(--tint-green-text)"
                : "var(--tint-red-text)";
          const portfolioShare = portfolioShareFor(h);
          return (
            <Tr key={`${h.account_name}-${h.ticker}`}>
              <Td>
                <div className="font-medium">
                  {noPrice && "⚠️ "}
                  {h.ticker}
                </div>
                {h.name && (
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {h.name}
                  </div>
                )}
              </Td>
              <Td style={{ color: "var(--text-secondary)" }}>{h.account_name}</Td>
              <Td align="right">{h.quantity.toFixed(2)}</Td>
              <Td align="right">
                {h.avg_cost.toFixed(2)} {h.cost_currency}
              </Td>
              <Td align="right">
                {h.price === null ? "—" : `${h.price.toFixed(2)} ${h.price_currency ?? ""}`}
              </Td>
              <Td align="right">{noPrice ? "no price available" : formatMoney(h.market_value!, currency)}</Td>
              <Td align="right">{formatMoney(h.cost_basis, currency)}</Td>
              <Td align="right" style={{ color: gainColor }} className="font-medium">
                {h.unrealized_gain === null
                  ? "—"
                  : `${formatMoney(h.unrealized_gain, currency)} (${formatPct(h.unrealized_gain_pct ?? 0)})`}
              </Td>
              {showPortfolioShare && <Td align="right">{portfolioShare === null ? "—" : `${portfolioShare.toFixed(1)}%`}</Td>}
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
}
