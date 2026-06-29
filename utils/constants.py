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

ACCOUNT_TYPES = ["bank", "brokerage", "ewallet"]

PORTFOLIO_ACTIONS = ["BUY", "SELL", "DIVIDEND"]

# Maps a raw ticker (as extracted by Gemini from a broker screenshot, e.g. "CSPX")
# to its Yahoo Finance symbol. Only needed for non-US listings, since yfinance
# requires an exchange suffix for those (SGX -> ".SI", Bursa Malaysia -> ".KL",
# LSE -> ".L"). Plain US tickers (e.g. "AAPL") don't need an entry — the equity
# price updater falls back to the raw ticker when no mapping exists.
TICKER_YFINANCE_MAP = {
    "CSPX": "CSPX.L",
}
