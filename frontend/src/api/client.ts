const API_URL = (import.meta.env.VITE_API_URL as string).replace(/\/+$/, "");
const TOKEN_KEY = "finance_token";
const THEME_KEY = "finance_theme";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Cached alongside the token so the correct theme can be applied to <html>
// synchronously on load, before GET /api/auth/me resolves — avoids a flash of
// the wrong theme.
export function getStoredTheme(): string | null {
  return localStorage.getItem(THEME_KEY);
}

export function setStoredTheme(theme: string): void {
  localStorage.setItem(THEME_KEY, theme);
}

export function clearStoredTheme(): void {
  localStorage.removeItem(THEME_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    // Skip Content-Type for FormData bodies — the browser sets the multipart
    // boundary itself; overriding it here would break the upload.
    ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    if (res.status === 401) clearToken();
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", body: formData }),
};

export function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  if (entries.length === 0) return "";
  return `?${new URLSearchParams(entries).toString()}`;
}
