import type { Account } from "../types";
import { Input, Select } from "./ui";

export interface FilterValue {
  startDate: string;
  endDate: string;
  account: string; // account name, or "All"
  currency?: string;
}

interface FilterBarProps {
  accounts: Account[];
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  currencies?: string[];
}

export function FilterBar({ accounts, value, onChange, currencies }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs" style={{ color: "var(--text-muted)" }}>
          Start date
        </label>
        <Input
          type="date"
          value={value.startDate}
          max={value.endDate}
          onChange={(e) => onChange({ ...value, startDate: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs" style={{ color: "var(--text-muted)" }}>
          End date
        </label>
        <Input
          type="date"
          value={value.endDate}
          min={value.startDate}
          onChange={(e) => onChange({ ...value, endDate: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs" style={{ color: "var(--text-muted)" }}>
          Account
        </label>
        <Select value={value.account} onChange={(e) => onChange({ ...value, account: e.target.value })}>
          <option value="All">All</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.name}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
      {currencies && value.currency !== undefined && (
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--text-muted)" }}>
            Display currency
          </label>
          <Select value={value.currency} onChange={(e) => onChange({ ...value, currency: e.target.value })}>
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
