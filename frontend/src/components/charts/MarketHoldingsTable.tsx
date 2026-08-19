import type { Holding } from "../../types";
import { formatMoney, formatPct } from "../../lib/format";
import { Table, Thead, Tbody, Tr, Th, Td } from "../ui/Table";
import { useSortableRows } from "../../lib/sort";

/** Like HoldingsTable, but every money column is that market's own native currency
 * (native_cost_basis/native_market_value/native_unrealized_gain) rather than the
 * app-wide main-currency-converted amounts HoldingsTable shows. */
export function MarketHoldingsTable({ holdings, currency }: { holdings: Holding[]; currency: string }) {
  const { sorted, requestSort, directionFor } = useSortableRows(holdings, {
    ticker: (h) => h.ticker,
    account: (h) => h.account_name,
    quantity: (h) => h.quantity,
    avg_cost: (h) => h.avg_cost,
    market_value: (h) => h.native_market_value,
    cost_basis: (h) => h.native_cost_basis,
    gain: (h) => h.native_unrealized_gain,
  });

  if (holdings.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>No holdings found.</p>;
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <Thead>
            <Th sticky className="min-w-[110px]" sortDirection={directionFor("ticker")} onSort={() => requestSort("ticker")}>
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
            <Th align="right" sortDirection={directionFor("market_value")} onSort={() => requestSort("market_value")}>
              Market Value
            </Th>
            <Th align="right" sortDirection={directionFor("cost_basis")} onSort={() => requestSort("cost_basis")}>
              Amount Invested
            </Th>
            <Th align="right" sortDirection={directionFor("gain")} onSort={() => requestSort("gain")}>
              Return
            </Th>
          </Thead>
          <Tbody>
            {sorted.map((h) => {
              const noPrice = h.native_market_value === null;
              const gain = h.native_unrealized_gain;
              const gainPct = gain !== null && h.native_cost_basis ? (gain / h.native_cost_basis) * 100 : null;
              const gainColor =
                gain === null ? "var(--text-secondary)" : gain >= 0 ? "var(--tint-green-text)" : "var(--tint-red-text)";
              return (
                <Tr key={`${h.account_name}-${h.ticker}`}>
                  <Td sticky className="min-w-[110px]">
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
                  <Td align="right">{h.avg_cost.toFixed(2)}</Td>
                  <Td align="right">
                    {noPrice ? "no price available" : formatMoney(h.native_market_value!, currency)}
                  </Td>
                  <Td align="right">{formatMoney(h.native_cost_basis, currency)}</Td>
                  <Td align="right" style={{ color: gainColor }} className="font-medium">
                    {gain === null ? "—" : `${formatMoney(gain, currency)} (${formatPct(gainPct ?? 0)})`}
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </div>

      <div className="md:hidden space-y-1">
        {sorted.map((h) => {
          const noPrice = h.native_market_value === null;
          const gain = h.native_unrealized_gain;
          const gainPct = gain !== null && h.native_cost_basis ? (gain / h.native_cost_basis) * 100 : null;
          const gainColor =
            gain === null ? "var(--text-secondary)" : gain >= 0 ? "var(--tint-green-text)" : "var(--tint-red-text)";
          return (
            <div key={`${h.account_name}-${h.ticker}`} className="p-2 rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {noPrice && "⚠️ "}
                  {h.ticker}
                </span>
                <span className="text-sm font-semibold shrink-0">
                  {noPrice ? "no price available" : formatMoney(h.native_market_value!, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {h.name ?? h.ticker}
                </span>
                <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                  {h.account_name} · Qty: {h.quantity.toFixed(2)}
                </span>
              </div>
              <div className="text-xs font-medium mt-0.5" style={{ color: gainColor }}>
                {gain === null ? "—" : `${gain >= 0 ? "▲" : "▼"} ${formatMoney(gain, currency)} (${formatPct(gainPct ?? 0)})`}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
