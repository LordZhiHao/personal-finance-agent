import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Account, Meta } from "../types";
import { api } from "../api/client";

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

const fieldStyle = {
  border: "1px solid var(--baseline)",
  color: "var(--text-primary)",
  background: "var(--surface-1)",
};

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
        <p style={{ color: "var(--status-warning)" }}>No brokerage accounts found. Please add one first.</p>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-lg font-medium mb-4" style={{ color: "var(--text-primary)" }}>
        Add Investment Entry
      </h2>
      <form
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values as z.output<typeof schema>);
        })}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company Name" error={undefined}>
            <input {...register("companyName")} placeholder="e.g. Apple Inc" className="w-full rounded px-2 py-1.5 text-sm outline-none" style={fieldStyle} />
          </Field>
          <Field label="Ticker Symbol *" error={errors.ticker?.message}>
            <input {...register("ticker")} placeholder="e.g. AAPL, CSPX" className="w-full rounded px-2 py-1.5 text-sm outline-none" style={fieldStyle} />
          </Field>
          <Field label="Action *" error={undefined}>
            <select {...register("action")} className="w-full rounded px-2 py-1.5 text-sm outline-none" style={fieldStyle}>
              {meta.portfolio_actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date *" error={undefined}>
            <input type="date" {...register("date")} className="w-full rounded px-2 py-1.5 text-sm outline-none" style={fieldStyle} />
          </Field>
          <Field label="Currency *" error={undefined}>
            <select {...register("currency")} className="w-full rounded px-2 py-1.5 text-sm outline-none" style={fieldStyle}>
              {meta.currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Account *" error={errors.accountId?.message}>
            <select {...register("accountId")} className="w-full rounded px-2 py-1.5 text-sm outline-none" style={fieldStyle}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity *" error={errors.quantity?.message}>
            <input type="number" step="0.0001" min="0" {...register("quantity")} className="w-full rounded px-2 py-1.5 text-sm outline-none" style={fieldStyle} />
          </Field>
          <Field label="Price per Unit *" error={errors.price?.message}>
            <input type="number" step="0.0001" min="0" {...register("price")} className="w-full rounded px-2 py-1.5 text-sm outline-none" style={fieldStyle} />
          </Field>
          <Field label="Fees" error={undefined}>
            <input type="number" step="0.01" min="0" {...register("fees")} className="w-full rounded px-2 py-1.5 text-sm outline-none" style={fieldStyle} />
          </Field>
        </div>
        <Field label="Description / Notes" error={undefined}>
          <input {...register("notes")} placeholder="Optional notes about this trade" className="w-full rounded px-2 py-1.5 text-sm outline-none" style={fieldStyle} />
        </Field>

        {serverError && (
          <p className="text-sm" style={{ color: "var(--status-critical)" }}>
            {serverError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "var(--series-1)" }}
          >
            {mutation.isPending ? "Saving…" : "Save Entry"}
          </button>
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
        <span className="text-xs" style={{ color: "var(--status-critical)" }}>
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
        className="w-full max-w-lg rounded-lg p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
