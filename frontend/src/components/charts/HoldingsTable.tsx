import type { Holding } from "../../types";
import { formatMoney, formatPct } from "../../lib/format";

const th = "text-left text-xs font-medium py-2 px-3";
const td = "text-sm py-2 px-3 tabular-nums";

export function HoldingsTable({ holdings, currency }: { holdings: Holding[]; currency: string }) {
  if (holdings.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>No holdings found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--gridline)", color: "var(--text-muted)" }}>
            <th className={th}>Ticker</th>
            <th className={th}>Account</th>
            <th className={th}>Quantity</th>
            <th className={th}>Avg Cost</th>
            <th className={th}>Market Value</th>
            <th className={th}>Cost Basis</th>
            <th className={th}>Unrealized Gain</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const noPrice = h.market_value === null;
            const gainColor =
              h.unrealized_gain === null
                ? "var(--text-secondary)"
                : h.unrealized_gain >= 0
                  ? "var(--success-text)"
                  : "var(--status-critical)";
            return (
              <tr key={`${h.account_name}-${h.ticker}`} style={{ borderBottom: "1px solid var(--gridline)" }}>
                <td className={td} style={{ color: "var(--text-primary)" }}>
                  {noPrice && "⚠️ "}
                  {h.ticker}
                </td>
                <td className={td} style={{ color: "var(--text-secondary)" }}>
                  {h.account_name}
                </td>
                <td className={td} style={{ color: "var(--text-primary)" }}>
                  {h.quantity}
                </td>
                <td className={td} style={{ color: "var(--text-primary)" }}>
                  {h.avg_cost.toFixed(2)} {h.cost_currency}
                </td>
                <td className={td} style={{ color: "var(--text-primary)" }}>
                  {noPrice ? "no price available" : formatMoney(h.market_value!, currency)}
                </td>
                <td className={td} style={{ color: "var(--text-primary)" }}>
                  {formatMoney(h.cost_basis, currency)}
                </td>
                <td className={td} style={{ color: gainColor }}>
                  {h.unrealized_gain === null
                    ? "—"
                    : `${formatMoney(h.unrealized_gain, currency)} (${formatPct(h.unrealized_gain_pct ?? 0)})`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
