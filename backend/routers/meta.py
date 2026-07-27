from fastapi import APIRouter, Depends

from backend.auth import get_current_user
from db.supabase import get_categories_for_user
from utils.constants import ACCOUNT_TYPES, CURRENCIES, PORTFOLIO_ACTIONS

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("")
def get_meta(user_id: str = Depends(get_current_user)):
    return {
        "categories": get_categories_for_user(user_id),
        "currencies": CURRENCIES,
        "account_types": ACCOUNT_TYPES,
        "portfolio_actions": PORTFOLIO_ACTIONS,
    }
