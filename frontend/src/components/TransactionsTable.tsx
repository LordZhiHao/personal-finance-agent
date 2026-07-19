import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Transaction } from "../types";
import { api } from "../api/client";
import { formatMoney } from "../lib/format";

interface EditState {
  description: string;
  category: string;
}

const th = "text-left text-xs font-medium py-2 px-3";
const td = "text-sm py-1.5 px-3";

const fieldStyle = {
  border: "1px solid var(--baseline)",
  color: "var(--text-primary)",
  background: "var(--surface-1)",
};

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
  const sorted = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)),
    [transactions],
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
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0" style={{ background: "var(--surface-1)" }}>
            <tr style={{ borderBottom: "1px solid var(--gridline)", color: "var(--text-muted)" }}>
              <th className={th}>Date</th>
              <th className={th}>Description</th>
              <th className={th}>Amount</th>
              <th className={th}>Category</th>
              <th className={th}>Account</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => {
              const edit = fieldFor(t);
              return (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--gridline)" }}>
                  <td className={`${td} tabular-nums`} style={{ color: "var(--text-secondary)" }}>
                    {t.date}
                  </td>
                  <td className={td}>
                    <input
                      value={edit.description}
                      onChange={(e) => updateField(t, { description: e.target.value })}
                      className="w-full rounded px-2 py-1 text-sm outline-none"
                      style={fieldStyle}
                    />
                  </td>
                  <td className={`${td} tabular-nums`} style={{ color: "var(--text-primary)" }}>
                    {formatMoney(t.amount, t.currency)}
                  </td>
                  <td className={td}>
                    <select
                      value={edit.category}
                      onChange={(e) => updateField(t, { category: e.target.value })}
                      className="rounded px-2 py-1 text-sm outline-none"
                      style={fieldStyle}
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={td} style={{ color: "var(--text-secondary)" }}>
                    {t.accounts?.name ?? "Unknown"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {changedCount > 0 && (
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="mt-3 rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          style={{ background: "var(--series-1)" }}
        >
          {saveMutation.isPending ? "Saving…" : `Save ${changedCount} change(s)`}
        </button>
      )}
    </div>
  );
}
