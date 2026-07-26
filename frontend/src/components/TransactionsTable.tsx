import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Transaction } from "../types";
import { api } from "../api/client";
import { formatMoney } from "../lib/format";
import { Table, Thead, Tbody, Tr, Th, Td } from "./ui/Table";
import { Input, Select, Button } from "./ui";
import { useSortableRows } from "../lib/sort";

interface EditState {
  description: string;
  category: string;
}

export function TransactionsTable({
  transactions,
  categories,
  refetchKey,
}: {
  transactions: Transaction[];
  categories: string[];
  refetchKey: unknown[];
}) {
  const queryClient = useQueryClient();
  const { sorted, requestSort, directionFor } = useSortableRows(
    transactions,
    {
      date: (t) => t.date,
      description: (t) => t.description,
      amount: (t) => t.amount,
      category: (t) => t.category,
      account: (t) => t.accounts?.name ?? null,
    },
    { key: "date", direction: "desc" },
  );
  const [edits, setEdits] = useState<Record<string, EditState>>({});

  const saveMutation = useMutation({
    mutationFn: async () => {
      const changedIds = Object.keys(edits);
      await Promise.all(
        changedIds.map((id) => {
          const original = sorted.find((t) => t.id === id)!;
          const edit = edits[id];
          const fields: Record<string, string> = {};
          if (edit.description !== original.description) fields.description = edit.description;
          if (edit.category !== original.category) fields.category = edit.category;
          return api.patch(`/api/transactions/${id}`, fields);
        }),
      );
    },
    onSuccess: () => {
      setEdits({});
      queryClient.invalidateQueries({ queryKey: refetchKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/transactions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: refetchKey }),
  });

  function handleDelete(t: Transaction) {
    if (window.confirm(`Delete "${t.description}" (${formatMoney(t.amount, t.currency)})?`)) {
      deleteMutation.mutate(t.id);
    }
  }

  function fieldFor(t: Transaction): EditState {
    return edits[t.id] ?? { description: t.description, category: t.category };
  }

  function updateField(t: Transaction, patch: Partial<EditState>) {
    setEdits((prev) => ({ ...prev, [t.id]: { ...fieldFor(t), ...patch } }));
  }

  const changedCount = Object.entries(edits).filter(([id, edit]) => {
    const original = sorted.find((t) => t.id === id);
    return original && (edit.description !== original.description || edit.category !== original.category);
  }).length;

  return (
    <div>
      <div className="max-h-[400px] overflow-y-auto">
        <Table>
          <Thead>
            <Th sortDirection={directionFor("date")} onSort={() => requestSort("date")}>
              Date
            </Th>
            <Th sortDirection={directionFor("description")} onSort={() => requestSort("description")}>
              Description
            </Th>
            <Th align="right" sortDirection={directionFor("amount")} onSort={() => requestSort("amount")}>
              Amount
            </Th>
            <Th sortDirection={directionFor("category")} onSort={() => requestSort("category")}>
              Category
            </Th>
            <Th sortDirection={directionFor("account")} onSort={() => requestSort("account")}>
              Account
            </Th>
            <Th />
          </Thead>
          <Tbody>
            {sorted.map((t) => {
              const edit = fieldFor(t);
              return (
                <Tr key={t.id}>
                  <Td style={{ color: "var(--text-secondary)" }}>{t.date}</Td>
                  <Td>
                    <Input
                      value={edit.description}
                      onChange={(e) => updateField(t, { description: e.target.value })}
                      className="w-full"
                    />
                  </Td>
                  <Td
                    align="right"
                    className="font-medium"
                    style={{ color: t.amount >= 0 ? "var(--tint-green-text)" : "var(--text-primary)" }}
                  >
                    {formatMoney(t.amount, t.currency)}
                  </Td>
                  <Td>
                    <Select
                      value={edit.category}
                      onChange={(e) => updateField(t, { category: e.target.value })}
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td style={{ color: "var(--text-secondary)" }}>{t.accounts?.name ?? "Unknown"}</Td>
                  <Td align="right">
                    <Button
                      variant="ghost"
                      className="text-xs px-2 py-1"
                      style={{ color: "var(--tint-red-text)" }}
                      onClick={() => handleDelete(t)}
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
