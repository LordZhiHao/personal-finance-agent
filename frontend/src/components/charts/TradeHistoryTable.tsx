import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Account, Meta, PortfolioEvent } from "../../types";
import { api } from "../../api/client";
import { Table, Thead, Tbody, Tr, Th, Td } from "../ui/Table";
import { Button, Input, Select } from "../ui";

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

  const sorted = useMemo(() => events, [events]);

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
                  <Td>
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
    </div>
  );
}
