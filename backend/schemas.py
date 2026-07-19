from datetime import date

from pydantic import BaseModel, field_validator, model_validator

from utils.constants import PORTFOLIO_ACTIONS


class LoginRequest(BaseModel):
    email: str
    password: str


class TransactionUpdate(BaseModel):
    """Only category/description are editable from the dashboard's transactions
    table — amount/date/account are read-only, matching dashboard/views/spending.py."""
    description: str | None = None
    category: str | None = None


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
