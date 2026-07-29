import { useState } from "react";
import { Button, Input } from "../components/ui";
import { useCreateCategory, useCustomCategories, useMeta } from "../hooks/api";
import type { OnboardingStepProps } from "./OnboardingWizard";
import { WizardFooter } from "./WizardFooter";

export function CategoriesStep({ onNext, onBack }: OnboardingStepProps) {
  const metaQuery = useMeta();
  const customQuery = useCustomCategories();
  const mutation = useCreateCategory();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    const name = draft.trim();
    if (!name) return;
    setError(null);
    mutation.mutate(name, {
      onSuccess: () => setDraft(""),
      onError: () => setError("Could not add — it may already exist."),
    });
  }

  if (!metaQuery.data) return null;

  const customNames = new Set((customQuery.data ?? []).map((c) => c.name));
  const builtins = metaQuery.data.categories.filter((name) => !customNames.has(name));

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        Your transaction categories
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        These built-in categories are always available. Add your own on top if you track something specific.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {builtins.map((name) => (
          <span
            key={name}
            className="text-xs px-3 py-1.5 rounded-full"
            style={{ background: "var(--brand-tint)", color: "var(--brand-hover)" }}
          >
            {name}
          </span>
        ))}
        {(customQuery.data ?? []).map((c) => (
          <span
            key={c.id}
            className="text-xs px-3 py-1.5 rounded-full"
            style={{ background: "var(--tint-neutral-bg)", color: "var(--text-primary)" }}
          >
            {c.name}
          </span>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. Pet Care"
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button variant="outline" onClick={handleAdd} disabled={mutation.isPending || !draft.trim()}>
          {mutation.isPending ? "Adding…" : "＋ Add"}
        </Button>
      </div>
      {error && (
        <p className="text-xs mt-1" style={{ color: "var(--tint-red-text)" }}>
          {error}
        </p>
      )}

      <WizardFooter onBack={onBack} onSkip={onNext} onPrimary={onNext} primaryLabel="Continue" />
    </div>
  );
}
