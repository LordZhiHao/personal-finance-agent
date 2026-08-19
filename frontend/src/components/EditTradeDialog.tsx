import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Account, Meta, PortfolioEvent } from "../types";
import { api } from "../api/client";
import { Button, Field, Input, Overlay, Select } from "./ui";

const schema = z
  .object({
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

export function EditTradeDialog({
  event,
  onClose,
  accounts,
  meta,
  refetchKey,
}: {
  event: PortfolioEvent;
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
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ticker: event.ticker,
      action: event.action,
      date: event.date,
      currency: event.currency,
      accountId: event.account_id,
      quantity: event.quantity,
      price: event.price,
      fees: event.fees ?? 0,
      notes: event.notes ?? "",
    },
  });

  const saveMutation = useMutation({
    mutationFn: (values: z.output<typeof schema>) => {
      const fields: Record<string, unknown> = {};
      if (values.ticker !== event.ticker) fields.ticker = values.ticker;
      if (values.action !== event.action) fields.action = values.action;
      if (values.date !== event.date) fields.date = values.date;
      if (values.currency !== event.currency) fields.currency = values.currency;
      if (values.accountId !== event.account_id) fields.account_id = values.accountId;
      if (values.quantity !== event.quantity) fields.quantity = values.quantity;
      if (values.price !== event.price) fields.price = values.price;
      const fees = values.fees ?? 0;
      if (fees !== (event.fees ?? 0)) fields.fees = fees || null;
      const notes = values.notes?.trim() ?? "";
      if (notes !== (event.notes ?? "")) fields.notes = notes === "" ? null : notes;
      return api.patch(`/api/portfolio-events/${event.id}`, fields);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: refetchKey });
      onClose();
    },
    onError: (err) => setServerError(err instanceof Error ? err.message : "Failed to save."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/portfolio-events/${event.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: refetchKey });
      onClose();
    },
    onError: (err) => setServerError(err instanceof Error ? err.message : "Failed to delete."),
  });

  function handleDelete() {
    if (window.confirm(`Delete ${event.action} ${event.quantity} ${event.ticker} on ${event.date}?`)) {
      deleteMutation.mutate();
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-heading)" }}>
        Edit Investment Entry
      </h2>
      <form
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          saveMutation.mutate(values as z.output<typeof schema>);
        })}
        className="space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Ticker Symbol *" error={errors.ticker?.message}>
            <Input {...register("ticker")} className="w-full" />
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
        <Field label="Notes" error={undefined}>
          <Input {...register("notes")} placeholder="Optional notes about this trade" className="w-full" />
        </Field>

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
