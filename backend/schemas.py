from datetime import date
from datetime import date as _date

from pydantic import BaseModel, field_validator, model_validator

from utils.constants import (
    ACCOUNT_TYPES,
    CLASSIFICATIONS,
    CURRENCIES,
    GENDERS,
    MARITAL_STATUSES,
    PERSONAS,
    PORTFOLIO_ACTIONS,
    RULE_MATCH_TYPES,
)


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    email: str
    password: str

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes.")
        return v


class AccountCreate(BaseModel):
    name: str
    type: str
    currency: str
    comments: str | None = None

    @field_validator("type")
    @classmethod
    def type_valid(cls, v: str) -> str:
        if v not in ACCOUNT_TYPES:
            raise ValueError(f"type must be one of {ACCOUNT_TYPES}")
        return v

    @field_validator("currency")
    @classmethod
    def currency_valid(cls, v: str) -> str:
        if v not in CURRENCIES:
            raise ValueError(f"currency must be one of {CURRENCIES}")
        return v

    @field_validator("comments")
    @classmethod
    def comments_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 500:
            raise ValueError("Comments must be at most 500 characters.")
        return v


class AccountUpdate(BaseModel):
    """All fields optional for partial updates from the Settings page's account rows —
    only fields the client actually changed are sent (exclude_unset)."""
    name: str | None = None
    type: str | None = None
    currency: str | None = None
    comments: str | None = None

    @field_validator("type")
    @classmethod
    def type_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in ACCOUNT_TYPES:
            raise ValueError(f"type must be one of {ACCOUNT_TYPES}")
        return v

    @field_validator("currency")
    @classmethod
    def currency_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in CURRENCIES:
            raise ValueError(f"currency must be one of {CURRENCIES}")
        return v

    @field_validator("comments")
    @classmethod
    def comments_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 500:
            raise ValueError("Comments must be at most 500 characters.")
        return v


class BalanceCheckpointCreate(BaseModel):
    """A user-stated balance correction for a bank/ewallet account — see
    db.supabase.create_balance_checkpoint / utils/balances.py."""
    as_of: date
    stated_balance: float
    currency: str

    @field_validator("currency")
    @classmethod
    def currency_valid(cls, v: str) -> str:
        if v not in CURRENCIES:
            raise ValueError(f"currency must be one of {CURRENCIES}")
        return v


class PreferencesUpdate(BaseModel):
    """Partial update for the "How Finn behaves" Settings card — a separate endpoint
    from MeUpdate/GET /api/auth/me by design (see CLAUDE.md's api-gaps notes on
    Preferences), not folded into the profile payload."""
    budget_nudge_threshold: float | None = None
    weekly_recap: bool | None = None

    @field_validator("budget_nudge_threshold")
    @classmethod
    def threshold_valid(cls, v: float | None) -> float | None:
        if v is not None and not (1 <= v <= 100):
            raise ValueError("budget_nudge_threshold must be between 1 and 100.")
        return v


