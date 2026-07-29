import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Field, Input, Select } from "../components/ui";
import { useAccounts, useCreateAccount, useMeta } from "../hooks/api";
import type { OnboardingStepProps } from "./OnboardingWizard";
import { WizardFooter } from "./WizardFooter";

const accountSchema = z.object({
  name: z.string().min(1, "Name is required."),
  type: z.string().min(1),
  currency: z.string().min(1),
  comments: z.string().optional(),
});
type AccountFormValues = z.infer<typeof accountSchema>;

export function AccountsStep({ onNext, onBack }: OnboardingStepProps) {
  const metaQuery = useMeta();
  const accountsQuery = useAccounts();
  const createMutation = useCreateAccount();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      type: metaQuery.data?.account_types[0] ?? "",
      currency: metaQuery.data?.currencies[0] ?? "",
      comments: "",
    },
  });

  function onSubmit(values: AccountFormValues) {
    setServerError(null);
    createMutation.mutate(values, {
      onSuccess: () => reset({ name: "", type: values.type, currency: values.currency, comments: "" }),
      onError: (err) => setServerError(err instanceof Error ? err.message : "Failed to save."),
    });
  }

  if (!metaQuery.data) return null;

  const accounts = accountsQuery.data ?? [];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        Add your first account
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        A bank, e-wallet, or brokerage account to log transactions and trades against. You can add more anytime in
        Settings.
      </p>

      {accounts.length > 0 && (
        <div className="mb-3">
          {accounts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between py-1.5 text-sm"
              style={{ borderBottom: "1px solid var(--gridline)" }}
            >
              <span style={{ color: "var(--text-primary)" }}>{a.name}</span>
              <span style={{ color: "var(--text-secondary)" }}>
                {a.type} · {a.currency}
              </span>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Field label="Name" error={errors.name?.message}>
          <Input {...register("name")} placeholder="e.g. DBS" className="w-full" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select {...register("type")} className="w-full">
              {metaQuery.data.account_types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Currency">
            <Select {...register("currency")} className="w-full">
              {metaQuery.data.currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notes (optional)">
          <Input {...register("comments")} placeholder="e.g. for US stock trades" className="w-full" />
        </Field>

        {serverError && (
          <p className="text-sm" style={{ color: "var(--tint-red-text)" }}>
            {serverError}
          </p>
        )}

        <Button type="submit" variant="outline" disabled={isSubmitting || createMutation.isPending} className="w-full">
          {createMutation.isPending ? "Adding…" : "＋ Add Account"}
        </Button>
      </form>

      {accounts.length === 0 && (
        <p className="text-xs mt-3" style={{ color: "var(--tint-amber-text)" }}>
          Most features need at least one account — you can always add one later in Settings if you'd rather skip
          this for now.
        </p>
      )}

      <WizardFooter onBack={onBack} onSkip={onNext} onPrimary={onNext} primaryLabel="Continue" />
    </div>
  );
}
