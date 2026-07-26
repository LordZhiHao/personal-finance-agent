from fastapi import APIRouter, Depends, Query, status

from backend.auth import get_current_user
from backend.schemas import AccountCreate
from db.supabase import create_account, get_accounts
from utils.balances import compute_account_balances

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("")
def list_accounts(type: str | None = Query(None), user_id: str = Depends(get_current_user)):
    types = [t.strip() for t in type.split(",")] if type else None
    return get_accounts(account_type=types, user_id=user_id)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_account_route(payload: AccountCreate, user_id: str = Depends(get_current_user)):
    return create_account(user_id, payload.name, payload.type, payload.currency)


@router.get("/balances")
def balances(currency: str = "SGD", user_id: str = Depends(get_current_user)):
    """Unified cash (bank/ewallet) + brokerage snapshot balances per account —
    matches the Telegram /balance command, previously not exposed in any dashboard."""
    return compute_account_balances(user_id, currency)
