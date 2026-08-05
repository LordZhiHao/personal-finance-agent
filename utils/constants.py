CATEGORIES = [
    "Food & Drink",
    "Transport",
    "Shopping",
    "Groceries",
    "Entertainment",
    "Health",
    "Utilities",
    "Salary",
    "Investment",
    "Transfer",
    "Other",
]

CURRENCIES = ["SGD", "MYR", "USD"]

DEFAULT_CURRENCY = "SGD"

DASHBOARD_URL = "https://personal-finance-agent-kappa.vercel.app/"

ACCOUNT_TYPES = ["bank", "brokerage", "ewallet"]

# Accent color per user theme choice, used only by scheduler/emailer.py's weekly
# report HTML (the frontend gets its own copy of these values as CSS custom
# properties in frontend/src/index.css — keep both in sync by hand, there's no
# shared source of truth across Python and CSS).
THEME_COLORS = {
    "orange": "#eb6834",
    "green": "#00ad6c",
}

PORTFOLIO_ACTIONS = ["BUY", "SELL", "DIVIDEND"]

# Maps a raw ticker (as extracted by Gemini from a broker screenshot, e.g. "CSPX")
# to its Yahoo Finance symbol. Only needed for non-US listings, since yfinance
# requires an exchange suffix for those (SGX -> ".SI", Bursa Malaysia -> ".KL",
# LSE -> ".L"). Plain US tickers (e.g. "AAPL") don't need an entry — the equity
# price updater falls back to the raw ticker when no mapping exists.
TICKER_YFINANCE_MAP = {
    "CSPX": "CSPX.L",
}

# Hard allowlist for bot/finance_agent.py's query_financial_records tool
# (db.supabase.query_records) — the finance Q&A agent can only read tables/fields
# listed here, and can never construct raw SQL, so this dict is the entire
# reachable surface for that tool regardless of what the model requests.
# "scope" selects how query_records applies tenant isolation: "account" filters
# via get_account_ids_for_user (tables with no direct user_id column), "user"
# filters via a direct user_id column.
QUERYABLE_SCHEMA = {
    "transactions": {
        "scope": "account",
        "date_field": "date",
        "fields": {
            "date": "date",
            "description": "text",
            "amount": "number",
            "category": "text",
            "currency": "text",
            "source": "text",
        },
        "groupable_fields": ["category", "currency", "source"],
        "metric_field": "amount",
    },
    "portfolio_events": {
        "scope": "account",
        "date_field": "date",
        "fields": {
            "date": "date",
            "ticker": "text",
            "action": "text",
            "quantity": "number",
            "price": "number",
            "currency": "text",
        },
        "groupable_fields": ["ticker", "action", "currency"],
        "metric_field": None,
    },
    "asset_snapshots": {
        "scope": "account",
        "date_field": "snapshot_date",
        "fields": {
            "snapshot_date": "date",
            "total_value": "number",
            "currency": "text",
        },
        "groupable_fields": ["currency"],
        "metric_field": "total_value",
    },
}

# Operators the query_financial_records tool may use, mapped to supabase-py query
# builder methods in db.supabase._apply_operator. Each is further restricted per
# field type there (e.g. "like" only applies to "text" fields).
QUERYABLE_OPERATORS = {
    "=": "eq",
    "!=": "neq",
    ">": "gt",
    ">=": "gte",
    "<": "lt",
    "<=": "lte",
    "in": "in_",
    "like": "ilike",
}

QUERYABLE_MAX_LIMIT = 200
