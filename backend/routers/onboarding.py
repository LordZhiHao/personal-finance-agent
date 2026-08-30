from datetime import date, timedelta

from fastapi import APIRouter, Depends

from backend.auth import get_current_user
from db.supabase import get_category_classifications_for_user, get_transactions, get_user_by_id
from scheduler.report_builder import summarize_transactions_fx
from utils.constants import DEFAULT_CURRENCY

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

# Tunable thresholds for the "Your plan" step's real-data-vs-fallback branch — both
# must hold, not either: a handful of backdated transactions entered minutes after
# signup shouldn't be treated as a real 90-day habit (see CLAUDE.md/roadmap notes on
# this endpoint for the full reasoning). Kept as module constants for easy tuning
# without touching the frontend.
MIN_TRANSACTIONS = 10
MIN_DAYS_SINCE_SIGNUP = 14

WINDOW_DAYS = 90


def _round_to_nearest_10(amount: float) -> float:
    return round(amount / 10) * 10


@router.get("/suggested-plan")
def get_suggested_plan(user_id: str = Depends(get_current_user)):
    """Proposes per-category monthly spending limits from the caller's own 90-day
    transaction history, for the onboarding wizard's "Your plan" step. Amounts are
    FX-converted to the caller's main_currency (see summarize_transactions_fx) since
    this is new code with no legacy unconverted callers to stay compatible with."""
    user = get_user_by_id(user_id)
    currency = (user or {}).get("main_currency") or DEFAULT_CURRENCY

    window_start = date.today() - timedelta(days=WINDOW_DAYS)
    txns = get_transactions(window_start.isoformat(), date.today().isoformat(), user_id)
    classifications = get_category_classifications_for_user(user_id)
    summary = summarize_transactions_fx(txns, classifications, currency)

    days_since_signup = WINDOW_DAYS
    created_at = (user or {}).get("created_at")
    if created_at:
        days_since_signup = (date.today() - date.fromisoformat(created_at[:10])).days

    has_enough_data = len(txns) >= MIN_TRANSACTIONS and days_since_signup >= MIN_DAYS_SINCE_SIGNUP

    typical_month_expenses = summary["expenses"] / (WINDOW_DAYS / 30)
    monthly_income = (user or {}).get("monthly_income")
    left_to_plan = (monthly_income - typical_month_expenses) if monthly_income is not None else None

    categories = []
    for category, total in summary["by_category"].items():
        avg_monthly = total / (WINDOW_DAYS / 30)
        categories.append(
            {
                "category": category,
                "avg_monthly": round(avg_monthly, 2),
                "suggested_limit": _round_to_nearest_10(avg_monthly),
            }
        )

    return {
        "has_enough_data": has_enough_data,
        "transaction_count": len(txns),
        "monthly_income": monthly_income,
        "typical_month_expenses": round(typical_month_expenses, 2),
        "left_to_plan": round(left_to_plan, 2) if left_to_plan is not None else None,
        "categories": categories,
    }
