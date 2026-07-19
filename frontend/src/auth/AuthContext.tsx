import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { api, clearToken, getToken, setToken, ApiError } from "../api/client";

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getToken()));

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { access_token } = await api.post<{ access_token: string }>("/api/auth/login", {
        email,
        password,
      });
      setToken(access_token);
      setIsAuthenticated(true);
    } catch (err) {
      if (err instanceof ApiError) throw new Error(err.message || "Invalid email or password");
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
