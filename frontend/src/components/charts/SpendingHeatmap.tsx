import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { useMeta, useTransactions } from "../../hooks/api";
import { dailySpendTotals, type DailyTotal } from "../../lib/dates";
import { SEQUENTIAL } from "../../lib/palette";
import { formatCompact, formatMoney } from "../../lib/format";
import { Overlay, Table, Thead, Tbody, Tr, Th, Td } from "../ui";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const EMPTY_CELL = "var(--gridline)";
const DARK_TEXT = "var(--text-primary)";
const LIGHT_TEXT = "#fff";

/** Rank-based (quantile) bucketing over the displayed month's non-zero days,
 * spread across all 5 sequential steps — a single outlier day (rent, a big
 * statement payment) otherwise collapses every other day into one raw-ratio
 * bucket, making the whole month read as one flat color. */
function buildLevelMap(daily: DailyTotal[]): Map<string, number> {
  const nonZero = [...daily.filter((d) => d.total > 0)].sort((a, b) => a.total - b.total);
  const levels = new Map<string, number>();
  nonZero.forEach((d, i) => {
    levels.set(d.date, Math.min(5, Math.ceil(((i + 1) / nonZero.length) * 5)));
  });
  return levels;
}

function levelColor(level: number | undefined): string {
  return level ? SEQUENTIAL[level - 1] : EMPTY_CELL;
}

function textColor(level: number | undefined): string {
  return level && level >= 4 ? LIGHT_TEXT : DARK_TEXT;
}

export function SpendingHeatmap({
  accounts,
  currency,
  fill = false,
}: {
  accounts?: string[];
  currency: string;
  fill?: boolean;
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<{ date: string; total: number } | null>(null);

  const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");
  const txQuery = useTransactions(monthStart, monthEnd);
  const metaQuery = useMeta();
  const classifications = metaQuery.data?.category_classifications ?? {};

  const monthTransactions = useMemo(() => {
    const txns = txQuery.data ?? [];
    const spendOnly = txns.filter((t) => (classifications[t.category || "Other"] ?? "expense") === "expense");
    if (!accounts || accounts.length === 0) return spendOnly;
    return spendOnly.filter((t) => accounts.includes(t.accounts?.name ?? ""));
  }, [txQuery.data, accounts, classifications]);

  const daily = useMemo(() => dailySpendTotals(monthTransactions), [monthTransactions]);
  const totalsByDate = useMemo(() => new Map(daily.map((d) => [d.date, d.total])), [daily]);
  const levelByDate = useMemo(() => buildLevelMap(daily), [daily]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const selectedTransactions = selected
    ? monthTransactions
        .filter((t) => t.amount < 0 && t.date.slice(0, 10) === selected.date)
        .sort((a, b) => a.amount - b.amount)
    : [];

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
          const iso = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, month);
          const total = totalsByDate.get(iso) ?? 0;
          const level = inMonth ? levelByDate.get(iso) : undefined;
          const clickable = inMonth && total > 0;
          return (
            <div key={iso} className="flex items-center justify-center py-0.5">
              <div
                title={inMonth ? `${iso}: ${formatMoney(total, currency)}` : undefined}
                onClick={() => clickable && setSelected({ date: iso, total })}
                className="flex flex-col items-center justify-center leading-none"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: inMonth ? levelColor(level) : "transparent",
                  color: inMonth ? textColor(level) : "var(--text-muted)",
                  fontSize: 12,
                  cursor: clickable ? "pointer" : "default",
                }}
              >
                <span>{format(day, "d")}</span>
                {inMonth && total > 0 && (
                  <span style={{ fontSize: 9, opacity: 0.85, marginTop: 2 }}>{formatCompact(total)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
        <span>Less</span>
        {[EMPTY_CELL, ...SEQUENTIAL].map((c, i) => (
          <div key={i} style={{ width: 20, height: 20, borderRadius: 5, background: c }} />
        ))}
        <span>More</span>
      </div>

      {!txQuery.isLoading && daily.length === 0 && (
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
          No spending in {format(month, "MMMM yyyy")}.
        </p>
      )}

      {selected && (
        <Overlay onClose={() => setSelected(null)}>
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
            {format(parseISO(selected.date), "d MMMM yyyy")}
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            Total spent: {formatMoney(selected.total, currency)}
          </p>
          <Table>
            <Thead>
              <Th>Description</Th>
              <Th>Category</Th>
              <Th align="right">Amount</Th>
            </Thead>
            <Tbody>
              {selectedTransactions.map((t) => (
                <Tr key={t.id}>
                  <Td>{t.description}</Td>
                  <Td>{t.category}</Td>
                  <Td align="right">{formatMoney(Math.abs(t.amount), t.currency)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Overlay>
      )}
    </div>
  );
}
