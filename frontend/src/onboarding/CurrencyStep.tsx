import { useState } from "react";
import { Select } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { useMeta, useUpdateMainCurrency } from "../hooks/api";
import type { OnboardingStepProps } from "./OnboardingWizard";
import { WizardFooter } from "./WizardFooter";

export function CurrencyStep({ onNext, onBack }: OnboardingStepProps) {
  const { mainCurrency, refreshMe } = useAuth();
  const metaQuery = useMeta();
  const mutation = useUpdateMainCurrency();
  const [draft, setDraft] = useState(mainCurrency);

  function handlePrimary() {
    if (draft === mainCurrency) {
      onNext();
      return;
    }
    mutation.mutate(draft, {
      onSuccess: async () => {
        await refreshMe();
        onNext();
      },
    });
  }

  if (!metaQuery.data) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        What's your main currency?
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        Balances and totals across the app are shown in this currency. You can change it anytime in Settings.
      </p>
      <Select value={draft} onChange={(e) => setDraft(e.target.value)} className="w-32">
        {metaQuery.data.currencies.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      <WizardFooter
        onBack={onBack}
        onSkip={onNext}
        onPrimary={handlePrimary}
        primaryLabel={mutation.isPending ? "Saving…" : "Continue"}
        primaryDisabled={mutation.isPending}
      />
    </div>
  );
}