class MeUpdate(BaseModel):
    """Partial update for the current user's own profile fields (Settings page)."""
    main_currency: str | None = None
    theme: str | None = None
    hidden_dashboard_sections: list[str] | None = None
    name: str | None = None
    age: int | None = None
    gender: str | None = None
    gender_other_text: str | None = None
    marital_status: str | None = None
    marital_status_other_text: str | None = None
    num_kids: int | None = None
    num_pets: int | None = None
    persona: str | None = None
    persona_custom_text: str | None = None
    monthly_income: float | None = None

    @field_validator("main_currency")
    @classmethod
    def currency_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in CURRENCIES:
            raise ValueError(f"main_currency must be one of {CURRENCIES}")
        return v

    @field_validator("theme")
    @classmethod
    def theme_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in ("orange", "green"):
            raise ValueError("theme must be one of ('orange', 'green')")
        return v

    @field_validator("hidden_dashboard_sections")
    @classmethod
    def hidden_dashboard_sections_valid(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        if len(v) > 50:
            raise ValueError("hidden_dashboard_sections must have at most 50 entries.")
        cleaned: list[str] = []
        for item in v:
            item = item.strip()
            if item and item not in cleaned:
                cleaned.append(item)
        return cleaned

    @field_validator("name")
    @classmethod
    def name_valid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if len(v) > 100:
            raise ValueError("name must be at most 100 characters.")
        return v

    @field_validator("age")
    @classmethod
    def age_valid(cls, v: int | None) -> int | None:
        if v is not None and not (13 <= v <= 120):
            raise ValueError("age must be between 13 and 120.")
        return v

    @field_validator("gender")
    @classmethod
    def gender_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in GENDERS:
            raise ValueError(f"gender must be one of {GENDERS}")
        return v

    @field_validator("marital_status")
    @classmethod
    def marital_status_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in MARITAL_STATUSES:
            raise ValueError(f"marital_status must be one of {MARITAL_STATUSES}")
        return v

    @field_validator("gender_other_text", "marital_status_other_text", "persona_custom_text")
    @classmethod
    def other_text_valid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if len(v) > 300:
            raise ValueError("must be at most 300 characters.")
        return v

    @field_validator("num_kids", "num_pets")
    @classmethod
    def count_valid(cls, v: int | None) -> int | None:
        if v is not None and not (0 <= v <= 20):
            raise ValueError("must be between 0 and 20.")
        return v

    @field_validator("persona")
    @classmethod
    def persona_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in PERSONAS:
            raise ValueError(f"persona must be one of {list(PERSONAS)}")
        return v

    @field_validator("monthly_income")
    @classmethod
    def monthly_income_valid(cls, v: float | None) -> float | None:
        if v is not None and v < 0:
            raise ValueError("monthly_income must be >= 0.")
        return v


class CustomCategoryUpdate(BaseModel):
    """Both fields optional for partial updates (exclude_unset=True) — a request can
    rename, reclassify, or both."""
    name: str | None = None
    classification: str | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Category name is required.")
        return v

    @field_validator("classification")
    @classmethod
    def classification_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in CLASSIFICATIONS:
            raise ValueError(f"classification must be one of {CLASSIFICATIONS}")
        return v


class TransactionUpdate(BaseModel):
    """description/amount/category/account_id are editable from the frontend's
    transactions table (date remains read-only, matching dashboard/views/spending.py,
    which stays untouched and only ever sends description/category). amount keeps the
    existing sign convention (negative = expense) — the frontend sends the raw signed
    value, unchanged here."""
    description: str | None = None
    amount: float | None = None
    category: str | None = None
    account_id: str | None = None


class TransactionCreate(BaseModel):
    account_id: str
    date: date
    description: str
    amount: float
    category: str
    currency: str

    @field_validator("category")
    @classmethod
    def category_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("category is required")
        return v
    # Membership against the user's full category list (built-in + custom) can't be
    # checked here — this validator has no access to user_id — so it's enforced in
    # backend/routers/spending.py::create_transaction instead, via get_categories_for_user.


class CategoryCreate(BaseModel):
    name: str
    classification: str = "expense"

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Category name is required.")
        return v

    @field_validator("classification")
    @classmethod
    def classification_valid(cls, v: str) -> str:
        if v not in CLASSIFICATIONS:
            raise ValueError(f"classification must be one of {CLASSIFICATIONS}")
        return v


class RuleCreate(BaseModel):
    match_type: str
    pattern: str
    category: str

    @field_validator("match_type")
    @classmethod
    def match_type_valid(cls, v: str) -> str:
        if v not in RULE_MATCH_TYPES:
            raise ValueError(f"match_type must be one of {RULE_MATCH_TYPES}")
        return v

    @field_validator("pattern")
    @classmethod
    def pattern_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Pattern is required.")
        return v

    @field_validator("category")
    @classmethod
    def category_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Category is required.")
        return v


class RuleUpdate(BaseModel):
    """All fields optional for partial updates — only fields the client actually changed
    are sent (exclude_unset=True)."""
    match_type: str | None = None
    pattern: str | None = None
    category: str | None = None

    @field_validator("match_type")
    @classmethod
    def match_type_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in RULE_MATCH_TYPES:
            raise ValueError(f"match_type must be one of {RULE_MATCH_TYPES}")
        return v

    @field_validator("pattern")
    @classmethod
    def pattern_not_blank(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Pattern is required.")
        return v

    @field_validator("category")
    @classmethod
    def category_not_blank(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Category is required.")
        return v


class BudgetCreate(BaseModel):
    category: str
    monthly_limit: float
    currency: str

    @field_validator("category")
    @classmethod
    def category_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Category is required.")
        return v

    @field_validator("monthly_limit")
    @classmethod
    def limit_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("monthly_limit must be greater than 0.")
        return v

    @field_validator("currency")
    @classmethod
    def currency_valid(cls, v: str) -> str:
        if v not in CURRENCIES:
            raise ValueError(f"currency must be one of {CURRENCIES}")
        return v


class BudgetUpdate(BaseModel):
    """All fields optional for partial updates — only fields the client actually changed are sent."""
    category: str | None = None
    monthly_limit: float | None = None
    currency: str | None = None

    @field_validator("monthly_limit")
    @classmethod
    def limit_positive(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("monthly_limit must be greater than 0.")
        return v

    @field_validator("currency")
    @classmethod
    def currency_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in CURRENCIES:
            raise ValueError(f"currency must be one of {CURRENCIES}")
        return v


class GoalCreate(BaseModel):
    name: str
    target_amount: float
    currency: str
    target_date: date | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required.")
        return v

    @field_validator("target_amount")
    @classmethod
    def target_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("target_amount must be greater than 0.")
        return v

    @field_validator("currency")
    @classmethod
    def currency_valid(cls, v: str) -> str:
        if v not in CURRENCIES:
            raise ValueError(f"currency must be one of {CURRENCIES}")
        return v


class GoalUpdate(BaseModel):
    """All fields optional for partial updates — only fields the client actually changed are sent."""
    name: str | None = None
    target_amount: float | None = None
    currency: str | None = None
    target_date: date | None = None

    @field_validator("target_amount")
    @classmethod
    def target_positive(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("target_amount must be greater than 0.")
        return v

    @field_validator("currency")
    @classmethod
    def currency_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in CURRENCIES:
            raise ValueError(f"currency must be one of {CURRENCIES}")
        return v


class GoalContribute(BaseModel):
    amount: float

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("amount must be greater than 0.")
        return v


class MemoryCreate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Memory content is required.")
        return v


class TickerResolveRequest(BaseModel):
    """Backs the Add Trade dialog's "Resolve" button — a free-text company name/
    nickname/ticker to resolve via bot/ticker_resolver.py::resolve_ticker."""
    query: str

    @field_validator("query")
    @classmethod
    def query_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Query is required.")
        return v


class PortfolioEventCreate(BaseModel):
    account_id: str
    date: date
    ticker: str
    action: str
    quantity: float
    price: float
    currency: str
    fees: float | None = None
    notes: str | None = None

    @field_validator("ticker")
    @classmethod
    def ticker_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Ticker Symbol is required.")
        return v.strip().upper()

    @field_validator("action")
    @classmethod
    def action_valid(cls, v: str) -> str:
        if v not in PORTFOLIO_ACTIONS:
            raise ValueError(f"action must be one of {PORTFOLIO_ACTIONS}")
        return v

    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Quantity must be greater than 0.")
        return v

    @model_validator(mode="after")
    def price_positive_unless_dividend(self):
        if self.price <= 0 and self.action != "DIVIDEND":
            raise ValueError("Price must be greater than 0.")
        return self


class ChatRequest(BaseModel):
    message: str

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty.")
        if len(v) > 2000:
            raise ValueError("Message is too long (max 2000 characters).")
        return v


class ChatResponse(BaseModel):
    reply: str | None = None
    needs_account_selection: bool = False
    data: dict | None = None
    candidates: list[dict] | None = None
    summary: str | None = None
    lines: list[str] | None = None
    transaction_ids: list[str] | None = None
    portfolio_event_ids: list[str] | None = None


class ChatCommitRequest(BaseModel):
    """Finalizes an upload that POST /api/chat/upload couldn't confidently assign to an
    account — `data` is the already-extracted dict returned in that response's
    `needs_account_selection` branch, passed back verbatim (no re-extraction)."""
    data: dict
    account_id: str


class PortfolioEventUpdate(BaseModel):
    """All fields optional for partial updates from the trade history table's inline
    editor — only fields the client actually changed are sent (exclude_unset)."""
    account_id: str | None = None
    # _date alias avoids self-shadowing: "date: date | None = None" stores None to the
    # class-body name `date` before the annotation is evaluated, so a bare `date` here
    # would resolve to None instead of the datetime.date class.
    date: _date | None = None
    ticker: str | None = None
    action: str | None = None
    quantity: float | None = None
    price: float | None = None
    currency: str | None = None
    fees: float | None = None
    notes: str | None = None

    @field_validator("ticker")
    @classmethod
    def ticker_not_blank(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not v.strip():
            raise ValueError("Ticker Symbol is required.")
        return v.strip().upper()

    @field_validator("action")
    @classmethod
    def action_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in PORTFOLIO_ACTIONS:
            raise ValueError(f"action must be one of {PORTFOLIO_ACTIONS}")
        return v

    @field_validator("quantity")
    @classmethod
    def quantity_positive(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("Quantity must be greater than 0.")
        return v

    @model_validator(mode="after")
    def price_positive_unless_dividend(self):
        # A partial update may set price without touching action (or vice versa) — only
        # enforce when action was explicitly included in this request, since otherwise
        # we can't tell if the row's existing (unset-here) action is DIVIDEND.
        if self.price is not None and self.price <= 0 and "action" in self.model_fields_set:
            if self.action != "DIVIDEND":
                raise ValueError("Price must be greater than 0.")
        return self
