import { useMemo, useState } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { PortfolioEvent } from "../../types";
import { formatMoney } from "../../lib/format";
import { MonthStepper } from "../MonthStepper";
import { TransactionDrillDownOverlay } from "../TransactionDrillDownOverlay";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function DividendCalendar({ events, fill = false }: { events: PortfolioEvent[]; fill?: boolean }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const dividendsByDate = useMemo(() => {
    const map = new Map<string, PortfolioEvent[]>();
    for (const e of events) {
      if (e.action !== "DIVIDEND") continue;
      const existing = map.get(e.date);
      if (existing) existing.push(e);
      else map.set(e.date, [e]);
    }
    return map;
  }, [events]);

  const selectedEvents = selectedDate ? (dividendsByDate.get(selectedDate) ?? []) : [];

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  return (
    <div className={fill ? "flex-1 min-h-0 flex flex-col justify-center" : undefined}>
      <MonthStepper value={month} onChange={(d) => setMonth(d ?? new Date())} className="mb-3" />
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-xs font-medium py-1" style={{ color: "var(--text-muted)" }}>
            {w}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          const hasDividend = dividendsByDate.has(key);
          return (
            <button
              key={key}
              type="button"
              disabled={!hasDividend}
              onClick={hasDividend ? () => setSelectedDate(key) : undefined}
              className="flex flex-col items-center py-1 gap-0.5 bg-transparent border-0"
              style={{ cursor: hasDividend ? "pointer" : "default", font: "inherit" }}
            >
              <div
                className="flex items-center justify-center text-xs rounded-full"
                style={{
                  width: 26,
                  height: 26,
                  background: today ? "var(--brand)" : "transparent",
                  color: today ? "#fff" : inMonth ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                {format(day, "d")}
              </div>
              <div
                className="rounded-full"
                style={{
                  width: 5,
                  height: 5,
                  background: hasDividend ? "var(--tint-amber-text)" : "transparent",
                }}
              />
            </button>
          );
        })}
      </div>
      {dividendsByDate.size === 0 && (
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          No dividend events logged yet.
        </p>
      )}
      {selectedDate && (
        <TransactionDrillDownOverlay
          title={`Dividends — ${format(parseISO(selectedDate), "d MMM yyyy")}`}
          rows={selectedEvents}
          onClose={() => setSelectedDate(null)}
          columns={[
            { header: "Ticker", render: (e) => e.ticker },
            { header: "Quantity", align: "right", render: (e) => e.quantity },
            { header: "Price", align: "right", render: (e) => formatMoney(e.price, e.currency) },
            { header: "Amount", align: "right", render: (e) => formatMoney(e.quantity * e.price, e.currency) },
          ]}
        />
      )}
    </div>
  );
}
