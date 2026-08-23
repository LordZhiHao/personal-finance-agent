import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui";
import { useCreateBudget, useCreateGoal, useMe, useMeta } from "../hooks/api";
import type { OnboardingStepProps } from "./OnboardingWizard";
import { WizardFooter } from "./WizardFooter";

export function StarterSuggestionStep({ onNext, onBack }: OnboardingStepProps) {
  const { mainCurrency } = useAuth();
  const meQuery = useMe();
  const metaQuery = useMeta();
  const createBudget = useCreateBudget();
  const createGoal = useCreateGoal();
  const [accepted, setAccepted] = useState(false);

  if (!meQuery.data || !metaQuery.data) return null;

  const persona = metaQuery.data.personas.find((p) => p.id === meQuery.data!.persona);
  const suggestion = persona?.starter_suggestion ?? null;
  const isPending = createBudget.isPending || createGoal.isPending;

  function handleAccept() {
    if (!suggestion) return;
    if (suggestion.type === "goal") {
      createGoal.mutate(
        { name: suggestion.name!, target_amount: suggestion.target_amount!, currency: mainCurrency },
        { onSuccess: () => setAccepted(true) }
      );
    } else {
      createBudget.mutate(
        { category: suggestion.category!, monthly_limit: suggestion.monthly_limit!, currency: mainCurrency },
        { onSuccess: () => setAccepted(true) }
      );
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        A starter suggestion
      </h2>

      {!persona && (
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          You didn't pick a persona, so there's nothing to suggest here — you can always add budgets and goals
          later in Settings.
        </p>
      )}

      {persona && !suggestion && (
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          No preset suggestion for a custom persona — you can always add your own budgets and goals later in
          Settings.
        </p>
      )}

      {persona && suggestion && !accepted && (
        <>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            Based on "{persona.label}", here's a {suggestion.type} to get you started. You can edit or remove it
            anytime.
          </p>
          <div
            className="p-3 mb-4"
            style={{ borderRadius: "var(--radius-control)", border: "1px solid var(--border)", background: "var(--surface-1)" }}
          >
            <div className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
              {suggestion.type === "goal"
                ? `Goal: ${suggestion.name} — ${suggestion.target_amount} ${mainCurrency}`
                : `Budget: ${suggestion.category} — ${suggestion.monthly_limit} ${mainCurrency}/mo`}
            </div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {suggestion.description}
            </div>
          </div>
          <Button variant="outline" onClick={handleAccept} disabled={isPending} className="w-full">
            {isPending ? "Adding…" : `＋ Accept this ${suggestion.type}`}
          </Button>
        </>
      )}

      {accepted && (
        <p className="text-sm mb-4" style={{ color: "var(--tint-green-text)" }}>
          ✅ Added — you'll find it under {suggestion?.type === "goal" ? "Goals" : "Budgets"} in Settings.
        </p>
      )}

      <WizardFooter onBack={onBack} onSkip={onNext} onPrimary={onNext} primaryLabel="Continue" />
    </div>
  );
}
