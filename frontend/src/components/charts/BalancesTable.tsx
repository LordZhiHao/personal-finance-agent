import type { BalancesSummary } from "../../types";
import { formatMoney } from "../../lib/format";
import { Table, Thead, Tbody, Tr, Th, Td } from "../ui/Table";

export function BalancesTable({ summary }: { summary: BalancesSummary }) {
  if (summary.balances.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>No accounts found.</p>;
  }

  return (
    <Table>
      <Thead>
        <Th>Account</Th>
        <Th>Type</Th>
        <Th align="right">Balance</Th>
      </Thead>
      <Tbody>
        {summary.balances.map((b) => (
          <Tr key={b.account_id}>
            <Td className="font-medium">{b.account_name}</Td>
            <Td style={{ color: "var(--text-secondary)" }}>{b.type}</Td>
            <Td align="right">{b.balance === null ? "no snapshot yet" : formatMoney(b.balance, summary.currency)}</Td>
          </Tr>
        ))}
        <Tr>
          <Td className="font-semibold">Total</Td>
          <Td></Td>
          <Td align="right" className="font-semibold">
            {formatMoney(summary.total, summary.currency)}
          </Td>
        </Tr>
      </Tbody>
    </Table>
  );
}
