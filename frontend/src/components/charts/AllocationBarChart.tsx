import { colorForKey } from "../../lib/palette";
import { formatMoney } from "../../lib/format";

export interface AllocationSlice {
  name: string;
  subtitle?: string;
  value: number;
}

export function AllocationBarChart({ data, currency }: { data: AllocationSlice[]; currency: string }) {
  const names = data.map((d) => d.name);
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const sorted = [...data].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-3">
      {sorted.map((d) => {
        const pct = (d.value / total) * 100;
        const color = colorForKey(d.name, names);
        return (
          <div key={d.name}>
            <div className="flex items-end justify-between text-sm mb-1">
              <div>
                <div style={{ color: "var(--text-primary)" }}>{d.name}</div>
                {d.subtitle && (
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {d.subtitle}
                  </div>
                )}
              </div>
              <span className="tabular-nums shrink-0" style={{ color: "var(--text-secondary)" }}>
                {formatMoney(d.value, currency)} · {pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--field-bg)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
