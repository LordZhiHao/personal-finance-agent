import { useState } from "react";
import type { Account } from "../types";
import { Button, Input, Select } from "./ui";

export interface FilterValue {
  startDate: string;
  endDate: string;
  account: string; // account name, or "All"
  type?: "all" | "income" | "expense";
}

interface FilterBarProps {
  accounts: Account[];
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}

export function FilterBar({ accounts, value, onChange }: FilterBarProps) {
  const [pending, setPending] = useState<FilterValue>(value);

  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
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
          Account
        </label>
        <Select value={pending.account} onChange={(e) => setPending({ ...pending, account: e.target.value })}>
          <option value="All">All</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.name}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
      {pending.type !== undefined && (
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--text-muted)" }}>
            Type
          </label>
          <Select
            value={pending.type}
            onChange={(e) => setPending({ ...pending, type: e.target.value as FilterValue["type"] })}
          >
            <option value="all">All</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </Select>
        </div>
      )}
      <Button variant="primary" onClick={() => onChange(pending)}>
        Filter
      </Button>
    </div>
  );
}
