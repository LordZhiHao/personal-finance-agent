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

# A category's classification controls whether it counts as spending. "expense" is
# the default for every built-in not listed here and for every custom category unless
# the user picks otherwise (see migrations/0015_category_classification.sql). Negative-
# amount rows in a non-"expense" category are excluded from spend totals/budgets/
# subscription detection — see scheduler/report_builder.py::summarize_transactions.
CLASSIFICATIONS = ["expense", "income", "transfer", "investment"]

BUILTIN_CATEGORY_CLASSIFICATIONS = {
    "Salary": "income",
    "Investment": "investment",
    "Transfer": "transfer",
}

CURRENCIES = ["SGD", "MYR", "USD"]

DEFAULT_CURRENCY = "SGD"

GENDERS = ["female", "male", "non_binary", "other"]

MARITAL_STATUSES = ["single", "married", "divorced", "widowed", "other"]

# Curated onboarding/Settings personas. Each entry personalizes Finn (see
# bot/finance_agent.py::_profile_block) via `prompt_blurb` (third-person, injected
# into the system prompt) and offers an onboarding starter budget/goal via
# `starter_suggestion` (None, or {"type": "goal"|"budget", ...fields..., "description"}
# — modest generic defaults since no real financial data exists yet; currency is filled
# in at accept-time from the user's main_currency, not baked in here). "other" is the
# free-text escape hatch: its prompt_blurb has a {custom_text} placeholder filled in at
# read time from users.persona_custom_text, and it has no starter suggestion.
PERSONAS = {
    "fresh_grad": {
        "label": "Fresh grad / student",
        "ui_description": "Just starting out and building your financial habits.",
        "prompt_blurb": (
            "This user identifies as a fresh graduate or student, early in their financial "
            "journey and likely on a limited or variable income. Keep advice approachable and "
            "jargon-free, favor small concrete steps over aggressive investment talk, and don't "
            "assume they have significant savings, a mortgage, or dependents."
        ),
        "starter_suggestion": {
            "type": "goal",
            "name": "Emergency Fund",
            "target_amount": 1000,
            "description": "A small starter cushion for unexpected costs while you're just getting going.",
        },
    },
    "young_professional": {
        "label": "Young professional",
        "ui_description": "Steady income, building habits and starting to invest.",
        "prompt_blurb": (
            "This user is an early-career working professional with a steady income, likely "
            "focused on consistent budgeting, building an emergency fund, and starting to invest. "
            "Advice can be a bit more ambitious than for a student, but avoid assuming a high net "
            "worth, kids, or a mortgage yet."
        ),
        "starter_suggestion": {
            "type": "budget",
            "category": "Entertainment",
            "monthly_limit": 200,
            "description": "A starter budget for discretionary spend — a common first budget once income is steady.",
        },
    },
    "parent_family": {
        "label": "Parent / family",
        "ui_description": "Raising a family and juggling household costs.",
        "prompt_blurb": (
            "This user is raising a family — factor in household and childcare costs, saving for "
            "kids' education, and balancing family needs against personal financial goals. Assume "
            "less spending flexibility than a single professional, and be mindful that big-ticket "
            "'family' expenses (school fees, childcare, insurance) are often non-negotiable."
        ),
        "starter_suggestion": {
            "type": "budget",
            "category": "Childcare",
            "monthly_limit": 500,
            "description": "A starter budget line for childcare/family costs — adjust it to match your real spend.",
        },
    },
    "debt_payoff": {
        "label": "Paying off debt",
        "ui_description": "Focused on knocking out credit cards, loans, or other debt.",
        "prompt_blurb": (
            "This user is focused on paying off debt (credit cards, student loans, etc.). "
            "Emphasize practical debt-reduction strategies, be encouraging about progress, and be "
            "cautious about recommending discretionary spending or new investments before "
            "higher-interest debt is addressed — gently flag it if a question seems to prioritize "
            "investing over payoff without the user raising that tradeoff first."
        ),
        "starter_suggestion": {
            "type": "goal",
            "name": "Debt Payoff",
            "target_amount": 5000,
            "description": "A placeholder target — edit the amount in Settings once you know your real payoff figure.",
        },
    },
    "saver_investor": {
        "label": "Saver / investor",
        "ui_description": "Comfortable with the basics and focused on growing wealth.",
        "prompt_blurb": (
            "This user is focused on saving and investing — comfortable with financial basics and "
            "looking to optimize returns, diversify, and grow wealth efficiently. Feel free to go "
            "deeper on investment nuance (asset allocation, dividend tracking, fees) than with other "
            "personas, while still grounding answers in this user's actual holdings via tools."
        ),
        "starter_suggestion": {
            "type": "goal",
            "name": "Investment Boost",
            "target_amount": 3000,
            "description": "A starter target for extra investable savings beyond your emergency fund.",
        },
    },
    "retiree": {
        "label": "Retiree / near-retirement",
        "ui_description": "Focused on preserving savings and planning withdrawals.",
        "prompt_blurb": (
            "This user is retired or near retirement — likely prioritizing capital preservation, "
            "predictable income/withdrawal planning, and healthcare costs over aggressive growth or "
            "debt payoff. Avoid assuming active employment income; frame advice around drawing down "
            "savings sustainably rather than accumulating."
        ),
        "starter_suggestion": {
            "type": "budget",
            "category": "Health",
            "monthly_limit": 300,
            "description": "A starter budget for healthcare/medical costs — a common focus in retirement planning.",
        },
    },
    "other": {
        "label": "Other — describe your own",
        "ui_description": "None of these quite fit — tell us in your own words.",
        "prompt_blurb": (
            "This user described their own financial situation instead of picking a preset "
            'persona: "{custom_text}". Use that description to inform tone and advice — don\'t '
            "assume specifics that weren't stated."
        ),
        "starter_suggestion": None,
    },
}

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

# Fields that are stored encrypted (see utils/crypto.py, db.supabase's _encrypt_*/
# _decrypt_* row helpers) and therefore can't be filtered/compared at the Postgres
# level — db.supabase.query_records applies these filters in Python, post-decrypt,
# instead of pushing them into the query builder like every other filter.
ENCRYPTED_QUERYABLE_FIELDS = {
    "transactions": {"amount", "description"},
    "portfolio_events": {"quantity", "price"},
    "asset_snapshots": {"total_value"},
}

# Upper bound on rows fetched for query_records when any requested filter is on an
# encrypted field (so it can't be pushed into the SQL WHERE clause) — still bounded
# by the caller-required start_date/end_date, this is just a hard ceiling so an
# unusually wide date range can't pull an unbounded number of rows into memory.
QUERYABLE_ROW_FETCH_CAP = 2000
