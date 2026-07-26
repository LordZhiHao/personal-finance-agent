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
      api.post<{ symbols_priced: number; accounts_refreshed: number }>("/api/refresh-prices", {}),
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
