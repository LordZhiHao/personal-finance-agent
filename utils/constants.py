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
