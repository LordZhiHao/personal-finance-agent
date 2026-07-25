import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Account, Meta } from "../types";
import { api } from "../api/client";
import { Button, Input, Select } from "./ui";

const schema = z.object({
  description: z.string().min(1, "Description is required."),
  type: z.enum(["expense", "income"]),
  amount: z.coerce.number().gt(0, "Amount must be greater than 0."),
  date: z.string().min(1),
  category: z.string().min(1),
  currency: z.string().min(1),
  accountId: z.string().min(1, "Please select an account."),
});

type FormValues = z.input<typeof schema>;

export function AddTransactionDialog({
  open,
  onClose,
  accounts,
  meta,
  refetchKey,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  meta: Meta;
  refetchKey: unknown[];
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: "",
      type: "expense",
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      category: meta.categories[0],
      currency: meta.currencies[0],
      accountId: accounts[0]?.id ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: z.output<typeof schema>) =>
      api.post("/api/transactions", {
        account_id: values.accountId,
        date: values.date,
        description: values.description,
        amount: values.type === "expense" ? -values.amount : values.amount,
        category: values.category,
        currency: values.currency,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: refetchKey });
      reset();
      onClose();
    },
    onError: (err) => setServerError(err instanceof Error ? err.message : "Failed to save."),
  });

  if (!open) return null;

  if (accounts.length === 0) {
    return (
      <Overlay onClose={onClose}>
        <p style={{ color: "var(--tint-amber-text)" }}>No accounts found. Please add one first.</p>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-heading)" }}>
        Add Transaction
      </h2>
      <form
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values as z.output<typeof schema>);
        })}
        className="space-y-3"
      >
        <Field label="Description *" error={errors.description?.message}>
          <Input {...register("description")} placeholder="e.g. Lunch at hawker centre" className="w-full" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type *" error={undefined}>
            <Select {...register("type")} className="w-full">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
          </Field>
          <Field label="Amount *" error={errors.amount?.message}>
            <Input type="number" step="0.01" min="0" {...register("amount")} className="w-full" />
          </Field>
          <Field label="Date *" error={undefined}>
            <Input type="date" {...register("date")} className="w-full" />
          </Field>
          <Field label="Category *" error={undefined}>
            <Select {...register("category")} className="w-full">
              {meta.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Currency *" error={undefined}>
            <Select {...register("currency")} className="w-full">
              {meta.currencies.map((c) => (
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

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save Transaction"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {children}
      {error && (
        <span className="text-xs" style={{ color: "var(--tint-red-text)" }}>
          {error}
        </span>
      )}
    </label>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
