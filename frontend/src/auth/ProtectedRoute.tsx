import { useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { LoginPage } from "./LoginPage";
import { SignupPage } from "./SignupPage";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");

  if (loading) return null;

  if (!isAuthenticated) {
    return mode === "login" ? (
      <LoginPage onSwitchToSignup={() => setMode("signup")} />
    ) : (
      <SignupPage onSwitchToLogin={() => setMode("login")} />
    );
  }

  return <>{children}</>;
}
