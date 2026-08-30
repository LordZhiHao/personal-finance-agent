import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Field, Input, Select } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { useAccounts, useCreateAccount, useMeta, useUpdateMainCurrency } from "../hooks/api";
import type { OnboardingStepProps } from "./OnboardingWizard";
import { WizardFooter } from "./WizardFooter";

const accountSchema = z.object({
  name: z.string().min(1, "Name is required."),
  type: z.string().min(1),
  currency: z.string().min(1),
  comments: z.string().optional(),
});
type AccountFormValues = z.infer<typeof accountSchema>;

/** Merges the former WelcomeStep (splash), CurrencyStep (single currency picker) and
 * AccountsStep (account creation) into one step — the wizard's first, matching the
 * mockup's "Which accounts should Finn track?" framing. */
export function AccountsStep({ onNext, onBack }: OnboardingStepProps) {
  const { mainCurrency, refreshMe } = useAuth();
  const currencyMutation = useUpdateMainCurrency();
  const [currencyDraft, setCurrencyDraft] = useState(mainCurrency);

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

  function handleCurrencyChange(next: string) {
    setCurrencyDraft(next);
    if (next === mainCurrency) return;
    currencyMutation.mutate(next, { onSuccess: () => refreshMe() });
  }

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
        Which accounts should Finn track?
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        Name them and enter today's balance. Nothing connects to your bank — you stay in control of the numbers.
      </p>

      <div className="mb-4">
        <label className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Track everything in
        </label>
        <Select
          value={currencyDraft}
          onChange={(e) => handleCurrencyChange(e.target.value)}
          className="w-32 mt-1"
        >
          {metaQuery.data.currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

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
          <p className="text-xs mt-1.5" style={{ fontFamily: "var(--font-plex-mono)", color: "var(--text-muted)" }}>
            {accounts.length} account{accounts.length === 1 ? "" : "s"} added
          </p>
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
