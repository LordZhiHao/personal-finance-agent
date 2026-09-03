import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { Input } from "../components/ui";
import { useCreateBudget, useMe, useSuggestedPlan, useUpdateMe } from "../hooks/api";
import type { SuggestedPlanCategory } from "../types";
import { PersonaFallbackPlan } from "./PersonaFallbackPlan";
import type { OnboardingStepProps } from "./OnboardingWizard";
import { WizardFooter } from "./WizardFooter";

interface CategoryDraft {
  included: boolean;
  limit: number;
}

function IncomeInput() {
  const queryClient = useQueryClient();
  const meQuery = useMe();
  const updateMutation = useUpdateMe();
  const [draft, setDraft] = useState(() =>
    meQuery.data?.monthly_income != null ? String(meQuery.data.monthly_income) : "",
  );

  function handleBlur() {
    const current = meQuery.data?.monthly_income;
    const next = draft.trim() ? Number(draft) : null;
    if (next === current || (next != null && next < 0)) return;
    updateMutation.mutate(
      { monthly_income: next },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suggested-plan"] }) },
    );
  }

  return (
    <div className="mb-4">
      <label className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Monthly income (optional)
      </label>
      <Input
        type="number"
        min="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        placeholder="e.g. 5200"
        className="w-full mt-1"
      />
    </div>
  );
}

function RealDataPlanCards({
  categories,
  currency,
  onNext,
  onBack,
}: {
  categories: SuggestedPlanCategory[];
  currency: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const createBudget = useCreateBudget();
  const [drafts, setDrafts] = useState<Record<string, CategoryDraft>>(() =>
    Object.fromEntries(categories.map((c) => [c.category, { included: true, limit: c.suggested_limit }])),
  );
  const [saving, setSaving] = useState(false);

  function updateDraft(category: string, patch: Partial<CategoryDraft>) {
    setDrafts((prev) => ({ ...prev, [category]: { ...prev[category], ...patch } }));
  }

  async function handleUsePlan() {
    setSaving(true);
    const included = categories.filter((c) => drafts[c.category]?.included);
    await Promise.allSettled(
      included.map((c) =>
        createBudget.mutateAsync({ category: c.category, monthly_limit: drafts[c.category].limit, currency }),
      ),
    );
    setSaving(false);
    onNext();
  }

  return (
    <div>
      <div className="space-y-2 mb-3">
        {categories.map((c) => {
          const draft = drafts[c.category];
          return (
            <div
              key={c.category}
              className="flex items-center gap-3 p-3"
              style={{ borderRadius: "var(--radius-control)", border: "1px solid var(--border)", background: "var(--surface-1)" }}
            >
              <input
                type="checkbox"
                checked={draft.included}
                onChange={(e) => updateDraft(c.category, { included: e.target.checked })}
                style={{ accentColor: "var(--brand)" }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {c.category}
                </div>
                <div className="text-xs" style={{ fontFamily: "var(--font-plex-mono)", color: "var(--text-muted)" }}>
                  avg {c.avg_monthly.toFixed(0)} {currency}/mo
                </div>
              </div>
              <Input
                type="number"
                min="0"
                step="10"
                value={draft.limit}
                onChange={(e) => updateDraft(c.category, { limit: Number(e.target.value) })}
                disabled={!draft.included}
                className="w-28"
              />
            </div>
          );
        })}
      </div>

      <WizardFooter
        onBack={onBack}
        onSkip={onNext}
        onPrimary={handleUsePlan}
        primaryLabel={saving ? "Saving…" : "Use this plan"}
        primaryDisabled={saving}
        skipLabel="Set it up later"
      />
    </div>
  );
}

export function PlanStep({ onNext, onBack }: OnboardingStepProps) {
  const { mainCurrency } = useAuth();
  const planQuery = useSuggestedPlan();

  const heading = useMemo(
    () => (planQuery.data?.has_enough_data ? "Here's the plan I'd suggest for you" : "Your plan"),
    [planQuery.data?.has_enough_data],
  );

  if (!planQuery.data) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        {heading}
      </h2>
      {planQuery.data.has_enough_data && (
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          Built from your last 90 days of transactions
          {planQuery.data.left_to_plan != null
            ? ` — ${planQuery.data.left_to_plan.toFixed(0)} ${mainCurrency} left to plan after income and typical spend.`
            : "."}{" "}
          Adjust anything that looks wrong; you can change it any time.
        </p>
      )}

      <IncomeInput />

      {planQuery.data.has_enough_data ? (
        <RealDataPlanCards
          categories={planQuery.data.categories}
          currency={mainCurrency}
          onNext={onNext}
          onBack={onBack}
        />
      ) : (
        <PersonaFallbackPlan onNext={onNext} onBack={onBack} />
      )}
    </div>
  );
}
