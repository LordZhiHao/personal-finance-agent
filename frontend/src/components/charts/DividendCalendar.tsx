import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import type { PortfolioEvent } from "../../types";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function DividendCalendar({ events, fill = false }: { events: PortfolioEvent[]; fill?: boolean }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const dividendDates = useMemo(
    () => new Set(events.filter((e) => e.action === "DIVIDEND").map((e) => e.date)),
    [events],
  );

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  return (
    <div className={fill ? "flex-1 min-h-0 flex flex-col justify-center" : undefined}>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="px-2 py-1 text-sm rounded"
          style={{ color: "var(--text-secondary)" }}
        >
          ‹
        </button>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {format(month, "MMMM yyyy")}
        </span>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="px-2 py-1 text-sm rounded"
          style={{ color: "var(--text-secondary)" }}
        >
          ›
        </button>
      </div>
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
          const hasDividend = dividendDates.has(key);
          return (
            <div key={key} className="flex flex-col items-center py-1 gap-0.5">
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
            </div>
          );
        })}
      </div>
      {dividendDates.size === 0 && (
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          No dividend events logged yet.
        </p>
      )}
    </div>
  );
}
