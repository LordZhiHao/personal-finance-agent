import { useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { LoginPage } from "./LoginPage";
import { SignupPage } from "./SignupPage";
import { OnboardingWizard } from "../onboarding/OnboardingWizard";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, onboardingCompleted, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");

  if (loading) return null;

  if (!isAuthenticated) {
    return mode === "login" ? (
      <LoginPage onSwitchToSignup={() => setMode("signup")} />
    ) : (
      <SignupPage onSwitchToLogin={() => setMode("login")} />
    );
  }

  if (!onboardingCompleted) {
    return <OnboardingWizard />;
  }

  return <>{children}</>;
}
