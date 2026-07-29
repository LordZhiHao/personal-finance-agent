import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui";
import { useGenerateTelegramLinkCode } from "../hooks/api";
import type { OnboardingStepProps } from "./OnboardingWizard";
import { WizardFooter } from "./WizardFooter";

export function TelegramStep({ onNext, onBack }: OnboardingStepProps) {
  const { telegramLinked, refreshMe } = useAuth();
  const mutation = useGenerateTelegramLinkCode();

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
        Link Telegram (optional)
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        Snap a photo of a receipt or bank statement and send it to the bot — it'll extract and log the transactions
        for you. You can always do this later from Settings.
      </p>

      {telegramLinked && !mutation.data ? (
        <p className="text-sm mb-3" style={{ color: "var(--tint-green-text)" }}>
          ✅ Already linked.
        </p>
      ) : (
        <>
          {mutation.data && (
            <div
              className="mb-3 p-3 text-center"
              style={{ background: "var(--brand-tint)", borderRadius: "var(--radius-control)" }}
            >
              <p className="text-2xl font-mono font-semibold tracking-widest" style={{ color: "var(--brand-hover)" }}>
                {mutation.data.code}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                Send <code>/link {mutation.data.code}</code> to the bot within {mutation.data.ttl_minutes} minutes.
              </p>
            </div>
          )}
          {mutation.isError && (
            <p className="text-sm mb-3" style={{ color: "var(--tint-red-text)" }}>
              Could not generate a code. Try again.
            </p>
          )}
          <div className="flex gap-2 mb-2">
            <Button variant="outline" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Generating…" : "Generate code"}
            </Button>
            {mutation.data && (
              <Button variant="ghost" onClick={() => refreshMe()}>
                I've sent /link — refresh status
              </Button>
            )}
          </div>
        </>
      )}

      <WizardFooter onBack={onBack} onSkip={onNext} onPrimary={onNext} primaryLabel="Continue" />
    </div>
  );
}
