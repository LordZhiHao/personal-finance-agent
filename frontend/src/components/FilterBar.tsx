import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Account } from "../types";
import { Button, Input, MultiSelect } from "./ui";

export interface FilterValue {
  startDate: string;
  endDate: string;
  accounts: string[]; // [] = all accounts
  months: number[]; // [] = all months, values 0-11
  types?: ("income" | "expense")[]; // [] or undefined = all; field omitted entirely (undefined) hides the Type control
}

interface FilterBarProps {
  accounts: Account[];
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTH_OPTIONS = MONTH_LABELS.map((label, i) => ({ value: String(i), label }));
const TYPE_OPTIONS = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
];

export function FilterBar({ accounts, value, onChange }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<FilterValue>(value);
  const ref = useRef<HTMLDivElement>(null);

  const accountOptions = accounts.map((a) => ({ value: a.name, label: a.name }));
  const showType = value.types !== undefined;

  const activeCount = value.accounts.length + value.months.length + (value.types?.length ?? 0);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleToggle() {
    if (!open) setPending(value);
    setOpen((o) => !o);
  }

  function handleApply() {
    onChange(pending);
    setOpen(false);
  }

  return (
    <div ref={ref}>
      <Button variant="outline" onClick={handleToggle} className="flex items-center gap-2">
        <SlidersHorizontal size={16} />
        Filter
        {activeCount > 0 && (
          <span
            className="flex items-center justify-center text-xs font-semibold rounded-full"
            style={{ width: 18, height: 18, background: "var(--brand)", color: "white" }}
          >
            {activeCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          className="absolute right-0 mt-2 p-4 flex flex-wrap items-end gap-3 z-30 w-[min(92vw,560px)]"
          style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              Start date
            </label>
            <Input
              type="date"
              value={pending.startDate}
              max={pending.endDate}
              onChange={(e) => setPending({ ...pending, startDate: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              End date
            </label>
            <Input
              type="date"
              value={pending.endDate}
              min={pending.startDate}
              onChange={(e) => setPending({ ...pending, endDate: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              Month
            </label>
            <MultiSelect
              options={MONTH_OPTIONS}
              value={pending.months.map(String)}
              onChange={(v) => setPending({ ...pending, months: v.map(Number) })}
              className="w-36"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "var(--text-muted)" }}>
              Account
            </label>
            <MultiSelect
              options={accountOptions}
              value={pending.accounts}
              onChange={(v) => setPending({ ...pending, accounts: v })}
              className="w-40"
            />
          </div>
          {showType && (
            <div className="flex flex-col gap-1">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>
                Type
              </label>
              <MultiSelect
                options={TYPE_OPTIONS}
                value={pending.types ?? []}
                onChange={(v) => setPending({ ...pending, types: v as ("income" | "expense")[] })}
                className="w-36"
              />
            </div>
          )}
          <Button variant="primary" onClick={handleApply}>
            Apply Filter
          </Button>
        </div>
      )}
    </div>
  );
}
