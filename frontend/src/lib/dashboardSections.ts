export type DashboardView = "spending" | "investments";

export interface DashboardSectionMeta {
  id: string;
  view: DashboardView;
  label: string;
  /** KPI row — always visible, not offered as a checkbox. */
  pinned?: boolean;
}

export const DASHBOARD_SECTIONS: DashboardSectionMeta[] = [
  { id: "summary", view: "spending", label: "Summary KPIs", pinned: true },
  { id: "monthlyTrend", view: "spending", label: "Monthly Spend by Category" },
  { id: "byCategory", view: "spending", label: "Spend by Category" },
  { id: "incomeVsSpend", view: "spending", label: "Income vs Spend Over Time" },
  { id: "savingsRate", view: "spending", label: "Savings Rate Over Time" },
  { id: "calendar", view: "spending", label: "Spending Calendar" },
  { id: "momComparison", view: "spending", label: "Month-over-Month by Category" },
  { id: "transactions", view: "spending", label: "Recent Transactions" },
  { id: "netWorth", view: "investments", label: "Summary KPIs", pinned: true },
  { id: "netWorthOverTime", view: "investments", label: "Net Worth Over Time" },
  { id: "assetAllocation", view: "investments", label: "Asset Allocation" },
  { id: "accountBalances", view: "investments", label: "Account Balances" },
  { id: "topHoldings", view: "investments", label: "Top Holdings" },
  { id: "dividendCalendar", view: "investments", label: "Dividend Calendar" },
  { id: "dividendsByCurrency", view: "investments", label: "Dividends by Currency" },
  { id: "upcomingDividends", view: "investments", label: "Upcoming Dividends" },
  { id: "positions", view: "investments", label: "Positions" },
  { id: "trades", view: "investments", label: "Trade History" },
];

export function sectionKey(view: DashboardView, id: string): string {
  return `${view}.${id}`;
}
