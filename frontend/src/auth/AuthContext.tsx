import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, clearToken, getToken, setToken, ApiError } from "../api/client";

interface Me {
  id: string;
  email: string;
  telegram_linked: boolean;
  main_currency: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  telegramLinked: boolean;
  mainCurrency: string;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getToken()));
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [mainCurrency, setMainCurrency] = useState("SGD");
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  const refreshMe = useCallback(async () => {
    try {
      const me = await api.get<Me>("/api/auth/me");
      setUserId(me.id);
      setEmail(me.email);
      setTelegramLinked(me.telegram_linked);
      setMainCurrency(me.main_currency);
      setIsAuthenticated(true);
    } catch {
      setIsAuthenticated(false);
      setUserId(null);
      setEmail(null);
      setTelegramLinked(false);
      setMainCurrency("SGD");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getToken()) {
      refreshMe();
    } else {
      setLoading(false);
    }
  }, [refreshMe]);

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
    setIsAuthenticated(false);
    setUserId(null);
    setEmail(null);
    setTelegramLinked(false);
    setMainCurrency("SGD");
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, userId, email, telegramLinked, mainCurrency, loading, login, signup, logout, refreshMe }}
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
