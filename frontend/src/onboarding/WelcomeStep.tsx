import { Button } from "../components/ui";
import type { OnboardingStepProps } from "./OnboardingWizard";

export function WelcomeStep({ onNext }: OnboardingStepProps) {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--text-heading)" }}>
        Welcome to FinanceKu 👋
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        Let's get you set up — your main currency, your first account, and a few categories to track. It takes
        about a minute, and everything here can be changed later from Settings.
      </p>
      <Button variant="primary" onClick={onNext} className="w-full">
        Let's go
      </Button>
    </div>
  );
}
