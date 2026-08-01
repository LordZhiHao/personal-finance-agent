import type { DividendForecast } from "../../types";
import { Table, Thead, Tbody, Tr, Th, Td } from "../ui/Table";
import { formatMoney } from "../../lib/format";

export interface TickerCostBasis {
  avgCost: number;
  currency: string;
}

export function UpcomingDividends({
  forecast,
  names,
  costBasis,
}: {
  forecast: DividendForecast[];
  names?: Record<string, string>;
  costBasis?: Record<string, TickerCostBasis>;
}) {
  if (forecast.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>No held tickers yet.</p>;
  }

  return (
    <div className="max-h-[400px] overflow-y-auto">
      <Table>
        <Thead>
          <Th>Ticker</Th>
          <Th>Next Ex-Dividend</Th>
          <Th align="right">Rate / Share</Th>
          <Th align="right">Dividend Yield</Th>
          <Th align="right">Effective Yield</Th>
        </Thead>
        <Tbody>
          {forecast.map((f) => {
            const cost = costBasis?.[f.ticker];
            const effectiveYield =
              f.dividend_rate !== null && cost && cost.avgCost > 0 && (!f.currency || f.currency === cost.currency)
                ? (f.dividend_rate / cost.avgCost) * 100
                : null;
            return (
              <Tr key={f.ticker}>
                <Td>
                  <div className="font-medium">{f.ticker}</div>
                  {names?.[f.ticker] && (
                    <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {names[f.ticker]}
                    </div>
                  )}
                </Td>
                <Td style={{ color: "var(--text-secondary)" }}>{f.ex_dividend_date ?? "—"}</Td>
                <Td align="right">
                  {f.dividend_rate !== null ? formatMoney(f.dividend_rate, f.currency ?? "") : "—"}
                </Td>
                <Td align="right" style={{ color: "var(--text-secondary)" }}>
                  {f.dividend_yield !== null ? `${f.dividend_yield.toFixed(2)}%` : "—"}
                </Td>
                <Td align="right" style={{ color: "var(--text-secondary)" }}>
                  {effectiveYield !== null ? `${effectiveYield.toFixed(2)}%` : "—"}
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </div>
  );
}
