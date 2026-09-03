import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button, Input } from "../components/ui";
import { useAccounts, useCreateMemory, useCustomCategories, useDeleteMemory, useMe, useMemories, useMeta } from "../hooks/api";
import type { OnboardingStepProps } from "./OnboardingWizard";

// Trimmed from the former AboutYouStep's 10 suggestions to the ~4 most broadly
// applicable ones — this step is a quick add-on to the recap, not a dedicated step.
const SUGGESTIONS = [
  "Saving for a house downpayment",
  "Building an emergency fund",
  "Keep answers brief, just the numbers",
  "Flag unusually large expenses",
];

export function WrapUpStep({ onBack }: OnboardingStepProps) {
  const { mainCurrency, telegramLinked, completeOnboarding } = useAuth();
  const accountsQuery = useAccounts();
  const customQuery = useCustomCategories();
  const meQuery = useMe();
  const metaQuery = useMeta();

  const memoriesQuery = useMemories();
  const createMutation = useCreateMemory();
  const deleteMutation = useDeleteMemory();
  const [draft, setDraft] = useState("");

  const accountCount = accountsQuery.data?.length ?? 0;
  const customCount = customQuery.data?.length ?? 0;
  const personaLabel = metaQuery.data?.personas.find((p) => p.id === meQuery.data?.persona)?.label ?? "Not set";

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
        You're all set 🎉
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        Here's what we've got so far — you can change any of this anytime from Settings.
      </p>

      <ul className="text-sm space-y-1.5 mb-4" style={{ color: "var(--text-primary)" }}>
        <li>
          💱 Main currency: <strong>{mainCurrency}</strong>
        </li>
        <li>🏦 {accountCount === 0 ? "No accounts yet" : `${accountCount} account${accountCount === 1 ? "" : "s"} added`}</li>
        <li>
          🏷️{" "}
          {customCount === 0
            ? "Using the built-in categories"
            : `${customCount} custom categor${customCount === 1 ? "y" : "ies"} added`}
        </li>
        <li>
          🤖 Telegram: <strong>{telegramLinked ? "Linked" : "Not linked"}</strong>
        </li>
        <li>
          📋 Persona: <strong>{personaLabel}</strong>
        </li>
      </ul>

      <div
        className="text-xs font-semibold uppercase tracking-wide mb-2 pt-4"
        style={{ color: "var(--text-muted)", borderTop: "1px solid var(--gridline)" }}
      >
        Anything else Finn should know?
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
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
        <div className="mb-3">
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

      <div className="flex items-end gap-2 mb-4">
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

      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        Tip: try the Chat page — you can ask questions about your spending or upload a receipt right from there.
      </p>

      <div className="flex items-center justify-between gap-2 pt-4 mt-4" style={{ borderTop: "1px solid var(--gridline)" }}>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={() => completeOnboarding()}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
