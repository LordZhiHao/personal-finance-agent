import type { Account } from "../types";

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

const fieldStyle = {
  border: "1px solid var(--baseline)",
  color: "var(--text-primary)",
  background: "var(--surface-1)",
};

export function FilterBar({ accounts, value, onChange, currencies }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs" style={{ color: "var(--text-muted)" }}>
          Start date
        </label>
        <input
          type="date"
          value={value.startDate}
          max={value.endDate}
          onChange={(e) => onChange({ ...value, startDate: e.target.value })}
          className="rounded px-2 py-1.5 text-sm outline-none"
          style={fieldStyle}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs" style={{ color: "var(--text-muted)" }}>
          End date
        </label>
        <input
          type="date"
          value={value.endDate}
          min={value.startDate}
          onChange={(e) => onChange({ ...value, endDate: e.target.value })}
          className="rounded px-2 py-1.5 text-sm outline-none"
          style={fieldStyle}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs" style={{ color: "var(--text-muted)" }}>
          Account
        </label>
        <select
          value={value.account}
          onChange={(e) => onChange({ ...value, account: e.target.value })}
          className="rounded px-2 py-1.5 text-sm outline-none"
          style={fieldStyle}
        >
          <option value="All">All</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      {currencies && value.currency !== undefined && (
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--text-muted)" }}>
            Display currency
          </label>
          <select
            value={value.currency}
            onChange={(e) => onChange({ ...value, currency: e.target.value })}
            className="rounded px-2 py-1.5 text-sm outline-none"
            style={fieldStyle}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
