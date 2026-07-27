import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qs } from "../api/client";
import type {
  Account,
  AssetSnapshot,
  BalancesSummary,
  DividendForecast,
  ExpenseSummary,
  HoldingsSummary,
  Meta,
  PortfolioEvent,
  Transaction,
  UploadResult,
} from "../types";

export function useMeta() {
  return useQuery({ queryKey: ["meta"], queryFn: () => api.get<Meta>("/api/meta") });
}

export function useAccounts(types?: string[]) {
  const type = types?.join(",");
  return useQuery({
    queryKey: ["accounts", type],
    queryFn: () => api.get<Account[]>(`/api/accounts${qs({ type })}`),
  });
}

export function useTransactions(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["transactions", startDate, endDate],
    queryFn: () => api.get<Transaction[]>(`/api/transactions${qs({ start_date: startDate, end_date: endDate })}`),
  });
}

export function useExpenseSummary(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["expense-summary", startDate, endDate],
    queryFn: () =>
      api.get<ExpenseSummary>(`/api/transactions/summary${qs({ start_date: startDate, end_date: endDate })}`),
  });
}

export function useSnapshots(currency: string) {
  return useQuery({
    queryKey: ["snapshots", currency],
    queryFn: () => api.get<AssetSnapshot[]>(`/api/snapshots${qs({ currency })}`),
  });
}

export function useSnapshotHistory(
  currency: string,
  accountId?: string,
  startDate?: string,
  endDate?: string,
) {
  return useQuery({
    queryKey: ["snapshots-history", currency, accountId, startDate, endDate],
    queryFn: () =>
      api.get<AssetSnapshot[]>(
        `/api/snapshots/history${qs({ currency, account_id: accountId, start_date: startDate, end_date: endDate })}`,
      ),
  });
}

export function usePortfolioEvents(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["portfolio-events", startDate, endDate],
    queryFn: () =>
      api.get<PortfolioEvent[]>(`/api/portfolio-events${qs({ start_date: startDate, end_date: endDate })}`),
  });
}

export function useHoldings(currency: string) {
  return useQuery({
    queryKey: ["holdings", currency],
    queryFn: () => api.get<HoldingsSummary>(`/api/holdings${qs({ currency })}`),
  });
}

export function useBalances(currency: string) {
  return useQuery({
    queryKey: ["balances", currency],
    queryFn: () => api.get<BalancesSummary>(`/api/accounts/balances${qs({ currency })}`),
  });
}

export function useDividendForecast() {
  return useQuery({
    queryKey: ["dividend-forecast"],
    queryFn: () => api.get<DividendForecast[]>("/api/dividend-forecast"),
  });
}

export function useRefreshPrices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ symbols_priced: number; symbols_failed: string[]; accounts_refreshed: number }>(
        "/api/refresh-prices",
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
    },
  });
}

export function useGenerateTelegramLinkCode() {
  return useMutation({
    mutationFn: () => api.post<{ code: string; ttl_minutes: number }>("/api/telegram-link", {}),
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; type: string; currency: string }) =>
      api.post<Account>("/api/accounts", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<{ id: string; name: string }>("/api/categories", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta"] });
    },
  });
}

export function useSendChatMessage() {
  return useMutation({
    mutationFn: (message: string) => api.post<{ reply: string }>("/api/chat", { message }),
  });
}

const UPLOAD_AFFECTED_QUERY_KEYS = [
  ["transactions"],
  ["expense-summary"],
  ["portfolio-events"],
  ["holdings"],
  ["balances"],
  ["snapshots"],
];

export function useUploadChatFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, accountId }: { file: File; accountId: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("account_id", accountId);
      return api.upload<UploadResult>("/api/chat/upload", formData);
    },
    onSuccess: () => {
      for (const queryKey of UPLOAD_AFFECTED_QUERY_KEYS) queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useUndoUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ transactionIds, portfolioEventIds }: { transactionIds: string[]; portfolioEventIds: string[] }) => {
      await Promise.all([
        ...transactionIds.map((id) => api.delete(`/api/transactions/${id}`)),
        ...portfolioEventIds.map((id) => api.delete(`/api/portfolio-events/${id}`)),
      ]);
    },
    onSuccess: () => {
      for (const queryKey of UPLOAD_AFFECTED_QUERY_KEYS) queryClient.invalidateQueries({ queryKey });
    },
  });
}
