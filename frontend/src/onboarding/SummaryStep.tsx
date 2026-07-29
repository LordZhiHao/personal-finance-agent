import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui";
import { useAccounts, useCustomCategories } from "../hooks/api";
import type { OnboardingStepProps } from "./OnboardingWizard";

export function SummaryStep({ onBack }: OnboardingStepProps) {
  const { mainCurrency, telegramLinked, completeOnboarding } = useAuth();
  const accountsQuery = useAccounts();
  const customQuery = useCustomCategories();

  const accountCount = accountsQuery.data?.length ?? 0;
  const customCount = customQuery.data?.length ?? 0;

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
      </ul>

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
