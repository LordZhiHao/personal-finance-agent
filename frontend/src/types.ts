export interface Account {
  id: string;
  name: string;
  type: "bank" | "brokerage" | "ewallet";
  currency: string;
  is_active: boolean;
  comments: string | null;
}

// "expense" is real spending; "income"/"transfer"/"investment" are excluded from
// spend totals, budgets, and subscription detection — see utils/constants.py's
// CLASSIFICATIONS on the backend.
export type CategoryClassification = "expense" | "income" | "transfer" | "investment";

export interface CustomCategory {
  id: string;
  name: string;
  classification: CategoryClassification;
}

export interface Memory {
  id: string;
  content: string;
  source: "agent" | "manual";
  created_at: string;
}

export interface Budget {
  id: string;
  category: string;
  monthly_limit: number;
  currency: string;
  last_alerted_month: string | null;
  created_at: string;
}

export interface BudgetStatus {
  id: string;
  category: string;
  monthly_limit: number;
  currency: string;
  spent: number;
}

export interface Goal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  currency: string;
  created_at: string;
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
  receipt_id: string | null;
  accounts: { name: string; currency: string } | null;
}

export interface ReceiptUrl {
  url: string;
  content_type: string;
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
  name: string | null;
  price: number | null;
  price_currency: string | null;
  quantity: number;
  avg_cost: number;
  cost_currency: string;
  market_value: number | null;
  cost_basis: number;
  unrealized_gain: number | null;
  unrealized_gain_pct: number | null;
  native_market_value: number | null;
  native_cost_basis: number;
  native_unrealized_gain: number | null;
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
  invested: number;
  net: number;
  savings_rate: number;
  by_category: Record<string, number>;
}

export interface Meta {
  categories: string[];
  category_classifications: Record<string, CategoryClassification>;
  classifications: CategoryClassification[];
  currencies: string[];
  account_types: string[];
  portfolio_actions: string[];
}

export interface Me {
  id: string;
  email: string;
  telegram_linked: boolean;
  main_currency: string;
  theme: string;
  hidden_dashboard_sections: string[];
  onboarding_completed: boolean;
}

export interface AccountCandidate {
  id: string;
  name: string;
  type: string;
  currency: string;
}

export interface UploadSaved {
  needs_account_selection: false;
  summary: string;
  lines: string[];
  transaction_ids: string[];
  portfolio_event_ids: string[];
}

export interface UploadNeedsAccount {
  needs_account_selection: true;
  data: Record<string, unknown>;
  candidates: AccountCandidate[];
}

export type UploadResult = UploadSaved | UploadNeedsAccount;

export interface ChatResult {
  reply: string | null;
  needs_account_selection: boolean;
  data: Record<string, unknown> | null;
  candidates: AccountCandidate[] | null;
  summary: string | null;
  lines: string[] | null;
  transaction_ids: string[] | null;
  portfolio_event_ids: string[] | null;
}

export interface DividendForecast {
  ticker: string;
  ex_dividend_date: string | null;
  dividend_rate: number | null;
  dividend_yield: number | null;
  currency?: string;
}
