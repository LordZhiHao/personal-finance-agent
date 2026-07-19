export interface Account {
  id: string;
  name: string;
  type: "bank" | "brokerage" | "ewallet";
  currency: string;
  is_active: boolean;
}

export interface Transaction {
  id: string;
  account_id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  currency: string;
  source: string;
  created_at: string;
  accounts: { name: string; currency: string } | null;
}

export interface PortfolioEvent {
  id: string;
  account_id: string;
  date: string;
  ticker: string;
  action: "BUY" | "SELL" | "DIVIDEND";
  quantity: number;
  price: number;
  currency: string;
  fees: number | null;
  notes: string | null;
  accounts: { name: string; currency: string } | null;
}

export interface AssetSnapshot {
  account_id: string;
  snapshot_date: string;
  total_value: number;
  currency: string;
  converted_value: number;
  notes: string | null;
  accounts: { name: string; currency: string } | null;
}

export interface Holding {
  account_name: string;
  ticker: string;
  quantity: number;
  avg_cost: number;
  cost_currency: string;
  market_value: number | null;
  cost_basis: number;
  unrealized_gain: number | null;
  unrealized_gain_pct: number | null;
}

export interface HoldingsSummary {
  holdings: Holding[];
  total_market_value: number;
  total_cost_basis: number;
  total_unrealized_gain: number;
  currency: string;
}

export interface AccountBalance {
  account_id: string;
  account_name: string;
  type: string;
  balance: number | null;
}

export interface BalancesSummary {
  balances: AccountBalance[];
  total: number;
  currency: string;
}

export interface ExpenseSummary {
  income: number;
  expenses: number;
  net: number;
  savings_rate: number;
  by_category: Record<string, number>;
}

export interface Meta {
  categories: string[];
  currencies: string[];
  account_types: string[];
  portfolio_actions: string[];
}
