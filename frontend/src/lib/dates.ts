import { format, parseISO, startOfMonth, subMonths, isSameMonth } from "date-fns";
import type { Transaction } from "../types";

export function monthKey(dateStr: string): string {
  return format(parseISO(dateStr), "yyyy-MM");
}

export function monthLabel(monthKeyStr: string): string {
  return format(parseISO(`${monthKeyStr}-01`), "MMM yyyy");
}

export interface MonthlySeriesPoint {
  month: string; // "yyyy-MM", sort key
  label: string; // "MMM yyyy"
  value: number;
}

/** Sums `valueOf(item)` per calendar month, sorted chronologically. */
export function sumByMonth<T>(
  items: T[],
  dateOf: (item: T) => string,
  valueOf: (item: T) => number,
): MonthlySeriesPoint[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    const key = monthKey(dateOf(item));
    totals.set(key, (totals.get(key) ?? 0) + valueOf(item));
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, label: monthLabel(month), value }));
}

/** Sums `valueOf(item)` per (month, groupOf(item)) pair — used for the stacked
 * monthly-spend-by-category bar chart. */
export function sumByMonthAndGroup<T>(
  items: T[],
  dateOf: (item: T) => string,
  groupOf: (item: T) => string,
  valueOf: (item: T) => number,
): { month: string; label: string; [group: string]: number | string }[] {
  const totals = new Map<string, Record<string, number>>();
  for (const item of items) {
    const key = monthKey(dateOf(item));
    const group = groupOf(item);
    const row = totals.get(key) ?? {};
    row[group] = (row[group] ?? 0) + valueOf(item);
    totals.set(key, row);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, groups]) => ({ month, label: monthLabel(month), ...groups }));
}

export interface DailyTotal {
  date: string; // yyyy-MM-dd
  total: number;
}

/** Per-day absolute spend total (expenses only), for the calendar heatmap. */
export function dailySpendTotals(transactions: Transaction[]): DailyTotal[] {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const day = t.date.slice(0, 10);
    totals.set(day, (totals.get(day) ?? 0) + Math.abs(t.amount));
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));
}

export interface MonthComparisonRow {
  category: string;
  current: number;
  previous: number;
  yearAgo: number;
}

/** Current month vs previous month vs the same month last year, spend by category —
 * answers "am I spending more than usual" per category at a glance. */
export function monthComparison(transactions: Transaction[], referenceDate = new Date()): MonthComparisonRow[] {
  const current = startOfMonth(referenceDate);
  const previous = subMonths(current, 1);
  const yearAgo = subMonths(current, 12);

  const totals = new Map<string, { current: number; previous: number; yearAgo: number }>();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const d = parseISO(t.date);
    let bucket: "current" | "previous" | "yearAgo" | null = null;
    if (isSameMonth(d, current)) bucket = "current";
    else if (isSameMonth(d, previous)) bucket = "previous";
    else if (isSameMonth(d, yearAgo)) bucket = "yearAgo";
    if (!bucket) continue;

    const cat = t.category || "Other";
    const row = totals.get(cat) ?? { current: 0, previous: 0, yearAgo: 0 };
    row[bucket] += Math.abs(t.amount);
    totals.set(cat, row);
  }

  return [...totals.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.current - a.current);
}
