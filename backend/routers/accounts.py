from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.auth import get_current_user
from backend.schemas import AccountCreate, AccountUpdate
from db.supabase import create_account, deactivate_account, get_accounts, update_account
from utils.balances import compute_account_balances

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("")
def list_accounts(type: str | None = Query(None), user_id: str = Depends(get_current_user)):
    types = [t.strip() for t in type.split(",")] if type else None
    return get_accounts(account_type=types, user_id=user_id)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_account_route(payload: AccountCreate, user_id: str = Depends(get_current_user)):
    return create_account(user_id, payload.name, payload.type, payload.currency, payload.comments)


@router.patch("/{account_id}")
def patch_account(account_id: str, fields: AccountUpdate, user_id: str = Depends(get_current_user)):
    updates = fields.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    return update_account(account_id, updates, user_id)


@router.delete("/{account_id}")
def delete_account_route(account_id: str, user_id: str = Depends(get_current_user)):
    """Soft-delete (is_active=False) — see db.supabase.deactivate_account for why a hard
    delete isn't safe once an account has transaction/portfolio history."""
    deactivate_account(account_id, user_id)
    return {"ok": True}


@router.get("/balances")
def balances(currency: str = "SGD", user_id: str = Depends(get_current_user)):
    """Unified cash (bank/ewallet) + brokerage snapshot balances per account —
    matches the Telegram /balance command, previously not exposed in any dashboard."""
    return compute_account_balances(user_id, currency)
