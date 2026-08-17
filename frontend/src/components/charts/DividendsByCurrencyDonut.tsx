import { useMemo, useState } from "react";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { PortfolioEvent } from "../../types";
import { colorForKey } from "../../lib/palette";
import { formatMoney } from "../../lib/format";
import { legendStyle, tooltipStyle } from "./chartTheme";
import { Overlay, Table, Thead, Tbody, Tr, Th, Td, Select, TabToggle } from "../ui";

function currencyTotals(events: PortfolioEvent[]) {
  const totals = new Map<string, number>();
  for (const e of events) {
    totals.set(e.currency, (totals.get(e.currency) ?? 0) + e.quantity * e.price);
  }
  return [...totals.entries()].map(([name, value]) => ({ name, value }));
}

type ViewMode = "year" | "month";

export function DividendsByCurrencyDonut({
  events,
  fill = false,
}: {
  events: PortfolioEvent[];
  fill?: boolean;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("year");
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);

  // Stable, alphabetically-sorted currency order across all history (not just the
  // filtered period) so a currency keeps the same color as the user switches
  // year/month — same rationale as categoryColors passed into SpendByCategoryDonut.
  const knownCurrencies = useMemo(
    () => [...new Set(events.map((e) => e.currency))].sort(),
    [events],
  );

  const years = useMemo(() => {
    const ys = [...new Set(events.map((e) => parseISO(e.date).getFullYear()))].sort((a, b) => b - a);
    return ys.length > 0 ? ys : [new Date().getFullYear()];
  }, [events]);

  const periodEvents = useMemo(() => {
    if (viewMode === "year") {
      return events.filter((e) => parseISO(e.date).getFullYear() === selectedYear);
    }
    const monthStr = format(selectedMonth, "yyyy-MM");
    return events.filter((e) => e.date.startsWith(monthStr));
  }, [events, viewMode, selectedYear, selectedMonth]);

  const data = useMemo(() => currencyTotals(periodEvents), [periodEvents]);

  const selectedTotal = selectedCurrency ? (data.find((d) => d.name === selectedCurrency)?.value ?? 0) : 0;
  const selectedEvents = selectedCurrency
    ? periodEvents.filter((e) => e.currency === selectedCurrency).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const periodLabel = viewMode === "year" ? String(selectedYear) : format(selectedMonth, "MMMM yyyy");

  return (
    <div className={fill ? "flex-1 min-h-0 flex flex-col" : undefined}>
      <div className="flex flex-wrap items-center justify-center gap-3 mb-2">
        <TabToggle
          options={[
            { value: "year", label: "Year" },
            { value: "month", label: "Month" },
          ]}
          value={viewMode}
          onChange={setViewMode}
        />
        {viewMode === "year" ? (
          <Select
            value={String(selectedYear)}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-24"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        ) : (
          <div className="flex items-center gap-1 text-sm">
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => subMonths(m, 1))}
              className="px-2 py-1"
              style={{ color: "var(--text-secondary)" }}
            >
              ‹
            </button>
            <span style={{ color: "var(--text-primary)", minWidth: 110, textAlign: "center" }}>
              {format(selectedMonth, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
              className="px-2 py-1"
              style={{ color: "var(--text-secondary)" }}
            >
              ›
            </button>
          </div>
        )}
      </div>

      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--text-secondary)" }}>
          No dividends in {periodLabel}.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={fill ? "100%" : 280} minHeight={fill ? 280 : undefined}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={1}
              onClick={(entry) => setSelectedCurrency(entry.name as string)}
            >
              {data.map((d) => (
                <Cell
                  key={d.name}
                  fill={colorForKey(d.name, knownCurrencies)}
                  stroke="var(--surface-1)"
                  strokeWidth={2}
                  style={{ cursor: "pointer" }}
                />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={legendStyle} />
          </PieChart>
        </ResponsiveContainer>
      )}

      {selectedCurrency && (
        <Overlay onClose={() => setSelectedCurrency(null)}>
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
            {selectedCurrency} Dividends — {periodLabel}
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            Total received: {formatMoney(selectedTotal, selectedCurrency)}
          </p>
          <Table>
            <Thead>
              <Th>Ticker</Th>
              <Th>Date</Th>
              <Th align="right">Amount</Th>
            </Thead>
            <Tbody>
              {selectedEvents.map((e) => (
                <Tr key={e.id}>
                  <Td>{e.ticker}</Td>
                  <Td>{format(parseISO(e.date), "d MMM yyyy")}</Td>
                  <Td align="right">{formatMoney(e.quantity * e.price, e.currency)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Overlay>
      )}
    </div>
  );
}
