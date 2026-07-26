import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Account, Meta } from "../types";
import { api } from "../api/client";
import { Button, Input, Overlay, Select } from "./ui";

const schema = z
  .object({
    companyName: z.string().optional(),
    ticker: z.string().min(1, "Ticker Symbol is required."),
    action: z.string().min(1),
    date: z.string().min(1),
    currency: z.string().min(1),
    accountId: z.string().min(1, "Please select an account."),
    quantity: z.coerce.number().gt(0, "Quantity must be greater than 0."),
    price: z.coerce.number().min(0),
    fees: z.coerce.number().min(0).optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.action === "DIVIDEND" || data.price > 0, {
    message: "Price must be greater than 0.",
    path: ["price"],
  });

type FormValues = z.input<typeof schema>;

export function AddTradeDialog({
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
      companyName: "",
      ticker: "",
      action: meta.portfolio_actions[0],
      date: new Date().toISOString().slice(0, 10),
      currency: meta.currencies[0],
      accountId: accounts[0]?.id ?? "",
      quantity: 0,
      price: 0,
      fees: 0,
      notes: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: z.output<typeof schema>) =>
      api.post("/api/portfolio-events", {
        account_id: values.accountId,
        date: values.date,
        ticker: values.ticker,
        action: values.action,
        quantity: values.quantity,
        price: values.price,
        currency: values.currency,
        fees: values.fees || null,
        notes: values.notes || null,
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
        <p style={{ color: "var(--tint-amber-text)" }}>No brokerage accounts found. Please add one first.</p>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-heading)" }}>
        Add Investment Entry
      </h2>
      <form
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values as z.output<typeof schema>);
        })}
        className="space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Company Name" error={undefined}>
            <Input {...register("companyName")} placeholder="e.g. Apple Inc" className="w-full" />
          </Field>
          <Field label="Ticker Symbol *" error={errors.ticker?.message}>
            <Input {...register("ticker")} placeholder="e.g. AAPL, CSPX" className="w-full" />
          </Field>
          <Field label="Action *" error={undefined}>
            <Select {...register("action")} className="w-full">
              {meta.portfolio_actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date *" error={undefined}>
            <Input type="date" {...register("date")} className="w-full" />
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
          <Field label="Quantity *" error={errors.quantity?.message}>
            <Input type="number" step="0.0001" min="0" {...register("quantity")} className="w-full" />
          </Field>
          <Field label="Price per Unit *" error={errors.price?.message}>
            <Input type="number" step="0.0001" min="0" {...register("price")} className="w-full" />
          </Field>
          <Field label="Fees" error={undefined}>
            <Input type="number" step="0.01" min="0" {...register("fees")} className="w-full" />
          </Field>
        </div>
        <Field label="Description / Notes" error={undefined}>
          <Input {...register("notes")} placeholder="Optional notes about this trade" className="w-full" />
        </Field>

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
            {mutation.isPending ? "Saving…" : "Save Entry"}
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
