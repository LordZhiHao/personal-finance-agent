import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Account, Transaction } from "../types";
import { api } from "../api/client";
import { formatMoney } from "../lib/format";
import { Button, Field, Input, Overlay, Select } from "./ui";

const schema = z.object({
  description: z.string().min(1, "Description is required."),
  type: z.enum(["expense", "income"]),
  amount: z.coerce.number().gt(0, "Amount must be greater than 0."),
  category: z.string().min(1),
  accountId: z.string().min(1, "Please select an account."),
});

type FormValues = z.input<typeof schema>;

export function EditTransactionDialog({
  transaction,
  onClose,
  categories,
  accounts,
  refetchKey,
}: {
  transaction: Transaction;
  onClose: () => void;
  categories: string[];
  accounts: Account[];
  refetchKey: unknown[];
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: transaction.description,
      type: transaction.amount >= 0 ? "income" : "expense",
      amount: Math.abs(transaction.amount),
      category: transaction.category,
      accountId: transaction.account_id,
    },
  });

  const saveMutation = useMutation({
    mutationFn: (values: z.output<typeof schema>) => {
      const signedAmount = values.type === "expense" ? -values.amount : values.amount;
      const fields: Record<string, string | number> = {};
      if (values.description !== transaction.description) fields.description = values.description;
      if (signedAmount !== transaction.amount) fields.amount = signedAmount;
      if (values.category !== transaction.category) fields.category = values.category;
      if (values.accountId !== transaction.account_id) fields.account_id = values.accountId;
      return api.patch(`/api/transactions/${transaction.id}`, fields);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: refetchKey });
      onClose();
    },
    onError: (err) => setServerError(err instanceof Error ? err.message : "Failed to save."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/transactions/${transaction.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: refetchKey });
      onClose();
    },
    onError: (err) => setServerError(err instanceof Error ? err.message : "Failed to delete."),
  });

  function handleDelete() {
    if (window.confirm(`Delete "${transaction.description}" (${formatMoney(transaction.amount, transaction.currency)})?`)) {
      deleteMutation.mutate();
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-heading)" }}>
        Edit Transaction
      </h2>
      <form
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          saveMutation.mutate(values as z.output<typeof schema>);
        })}
        className="space-y-3"
      >
        <Field label="Description *" error={errors.description?.message}>
          <Input {...register("description")} className="w-full" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Type *" error={undefined}>
            <Select {...register("type")} className="w-full">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
          </Field>
          <Field label="Amount *" error={errors.amount?.message}>
            <Input type="number" step="0.01" min="0" {...register("amount")} className="w-full" />
          </Field>
          <Field label="Category *" error={undefined}>
            <Select {...register("category")} className="w-full">
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Account *" error={errors.accountId?.message}>
            <Select {...register("accountId")} className="w-full">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {serverError && (
          <p className="text-sm" style={{ color: "var(--tint-red-text)" }}>
            {serverError}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            style={{ color: "var(--tint-red-text)" }}
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </form>
    </Overlay>
  );
}
