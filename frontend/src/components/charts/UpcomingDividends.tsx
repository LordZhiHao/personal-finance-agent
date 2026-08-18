import type { DividendForecast } from "../../types";
import { Table, Thead, Tbody, Tr, Th, Td } from "../ui/Table";
import { formatMoney } from "../../lib/format";
import { useSortableRows } from "../../lib/sort";

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
  function effectiveYieldFor(f: DividendForecast): number | null {
    const cost = costBasis?.[f.ticker];
    return f.dividend_rate !== null && cost && cost.avgCost > 0 && (!f.currency || f.currency === cost.currency)
      ? (f.dividend_rate / cost.avgCost) * 100
      : null;
  }

  const { sorted, requestSort, directionFor } = useSortableRows(forecast, {
    ticker: (f) => f.ticker,
    ex_dividend_date: (f) => f.ex_dividend_date,
    last_dividend_amount: (f) => f.last_dividend_amount,
    dividend_rate: (f) => f.dividend_rate,
    dividend_yield: (f) => f.dividend_yield,
    effective_yield: (f) => effectiveYieldFor(f),
  });

  if (forecast.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>No held tickers yet.</p>;
  }

  return (
    <div className="max-h-[400px] overflow-y-auto">
      <Table>
        <Thead>
          <Th sticky className="min-w-[110px]" sortDirection={directionFor("ticker")} onSort={() => requestSort("ticker")}>
            Ticker
          </Th>
          <Th sortDirection={directionFor("ex_dividend_date")} onSort={() => requestSort("ex_dividend_date")}>
            Next Ex-Dividend
          </Th>
          <Th
            align="right"
            sortDirection={directionFor("last_dividend_amount")}
            onSort={() => requestSort("last_dividend_amount")}
          >
            Last Payment
          </Th>
          <Th align="right" sortDirection={directionFor("dividend_rate")} onSort={() => requestSort("dividend_rate")}>
            Annual Rate (TTM)
          </Th>
          <Th align="right" sortDirection={directionFor("dividend_yield")} onSort={() => requestSort("dividend_yield")}>
            Dividend Yield
          </Th>
          <Th
            align="right"
            sortDirection={directionFor("effective_yield")}
            onSort={() => requestSort("effective_yield")}
          >
            Effective Yield
          </Th>
        </Thead>
        <Tbody>
          {sorted.map((f) => {
            const effectiveYield = effectiveYieldFor(f);
            return (
              <Tr key={f.ticker}>
                <Td sticky className="min-w-[110px]">
                  <div className="font-medium">{f.ticker}</div>
                  {names?.[f.ticker] && (
                    <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {names[f.ticker]}
                    </div>
                  )}
                </Td>
                <Td style={{ color: "var(--text-secondary)" }}>{f.ex_dividend_date ?? "—"}</Td>
                <Td align="right">
                  {f.last_dividend_amount !== null ? formatMoney(f.last_dividend_amount, f.currency ?? "") : "—"}
                  {f.last_dividend_date && (
                    <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {f.last_dividend_date}
                    </div>
                  )}
                </Td>
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
