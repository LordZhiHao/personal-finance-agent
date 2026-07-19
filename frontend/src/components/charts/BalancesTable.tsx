import type { BalancesSummary } from "../../types";
import { formatMoney } from "../../lib/format";

const th = "text-left text-xs font-medium py-2 px-3";
const td = "text-sm py-2 px-3 tabular-nums";

export function BalancesTable({ summary }: { summary: BalancesSummary }) {
  if (summary.balances.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>No accounts found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--gridline)", color: "var(--text-muted)" }}>
            <th className={th}>Account</th>
            <th className={th}>Type</th>
            <th className={th}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {summary.balances.map((b) => (
            <tr key={b.account_id} style={{ borderBottom: "1px solid var(--gridline)" }}>
              <td className={td} style={{ color: "var(--text-primary)" }}>
                {b.account_name}
              </td>
              <td className={td} style={{ color: "var(--text-secondary)" }}>
                {b.type}
              </td>
              <td className={td} style={{ color: "var(--text-primary)" }}>
                {b.balance === null ? "no snapshot yet" : formatMoney(b.balance, summary.currency)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className={td} style={{ color: "var(--text-primary)", fontWeight: 500 }}>
              Total
            </td>
            <td className={td}></td>
            <td className={td} style={{ color: "var(--text-primary)", fontWeight: 500 }}>
              {formatMoney(summary.total, summary.currency)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
