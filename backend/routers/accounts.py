from fastapi import APIRouter, Depends, Query

from backend.auth import get_current_user
from db.supabase import get_accounts
from utils.balances import compute_account_balances

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("")
def list_accounts(type: str | None = Query(None), user: str = Depends(get_current_user)):
    types = [t.strip() for t in type.split(",")] if type else None
    return get_accounts(account_type=types)


@router.get("/balances")
def balances(currency: str = "SGD", user: str = Depends(get_current_user)):
    """Unified cash (bank/ewallet) + brokerage snapshot balances per account —
    matches the Telegram /balance command, previously not exposed in any dashboard."""
    return compute_account_balances(currency)
