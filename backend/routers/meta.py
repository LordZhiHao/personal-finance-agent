from fastapi import APIRouter, Depends

from backend.auth import get_current_user
from utils.constants import ACCOUNT_TYPES, CATEGORIES, CURRENCIES, PORTFOLIO_ACTIONS

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("")
def get_meta(user: str = Depends(get_current_user)):
    return {
        "categories": CATEGORIES,
        "currencies": CURRENCIES,
        "account_types": ACCOUNT_TYPES,
        "portfolio_actions": PORTFOLIO_ACTIONS,
    }
