import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";

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
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg p-8 space-y-4"
        style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
      >
        <h1 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
          🔒 Personal Finance Dashboard
        </h1>
        <div className="space-y-1">
          <label className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded px-3 py-2 outline-none"
            style={{ border: "1px solid var(--baseline)", color: "var(--text-primary)", background: "transparent" }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded px-3 py-2 outline-none"
            style={{ border: "1px solid var(--baseline)", color: "var(--text-primary)", background: "transparent" }}
          />
        </div>
        {error && (
          <p className="text-sm" style={{ color: "var(--status-critical)" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded px-3 py-2 font-medium text-white disabled:opacity-60"
          style={{ background: "var(--series-1)" }}
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
