import { useState } from "react";
import { Input } from "../components/ui";
import { useMe, useMeta, useUpdateMe } from "../hooks/api";
import type { OnboardingStepProps } from "./OnboardingWizard";
import { WizardFooter } from "./WizardFooter";

export function PersonaStep({ onNext, onBack }: OnboardingStepProps) {
  const meQuery = useMe();
  const metaQuery = useMeta();
  const updateMutation = useUpdateMe();
  const [selected, setSelected] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [initialized, setInitialized] = useState(false);

  if (meQuery.data && !initialized) {
    setSelected(meQuery.data.persona);
    setCustomText(meQuery.data.persona_custom_text ?? "");
    setInitialized(true);
  }

  function handlePrimary() {
    if (!selected) {
      onNext();
      return;
    }
    updateMutation.mutate(
      {
        persona: selected,
        persona_custom_text: selected === "other" ? customText.trim() || null : null,
      },
      { onSuccess: () => onNext() }
    );
  }

  if (!metaQuery.data) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        Which of these sounds like you?
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        Finn uses this to shape its tone and advice. Optional — pick one, or skip.
      </p>

      <div className="space-y-2 mb-3">
        {metaQuery.data.personas.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p.id)}
            className="w-full text-left px-3 py-2.5"
            style={{
              borderRadius: "var(--radius-control)",
              border: selected === p.id ? "2px solid var(--brand)" : "1px solid var(--border)",
              background: "var(--surface-1)",
            }}
          >
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {p.label}
            </div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {p.ui_description}
            </div>
          </button>
        ))}
      </div>

      {selected === "other" && (
        <Input
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Describe your situation in your own words"
          className="w-full mb-3"
        />
      )}

      <WizardFooter
        onBack={onBack}
        onSkip={onNext}
        onPrimary={handlePrimary}
        primaryLabel={updateMutation.isPending ? "Saving…" : "Continue"}
        primaryDisabled={updateMutation.isPending}
      />
    </div>
  );
}
