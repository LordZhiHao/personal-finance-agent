import { useState } from "react";
import { Button, Input } from "../components/ui";
import { useCreateMemory, useDeleteMemory, useMemories } from "../hooks/api";
import type { OnboardingStepProps } from "./OnboardingWizard";
import { WizardFooter } from "./WizardFooter";

const SUGGESTIONS = [
  "Saving for a house downpayment",
  "Paying off a loan/debt",
  "Building an emergency fund",
  "Saving for retirement",
  "Keep answers brief, just the numbers",
  "Flag unusually large expenses",
  "I don't want budgeting lectures",
  "Long-term buy-and-hold, not day-trading",
  "Income is freelance/variable",
  "Supporting family financially",
];

export function AboutYouStep({ onNext, onBack }: OnboardingStepProps) {
  const memoriesQuery = useMemories();
  const createMutation = useCreateMemory();
  const deleteMutation = useDeleteMemory();
  const [draft, setDraft] = useState("");

  const saved = memoriesQuery.data ?? [];
  const savedContents = new Set(saved.map((m) => m.content));

  function handleAdd(content: string) {
    const text = content.trim();
    if (!text || savedContents.has(text)) return;
    createMutation.mutate(text, { onSuccess: () => setDraft("") });
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        Tell Finn about yourself
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        Anything Finn should keep in mind — goals, preferences, how you like to be talked to.
        Entirely optional, and you can always add more later from Settings.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {SUGGESTIONS.filter((s) => !savedContents.has(s)).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleAdd(s)}
            disabled={createMutation.isPending}
            className="text-xs px-3 py-1.5 rounded-full"
            style={{ background: "var(--tint-neutral-bg)", color: "var(--text-primary)" }}
          >
            + {s}
          </button>
        ))}
      </div>

      {saved.length > 0 && (
        <div className="mb-4">
          {saved.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 py-1.5"
              style={{ borderBottom: "1px solid var(--gridline)" }}
            >
              <span className="text-sm min-w-0 break-words" style={{ color: "var(--text-primary)" }}>
                {m.content}
              </span>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(m.id)}
                disabled={deleteMutation.isPending}
                className="text-xs shrink-0"
                style={{ color: "var(--tint-red-text)" }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write your own…"
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd(draft);
            }
          }}
        />
        <Button variant="outline" onClick={() => handleAdd(draft)} disabled={createMutation.isPending || !draft.trim()}>
          {createMutation.isPending ? "Adding…" : "＋ Add"}
        </Button>
      </div>

      <WizardFooter onBack={onBack} onSkip={onNext} onPrimary={onNext} primaryLabel="Continue" />
    </div>
  );
}
