import { useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";
type Accessor<T> = (row: T) => string | number | null | undefined;

function compareValues(a: string | number | null | undefined, b: string | number | null | undefined): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export function useSortableRows<T>(
  rows: T[],
  accessors: Record<string, Accessor<T>>,
  initial?: { key: string; direction: SortDirection },
) {
  const [sortKey, setSortKey] = useState<string | null>(initial?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDirection>(initial?.direction ?? "asc");

  function requestSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey || !accessors[sortKey]) return rows;
    const accessor = accessors[sortKey];
    const factor = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => factor * compareValues(accessor(a), accessor(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortKey, sortDir]);

  function directionFor(key: string): SortDirection | null {
    return sortKey === key ? sortDir : null;
  }

  return { sorted, sortKey, sortDir, requestSort, directionFor };
}
