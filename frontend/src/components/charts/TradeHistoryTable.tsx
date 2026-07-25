import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PortfolioEvent } from "../../types";
import { api } from "../../api/client";
import { Table, Thead, Tbody, Tr, Th, Td } from "../ui/Table";
import { Badge } from "../ui/Badge";
import { Button } from "../ui";

const ACTION_TINT = { BUY: "green", SELL: "red", DIVIDEND: "amber" } as const;

export function TradeHistoryTable({
  events,
  refetchKey,
}: {
  events: PortfolioEvent[];
  refetchKey: unknown[];
}) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/portfolio-events/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: refetchKey }),
  });

  function handleDelete(e: PortfolioEvent) {
    if (window.confirm(`Delete ${e.action} ${e.quantity} ${e.ticker} on ${e.date}?`)) {
      deleteMutation.mutate(e.id);
    }
  }

  if (events.length === 0) {
    return <p style={{ color: "var(--text-secondary)" }}>No trades found for this period.</p>;
  }

  return (
    <div className="max-h-[400px] overflow-y-auto">
      <Table>
        <Thead>
          <Th>Date</Th>
          <Th>Ticker</Th>
          <Th>Action</Th>
          <Th align="right">Quantity</Th>
          <Th align="right">Price</Th>
          <Th>Currency</Th>
          <Th align="right">Fees</Th>
          <Th>Notes</Th>
          <Th>Account</Th>
          <Th />
        </Thead>
        <Tbody>
          {events.map((e) => (
            <Tr key={e.id}>
              <Td style={{ color: "var(--text-secondary)" }}>{e.date}</Td>
              <Td className="font-medium">{e.ticker}</Td>
              <Td>
                <Badge tint={ACTION_TINT[e.action]}>{e.action}</Badge>
              </Td>
              <Td align="right">{e.quantity}</Td>
              <Td align="right">{e.price}</Td>
              <Td style={{ color: "var(--text-secondary)" }}>{e.currency}</Td>
              <Td align="right" style={{ color: "var(--text-secondary)" }}>
                {e.fees ?? "—"}
              </Td>
              <Td style={{ color: "var(--text-secondary)" }}>{e.notes ?? ""}</Td>
              <Td style={{ color: "var(--text-secondary)" }}>{e.accounts?.name ?? "Unknown"}</Td>
              <Td align="right">
                <Button
                  variant="ghost"
                  className="text-xs px-2 py-1"
                  style={{ color: "var(--tint-red-text)" }}
                  onClick={() => handleDelete(e)}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
