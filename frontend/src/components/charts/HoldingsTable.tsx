import type { Holding } from "../../types";
import { formatMoney, formatPct } from "../../lib/format";
import { Table, Thead, Tbody, Tr, Th, Td } from "../ui/Table";

export function HoldingsTable({
  holdings,
  currency,
  totalMarketValue,
}: {
  holdings: Holding[];
  currency: string;
  totalMarketValue?: number;
}) {
  if (holdings.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>No holdings found.</p>;
  }

  const showPortfolioShare = totalMarketValue !== undefined && totalMarketValue > 0;

  return (
    <Table>
      <Thead>
        <Th>Ticker</Th>
        <Th>Account</Th>
        <Th align="right">Quantity</Th>
        <Th align="right">Avg Cost</Th>
        <Th align="right">Market Value</Th>
        <Th align="right">Cost Basis</Th>
        <Th align="right">Gain/Loss</Th>
        {showPortfolioShare && <Th align="right">% of Portfolio</Th>}
      </Thead>
      <Tbody>
        {holdings.map((h) => {
          const noPrice = h.market_value === null;
          const gainColor =
            h.unrealized_gain === null
              ? "var(--text-secondary)"
              : h.unrealized_gain >= 0
                ? "var(--tint-green-text)"
                : "var(--tint-red-text)";
          const portfolioShare = !noPrice && showPortfolioShare ? (h.market_value! / totalMarketValue!) * 100 : null;
          return (
            <Tr key={`${h.account_name}-${h.ticker}`}>
              <Td className="font-medium">
                {noPrice && "⚠️ "}
                {h.ticker}
              </Td>
              <Td style={{ color: "var(--text-secondary)" }}>{h.account_name}</Td>
              <Td align="right">{h.quantity.toFixed(2)}</Td>
              <Td align="right">
                {h.avg_cost.toFixed(2)} {h.cost_currency}
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
