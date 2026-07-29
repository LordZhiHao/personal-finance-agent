import { Button } from "../components/ui";

export function WizardFooter({
  onBack,
  onSkip,
  onPrimary,
  primaryLabel = "Continue",
  primaryDisabled,
  skipLabel = "Skip for now",
}: {
  onBack?: () => void;
  onSkip?: () => void;
  onPrimary: () => void;
  primaryLabel?: string;
  primaryDisabled?: boolean;
  skipLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pt-4 mt-4" style={{ borderTop: "1px solid var(--gridline)" }}>
      <div>
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {onSkip && (
          <Button variant="ghost" onClick={onSkip}>
            {skipLabel}
          </Button>
        )}
        <Button variant="primary" onClick={onPrimary} disabled={primaryDisabled}>
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}
