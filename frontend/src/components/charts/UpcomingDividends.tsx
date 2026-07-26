import type { DividendForecast } from "../../types";
import { Table, Thead, Tbody, Tr, Th, Td } from "../ui/Table";
import { formatMoney } from "../../lib/format";

export function UpcomingDividends({ forecast }: { forecast: DividendForecast[] }) {
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
          <Th align="right">Yield</Th>
        </Thead>
        <Tbody>
          {forecast.map((f) => (
            <Tr key={f.ticker}>
              <Td className="font-medium">{f.ticker}</Td>
              <Td style={{ color: "var(--text-secondary)" }}>{f.ex_dividend_date ?? "—"}</Td>
              <Td align="right">
                {f.dividend_rate !== null ? formatMoney(f.dividend_rate, f.currency ?? "") : "—"}
              </Td>
              <Td align="right" style={{ color: "var(--text-secondary)" }}>
                {f.dividend_yield !== null ? `${(f.dividend_yield * 100).toFixed(2)}%` : "—"}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
