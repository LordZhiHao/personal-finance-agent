import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Account, Meta, PortfolioEvent } from "../../types";
import { api } from "../../api/client";
import { Table, Thead, Tbody, Tr, Th, Td } from "../ui/Table";
import { Button, IconBadge, Input, Select } from "../ui";
import { useSortableRows } from "../../lib/sort";
import { formatMoney } from "../../lib/format";
import { EditTradeDialog } from "../EditTradeDialog";

interface EditState {
  date: string;
  ticker: string;
  action: string;
  quantity: string;
  price: string;
  currency: string;
  fees: string;
  notes: string;
  account_id: string;
}

function toEditState(e: PortfolioEvent): EditState {
  return {
    date: e.date,
    ticker: e.ticker,
    action: e.action,
    quantity: String(e.quantity),
    price: String(e.price),
    currency: e.currency,
    fees: e.fees === null ? "" : String(e.fees),
    notes: e.notes ?? "",
    account_id: e.account_id,
  };
}

export function TradeHistoryTable({
  events,
  refetchKey,
  meta,
  accounts,
}: {
  events: PortfolioEvent[];
  refetchKey: unknown[];
  meta: Meta;
  accounts: Account[];
}) {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingTrade, setEditingTrade] = useState<PortfolioEvent | null>(null);

  const { sorted, requestSort, directionFor } = useSortableRows(
    events,
    {
      date: (e) => e.date,
      ticker: (e) => e.ticker,
      action: (e) => e.action,
      quantity: (e) => e.quantity,
      price: (e) => e.price,
      currency: (e) => e.currency,
      fees: (e) => e.fees,
      account: (e) => e.accounts?.name ?? null,
    },
    { key: "date", direction: "desc" },
  );

  function fieldFor(e: PortfolioEvent): EditState {
    return edits[e.id] ?? toEditState(e);
  }

  function updateField(e: PortfolioEvent, patch: Partial<EditState>) {
    setEdits((prev) => ({ ...prev, [e.id]: { ...fieldFor(e), ...patch } }));
  }

  function diffFields(e: PortfolioEvent, edit: EditState): Record<string, unknown> {
    const original = toEditState(e);
    const fields: Record<string, unknown> = {};
    if (edit.date !== original.date) fields.date = edit.date;
    if (edit.ticker !== original.ticker) fields.ticker = edit.ticker;
    if (edit.action !== original.action) fields.action = edit.action;
    if (edit.quantity !== original.quantity) fields.quantity = Number(edit.quantity);
    if (edit.price !== original.price) fields.price = Number(edit.price);
    if (edit.currency !== original.currency) fields.currency = edit.currency;
    if (edit.fees !== original.fees) fields.fees = edit.fees === "" ? null : Number(edit.fees);
    if (edit.notes !== original.notes) fields.notes = edit.notes.trim() === "" ? null : edit.notes;
    if (edit.account_id !== original.account_id) fields.account_id = edit.account_id;
    return fields;
  }

  const changedCount = Object.entries(edits).filter(([id, edit]) => {
    const original = sorted.find((e) => e.id === id);
    return original && Object.keys(diffFields(original, edit)).length > 0;
  }).length;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const changedIds = Object.keys(edits);
      await Promise.all(
        changedIds.map((id) => {
          const original = sorted.find((e) => e.id === id)!;
          const fields = diffFields(original, edits[id]);
          if (Object.keys(fields).length === 0) return Promise.resolve();
          return api.patch(`/api/portfolio-events/${id}`, fields);
        }),
      );
    },
    onSuccess: () => {
      setEdits({});
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: refetchKey });
    },
    onError: (err) => setSaveError(err instanceof Error ? err.message : "Failed to save changes."),
  });

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
    <div>
      <div className="hidden md:block max-h-[400px] overflow-y-auto">
        <Table>
          <Thead>
            <Th sortDirection={directionFor("date")} onSort={() => requestSort("date")}>
              Date
            </Th>
            <Th sticky className="min-w-[110px]" sortDirection={directionFor("ticker")} onSort={() => requestSort("ticker")}>
              Ticker
            </Th>
            <Th sortDirection={directionFor("action")} onSort={() => requestSort("action")}>
              Action
            </Th>
            <Th align="right" sortDirection={directionFor("quantity")} onSort={() => requestSort("quantity")}>
              Quantity
            </Th>
            <Th align="right" sortDirection={directionFor("price")} onSort={() => requestSort("price")}>
              Price
            </Th>
            <Th sortDirection={directionFor("currency")} onSort={() => requestSort("currency")}>
              Currency
            </Th>
            <Th align="right" sortDirection={directionFor("fees")} onSort={() => requestSort("fees")}>
              Fees
            </Th>
            <Th>Notes</Th>
            <Th sortDirection={directionFor("account")} onSort={() => requestSort("account")}>
              Account
            </Th>
            <Th />
          </Thead>
          <Tbody>
            {sorted.map((e) => {
              const edit = fieldFor(e);
              return (
                <Tr key={e.id}>
                  <Td>
                    <Input
                      type="date"
                      value={edit.date}
                      onChange={(ev) => updateField(e, { date: ev.target.value })}
                      className="w-full"
                    />
                  </Td>
                  <Td sticky className="min-w-[110px]">
                    <Input
                      value={edit.ticker}
                      onChange={(ev) => updateField(e, { ticker: ev.target.value })}
                      className="w-24"
                    />
                  </Td>
                  <Td>
                    <Select
                      value={edit.action}
                      onChange={(ev) => updateField(e, { action: ev.target.value })}
                    >
                      {meta.portfolio_actions.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td align="right">
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={edit.quantity}
                      onChange={(ev) => updateField(e, { quantity: ev.target.value })}
                      className="w-24 text-right"
                    />
                  </Td>
                  <Td align="right">
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={edit.price}
                      onChange={(ev) => updateField(e, { price: ev.target.value })}
                      className="w-24 text-right"
                    />
                  </Td>
                  <Td>
                    <Select
                      value={edit.currency}
                      onChange={(ev) => updateField(e, { currency: ev.target.value })}
                    >
                      {meta.currencies.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td align="right">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={edit.fees}
                      onChange={(ev) => updateField(e, { fees: ev.target.value })}
                      className="w-20 text-right"
                    />
                  </Td>
                  <Td>
                    <Input
                      value={edit.notes}
                      onChange={(ev) => updateField(e, { notes: ev.target.value })}
                      className="w-full"
                    />
                  </Td>
                  <Td>
                    <Select
                      value={edit.account_id}
                      onChange={(ev) => updateField(e, { account_id: ev.target.value })}
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  </Td>
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
              );
            })}
          </Tbody>
        </Table>
      </div>

      <div className="md:hidden max-h-[400px] overflow-y-auto space-y-1">
        {sorted.map((e) => {
          const tint = e.action === "SELL" ? "red" : e.action === "BUY" ? "green" : "neutral";
          return (
            <div
              key={e.id}
              role="button"
              tabIndex={0}
              onClick={() => setEditingTrade(e)}
              onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && setEditingTrade(e)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-black/[0.02] text-left transition-colors cursor-pointer"
            >
              <IconBadge icon={<span className="text-xs font-semibold">{e.action[0]}</span>} tint={tint} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {e.ticker} · {e.action}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {e.date} · {e.accounts?.name ?? "—"} · Qty {e.quantity}
                </p>
              </div>
              <span className="text-sm font-semibold shrink-0">{formatMoney(e.price * e.quantity, e.currency)}</span>
            </div>
          );
        })}
      </div>

      {saveError && (
        <p className="text-sm mt-2" style={{ color: "var(--tint-red-text)" }}>
          {saveError}
        </p>
      )}
      {changedCount > 0 && (
        <Button
          variant="primary"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="mt-3"
        >
          {saveMutation.isPending ? "Saving…" : `Save ${changedCount} change(s)`}
        </Button>
      )}

      {editingTrade && (
        <EditTradeDialog
          event={editingTrade}
          onClose={() => setEditingTrade(null)}
          accounts={accounts}
          meta={meta}
          refetchKey={refetchKey}
        />
      )}
    </div>
  );
}
