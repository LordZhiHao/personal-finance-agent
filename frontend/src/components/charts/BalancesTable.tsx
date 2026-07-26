import type { BalancesSummary } from "../../types";
import { formatMoney } from "../../lib/format";
import { Table, Thead, Tbody, Tr, Th, Td } from "../ui/Table";
import { useSortableRows } from "../../lib/sort";

export function BalancesTable({ summary }: { summary: BalancesSummary }) {
  const { sorted, requestSort, directionFor } = useSortableRows(summary.balances, {
    account: (b) => b.account_name,
    type: (b) => b.type,
    balance: (b) => b.balance,
  });

  if (summary.balances.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>No accounts found.</p>;
  }

  return (
    <Table>
      <Thead>
        <Th sortDirection={directionFor("account")} onSort={() => requestSort("account")}>
          Account
        </Th>
        <Th sortDirection={directionFor("type")} onSort={() => requestSort("type")}>
          Type
        </Th>
        <Th align="right" sortDirection={directionFor("balance")} onSort={() => requestSort("balance")}>
          Balance
        </Th>
      </Thead>
      <Tbody>
        {sorted.map((b) => (
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
