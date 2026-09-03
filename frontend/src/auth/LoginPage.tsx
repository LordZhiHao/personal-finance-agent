import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";
import { AuthShowcasePanel } from "./AuthShowcasePanel";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

export function LoginPage({ onSwitchToSignup }: { onSwitchToSignup: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--page)" }}>
      <div
        className="w-full max-w-sm lg:max-w-[1180px] grid grid-cols-1 lg:grid-cols-[minmax(0,1.06fr)_minmax(0,1fr)] overflow-hidden"
        style={{ borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)" }}
      >
        <AuthShowcasePanel className="hidden lg:flex" />
        <div className="flex flex-col justify-center p-6 lg:p-10" style={{ background: "var(--surface-1)" }}>
          <div className="w-full lg:max-w-[360px] mx-auto">
            <div className="flex items-center gap-2 mb-6 lg:hidden">
              <img src="/logo-mark.png" alt="" className="h-6 w-6" />
              <span style={{ color: "var(--text-heading)" }}>
                Finance<span style={{ color: "var(--brand)" }}>Ku</span>
              </span>
            </div>

            <h2 className="text-2xl font-semibold" style={{ color: "var(--text-heading)" }}>
              Welcome back
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Sign in and Finn picks up where you left off.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Email
                </label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand)_13%,transparent)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Password
                </label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand)_13%,transparent)]"
                />
              </div>
              {error && (
                <p className="text-sm" style={{ color: "var(--tint-red-text)" }}>
                  {error}
                </p>
              )}
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                className="w-full shadow-[0_8px_22px_rgba(0,173,108,.3)]"
              >
                {submitting ? "Logging in…" : "Log in"}
              </Button>
              <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={onSwitchToSignup}
                  className="font-medium hover:underline"
                  style={{ color: "var(--brand)" }}
                >
                  Sign up
                </button>
              </p>
              <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                FinanceKu never asks for bank logins. You enter and edit every balance yourself.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
