import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  api,
  clearStoredTheme,
  clearToken,
  getStoredTheme,
  getToken,
  setStoredTheme,
  setToken,
  ApiError,
} from "../api/client";
import type { Me } from "../types";

interface AuthContextValue {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  telegramLinked: boolean;
  mainCurrency: string;
  theme: string;
  hiddenDashboardSections: string[];
  onboardingCompleted: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// "green" is the implicit default (:root, no attribute needed) — only "orange"
// gets a [data-theme="orange"] attribute (see index.css).
function applyTheme(theme: string): void {
  if (theme === "orange") {
    document.documentElement.setAttribute("data-theme", "orange");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  setStoredTheme(theme);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getToken()));
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [mainCurrency, setMainCurrency] = useState("SGD");
  const [theme, setTheme] = useState(() => getStoredTheme() ?? "green");
  const [hiddenDashboardSections, setHiddenDashboardSections] = useState<string[]>([]);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  // Apply the cached theme immediately on first mount, before /api/auth/me
  // resolves, so there's no flash of the wrong theme.
  useEffect(() => {
    applyTheme(getStoredTheme() ?? "green");
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const me = await api.get<Me>("/api/auth/me");
      setUserId(me.id);
      setEmail(me.email);
      setTelegramLinked(me.telegram_linked);
      setMainCurrency(me.main_currency);
      setTheme(me.theme);
      applyTheme(me.theme);
      setHiddenDashboardSections(me.hidden_dashboard_sections);
      setOnboardingCompleted(me.onboarding_completed);
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false);
      setUserId(null);
      setEmail(null);
      setTelegramLinked(false);
      setMainCurrency("SGD");
      setHiddenDashboardSections([]);
      setOnboardingCompleted(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const completeOnboarding = useCallback(async () => {
    await api.post("/api/auth/complete-onboarding", {});
    await refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (getToken()) {
      refreshMe();
    } else {
      setLoading(false);
    }
  }, [refreshMe]);

  // Profile fields (main_currency/theme/telegram_linked/onboarding_completed) can
  // change from outside this tab entirely — e.g. Finn's settings-editing tools
  // writing straight to Supabase from a Telegram chat. Poll lightly and refetch
  // on tab refocus so those changes surface without a manual reload.
  useEffect(() => {
    if (!isAuthenticated) return;
    const refresh = () => {
      if (document.visibilityState === "visible") refreshMe();
    };
    const interval = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [isAuthenticated, refreshMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const { access_token } = await api.post<{ access_token: string }>("/api/auth/login", {
          email,
          password,
        });
        setToken(access_token);
        await refreshMe();
      } catch (err) {
        if (err instanceof ApiError) throw new Error(err.message || "Invalid email or password");
        throw err;
      }
    },
    [refreshMe],
  );

  const signup = useCallback(
    async (email: string, password: string) => {
      try {
        const { access_token } = await api.post<{ access_token: string }>("/api/auth/signup", {
          email,
          password,
        });
        setToken(access_token);
        await refreshMe();
      } catch (err) {
        if (err instanceof ApiError) throw new Error(err.message || "Could not create account");
        throw err;
      }
    },
    [refreshMe],
  );

  const logout = useCallback(() => {
    clearToken();
    clearStoredTheme();
    applyTheme("green");
    setIsAuthenticated(false);
    setUserId(null);
    setEmail(null);
    setTelegramLinked(false);
    setMainCurrency("SGD");
    setTheme("green");
    setHiddenDashboardSections([]);
    setOnboardingCompleted(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userId,
        email,
        telegramLinked,
        mainCurrency,
        theme,
        hiddenDashboardSections,
        onboardingCompleted,
        loading,
        login,
        signup,
        logout,
        refreshMe,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
