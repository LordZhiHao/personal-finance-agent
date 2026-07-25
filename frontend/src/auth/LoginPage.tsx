import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

export function LoginPage() {
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--page)" }}>
      <Card className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-heading)" }}>
            🍊 Personal Finance Dashboard
          </h1>
          <div className="space-y-1">
            <label className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Email
            </label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
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
              className="w-full"
            />
          </div>
          {error && (
            <p className="text-sm" style={{ color: "var(--tint-red-text)" }}>
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={submitting} className="w-full">
            {submitting ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
