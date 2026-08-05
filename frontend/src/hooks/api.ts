import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qs } from "../api/client";
import type {
  Account,
  AssetSnapshot,
  BalancesSummary,
  Budget,
  BudgetStatus,
  CategoryClassification,
  ChatResult,
  CustomCategory,
  DividendForecast,
  ExpenseSummary,
  Goal,
  HoldingsSummary,
  Memory,
  Meta,
  PortfolioEvent,
  ReceiptUrl,
  Transaction,
  UploadResult,
  UploadSaved,
} from "../types";

export function useMeta() {
  return useQuery({
    queryKey: ["meta"],
    queryFn: () => api.get<Meta>("/api/meta"),
    refetchInterval: 60_000,
  });
}

export function useAccounts(types?: string[]) {
  const type = types?.join(",");
  return useQuery({
    queryKey: ["accounts", type],
    queryFn: () => api.get<Account[]>(`/api/accounts${qs({ type })}`),
    refetchInterval: 60_000,
  });
}

export function useTransactions(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["transactions", startDate, endDate],
    queryFn: () => api.get<Transaction[]>(`/api/transactions${qs({ start_date: startDate, end_date: endDate })}`),
  });
}

export function useTransactionReceipt(transactionId: string) {
  return useQuery({
    queryKey: ["transaction-receipt", transactionId],
    queryFn: () => api.get<ReceiptUrl>(`/api/transactions/${transactionId}/receipt`),
    enabled: false, // fetched on demand (icon click), not eagerly for every row in a list
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

export function useUpdateMainCurrency() {
  return useMutation({
    mutationFn: (main_currency: string) =>
      api.patch<{ main_currency: string }>("/api/auth/me", { main_currency }),
  });
}

export function useUpdateTheme() {
  return useMutation({
    mutationFn: (theme: string) => api.patch<{ theme: string }>("/api/auth/me", { theme }),
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; type: string; currency: string; comments?: string }) =>
      api.post<Account>("/api/accounts", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...fields }: { id: string; name?: string; type?: string; currency?: string; comments?: string }) =>
      api.patch<Account>(`/api/accounts/${id}`, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useCustomCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<CustomCategory[]>("/api/categories"),
    refetchInterval: 60_000,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, classification }: { name: string; classification?: CategoryClassification }) =>
      api.post<CustomCategory>("/api/categories", { name, classification }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, classification }: { id: string; name?: string; classification?: CategoryClassification }) =>
      api.patch<CustomCategory>(`/api/categories/${id}`, { name, classification }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useMemories() {
  return useQuery({
    queryKey: ["memories"],
    queryFn: () => api.get<Memory[]>("/api/memories"),
    refetchInterval: 60_000,
  });
}

export function useCreateMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.post<Memory>("/api/memories", { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories"] });
    },
  });
}

export function useDeleteMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/memories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories"] });
    },
  });
}

export function useBudgets() {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: () => api.get<Budget[]>("/api/budgets"),
  });
}

export function useBudgetStatus() {
  return useQuery({
    queryKey: ["budget-status"],
    queryFn: () => api.get<BudgetStatus[]>("/api/budgets/status"),
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { category: string; monthly_limit: number; currency: string }) =>
      api.post<Budget>("/api/budgets", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-status"] });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/budgets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-status"] });
    },
  });
}

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: () => api.get<Goal[]>("/api/goals"),
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; target_amount: number; currency: string; target_date?: string }) =>
      api.post<Goal>("/api/goals", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useContributeToGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api.post<Goal>(`/api/goals/${id}/contribute`, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/goals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
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

export function useSendChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => api.post<ChatResult>("/api/chat", { message }),
    onSuccess: (result) => {
      if (!result.needs_account_selection && result.summary != null) {
        for (const queryKey of UPLOAD_AFFECTED_QUERY_KEYS) queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}

export function useUploadChatFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.upload<UploadResult>("/api/chat/upload", formData);
    },
    onSuccess: (result) => {
      if (!result.needs_account_selection) {
        for (const queryKey of UPLOAD_AFFECTED_QUERY_KEYS) queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}

export function useCommitUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ data, accountId }: { data: Record<string, unknown>; accountId: string }) =>
      api.post<UploadSaved>("/api/chat/commit", { data, account_id: accountId }),
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
