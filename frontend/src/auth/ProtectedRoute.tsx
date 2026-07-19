import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { LoginPage } from "./LoginPage";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginPage />;
  return <>{children}</>;
}
