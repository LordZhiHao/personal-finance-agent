import { useState } from "react";
import { Card } from "../components/ui";
import { WelcomeStep } from "./WelcomeStep";
import { CurrencyStep } from "./CurrencyStep";
import { AccountsStep } from "./AccountsStep";
import { CategoriesStep } from "./CategoriesStep";
import { TelegramStep } from "./TelegramStep";
import { AboutYouStep } from "./AboutYouStep";
import { SummaryStep } from "./SummaryStep";

export interface OnboardingStepProps {
  onNext: () => void;
  onBack: () => void;
}

const STEPS = [
  WelcomeStep,
  CurrencyStep,
  AccountsStep,
  CategoriesStep,
  TelegramStep,
  AboutYouStep,
  SummaryStep,
] as const;

export function OnboardingWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const Step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  function onNext() {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function onBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }
  function skipToEnd() {
    setStepIndex(STEPS.length - 1);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--page)" }}>
      <Card className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="" className="h-6 w-6" />
            <span className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>
              Finance<span style={{ color: "var(--brand)" }}>Ku</span>
            </span>
          </div>
          {!isFirst && !isLast && (
            <button
              type="button"
              onClick={skipToEnd}
              className="text-xs hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              Skip the rest
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === stepIndex ? 24 : 8,
                background: i <= stepIndex ? "var(--brand)" : "var(--gridline)",
              }}
            />
          ))}
        </div>

        <Step onNext={onNext} onBack={onBack} />
      </Card>
    </div>
  );
}
