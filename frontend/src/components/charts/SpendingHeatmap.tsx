import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import type { DailyTotal } from "../../lib/dates";
import { SEQUENTIAL_BLUE } from "../../lib/palette";
import { formatMoney } from "../../lib/format";

const EMPTY_CELL = "var(--gridline)";
const CELL_SIZE = 12;
const CELL_GAP = 3;

function levelColor(total: number, max: number): string {
  if (total <= 0) return EMPTY_CELL;
  if (max <= 0) return EMPTY_CELL;
  const ratio = total / max;
  if (ratio <= 0.25) return SEQUENTIAL_BLUE[1];
  if (ratio <= 0.5) return SEQUENTIAL_BLUE[2];
  if (ratio <= 0.75) return SEQUENTIAL_BLUE[3];
  return SEQUENTIAL_BLUE[4];
}

export function SpendingHeatmap({ daily, currency }: { daily: DailyTotal[]; currency: string }) {
  if (daily.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>No spending in this period.</p>;
  }

  const totalsByDate = new Map(daily.map((d) => [d.date, d.total]));
  const lastDate = parseISO(daily[daily.length - 1].date);
  const firstDate = startOfWeek(parseISO(daily[0].date));
  const numDays = differenceInCalendarDays(lastDate, firstDate) + 1;
  const numWeeks = Math.ceil(numDays / 7);
  const max = Math.max(...daily.map((d) => d.total));

  const weeks: { date: string; total: number }[][] = Array.from({ length: numWeeks }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const d = addDays(firstDate, week * 7 + day);
      const iso = format(d, "yyyy-MM-dd");
      return { date: iso, total: totalsByDate.get(iso) ?? 0 };
    }),
  );

  return (
    <div className="overflow-x-auto">
      <div style={{ display: "grid", gridAutoFlow: "column", gap: CELL_GAP }}>
        {weeks.map((week, i) => (
          <div key={i} style={{ display: "grid", gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`, gap: CELL_GAP }}>
            {week.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${formatMoney(day.total, currency)}`}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  borderRadius: 3,
                  background: levelColor(day.total, max),
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
        <span>Less</span>
        {[EMPTY_CELL, SEQUENTIAL_BLUE[1], SEQUENTIAL_BLUE[2], SEQUENTIAL_BLUE[3], SEQUENTIAL_BLUE[4]].map(
          (c, i) => (
            <div key={i} style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3, background: c }} />
          ),
        )}
        <span>More</span>
      </div>
    </div>
  );
}
