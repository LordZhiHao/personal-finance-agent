import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useAuth } from "../auth/AuthContext";
import { useGenerateTelegramLinkCode } from "../hooks/api";

export function SettingsPage() {
  const { email, telegramLinked, refreshMe } = useAuth();
  const mutation = useGenerateTelegramLinkCode();

  async function handleGenerate() {
    await mutation.mutateAsync();
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-lg font-semibold" style={{ color: "var(--text-heading)" }}>
        Settings
      </h1>

      <Card>
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-heading)" }}>
          Account
        </h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {email}
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--text-heading)" }}>
          Link Telegram
        </h2>
        {telegramLinked && !mutation.data ? (
          <p className="text-sm" style={{ color: "var(--tint-green-text)" }}>
            ✅ Already linked.
          </p>
        ) : (
          <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
            Generate a code and send it to the bot as <code>/link &lt;code&gt;</code> to connect this account to
            Telegram.
          </p>
        )}

        {mutation.data && (
          <div className="mb-3 p-3 text-center" style={{ background: "var(--brand-tint)", borderRadius: "var(--radius-control)" }}>
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

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGenerate} disabled={mutation.isPending}>
            {mutation.isPending ? "Generating…" : telegramLinked ? "Generate new code" : "Generate code"}
          </Button>
          {!telegramLinked && mutation.data && (
            <Button variant="ghost" onClick={() => refreshMe()}>
              I've sent /link — refresh status
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
