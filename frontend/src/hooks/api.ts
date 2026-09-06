import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qs } from "../api/client";

// Snapshots/holdings/balances/portfolio-events/dividends don't change second-to-second,
// and each is expensive server-side (full trade-history decryption, yfinance calls) —
// a longer staleTime keeps ordinary navigation (e.g. leaving and returning to the
// Investments page) from re-firing the whole burst of queries. "Refresh Prices"
// (useRefreshPrices) explicitly invalidates snapshots/holdings/balances when the user
// wants a forced update.
const INVESTMENTS_STALE_TIME = 5 * 60_000;
import type {
  Account,
  AssetSnapshot,
  BalanceCheckpoint,
  BalancesSummary,
  Budget,
  BudgetStatus,
  CategoryClassification,
  ChatResult,
  CustomCategory,
  DividendForecast,
  DividendSummary,
  ExpenseSummary,
  Goal,
  HoldingsSummary,
  Me,
  Memory,
  Meta,
  PortfolioEvent,
  Preferences,
  ReceiptUrl,
  Rule,
  RuleMatchType,
  SuggestedPlan,
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

export function useTransactions(startDate: string, endDate: string, currency: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["transactions", startDate, endDate, currency],
    queryFn: () =>
      api.get<Transaction[]>(`/api/transactions${qs({ start_date: startDate, end_date: endDate, currency })}`),
    enabled,
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
    queryFn: ({ signal }) => api.get<AssetSnapshot[]>(`/api/snapshots${qs({ currency })}`, signal),
    staleTime: INVESTMENTS_STALE_TIME,
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
    queryFn: ({ signal }) =>
      api.get<AssetSnapshot[]>(
        `/api/snapshots/history${qs({ currency, account_id: accountId, start_date: startDate, end_date: endDate })}`,
        signal,
      ),
    staleTime: INVESTMENTS_STALE_TIME,
  });
}

export function usePortfolioEvents(
  startDate?: string,
  endDate?: string,
  currency?: string,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ["portfolio-events", startDate, endDate, currency],
    queryFn: ({ signal }) =>
      api.get<PortfolioEvent[]>(
        `/api/portfolio-events${qs({ start_date: startDate, end_date: endDate, currency })}`,
        signal,
      ),
    staleTime: INVESTMENTS_STALE_TIME,
    enabled,
  });
}

export function useResolveTicker() {
  return useMutation({
    mutationFn: (query: string) =>
      api.post<
        { ticker: string; company: string; symbol: string; exchange: string } | { error: string }
      >("/api/resolve-ticker", { query }),
  });
}

export function useHoldings(currency: string) {
  return useQuery({
    queryKey: ["holdings", currency],
    queryFn: ({ signal }) => api.get<HoldingsSummary>(`/api/holdings${qs({ currency })}`, signal),
    staleTime: INVESTMENTS_STALE_TIME,
  });
}

export function useBalances(currency: string) {
  return useQuery({
    queryKey: ["balances", currency],
    queryFn: ({ signal }) => api.get<BalancesSummary>(`/api/accounts/balances${qs({ currency })}`, signal),
    staleTime: INVESTMENTS_STALE_TIME,
  });
}

export function useBalanceHistory(accountId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["balance-history", accountId],
    queryFn: () => api.get<BalanceCheckpoint[]>(`/api/accounts/${accountId}/balance-history`),
    enabled,
  });
}

export function useCreateBalanceCheckpoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, ...payload }: { accountId: string; as_of: string; stated_balance: number; currency: string }) =>
      api.post<BalanceCheckpoint>(`/api/accounts/${accountId}/balance`, payload),
    onSuccess: (_result, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["balance-history", accountId] });
    },
  });
}

export function usePreferences() {
  return useQuery({
    queryKey: ["preferences"],
    queryFn: () => api.get<Preferences>("/api/preferences"),
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields: Partial<Preferences>) => api.patch<Preferences>("/api/preferences", fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
  });
}

export function useDividendForecast() {
  return useQuery({
    queryKey: ["dividend-forecast"],
    queryFn: ({ signal }) => api.get<DividendForecast[]>("/api/dividend-forecast", signal),
    staleTime: INVESTMENTS_STALE_TIME,
  });
}

export function useDividendSummary(currency: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["dividend-summary", currency, startDate, endDate],
    queryFn: ({ signal }) =>
      api.get<DividendSummary>(
        `/api/dividends/summary${qs({ currency, start_date: startDate, end_date: endDate })}`,
        signal,
      ),
    staleTime: INVESTMENTS_STALE_TIME,
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
      queryClient.invalidateQueries({ queryKey: ["balances"] });
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

export function useUpdateHiddenDashboardSections() {
  return useMutation({
    mutationFn: (hidden_dashboard_sections: string[]) =>
      api.patch<{ hidden_dashboard_sections: string[] }>("/api/auth/me", { hidden_dashboard_sections }),
  });
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<Me>("/api/auth/me"),
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields: Partial<Me>) => api.patch<Me>("/api/auth/me", fields),
    // Returning (not just calling) invalidateQueries makes TanStack Query await the
    // refetch before running a caller's own onSuccess — AboutYouStep chains a second
    // useUpdateMe() call and navigates on success, so without this the "me" cache can
    // still be one write behind when the next step reads it (e.g. PlanStep briefly
    // showing the pre-update persona).
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useSuggestedPlan() {
  return useQuery({
    queryKey: ["suggested-plan"],
    queryFn: () => api.get<SuggestedPlan>("/api/onboarding/suggested-plan"),
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

export function useRules() {
  return useQuery({
    queryKey: ["rules"],
    queryFn: () => api.get<Rule[]>("/api/rules"),
    refetchInterval: 60_000,
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ match_type, pattern, category }: { match_type: RuleMatchType; pattern: string; category: string }) =>
      api.post<Rule>("/api/rules", { match_type, pattern, category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
  });
}

export function useUpdateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...fields }: { id: string; match_type?: RuleMatchType; pattern?: string; category?: string }) =>
      api.patch<Rule>(`/api/rules/${id}`, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
  });
}

export function useApplyRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => api.post<{ updated_count: number }>(`/api/rules/${id}/apply`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["expense-summary"] });
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
