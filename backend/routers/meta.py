from fastapi import APIRouter, Depends

from backend.auth import get_current_user
from db.supabase import get_categories_for_user, get_category_classifications_for_user
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

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("")
def get_meta(user_id: str = Depends(get_current_user)):
    return {
        "categories": get_categories_for_user(user_id),
        "category_classifications": get_category_classifications_for_user(user_id),
        "classifications": CLASSIFICATIONS,
        "currencies": CURRENCIES,
        "account_types": ACCOUNT_TYPES,
        "portfolio_actions": PORTFOLIO_ACTIONS,
        "rule_match_types": RULE_MATCH_TYPES,
        "genders": GENDERS,
        "marital_statuses": MARITAL_STATUSES,
        "personas": [
            {
                "id": key,
                "label": persona["label"],
                "ui_description": persona["ui_description"],
                "starter_suggestion": persona["starter_suggestion"],
            }
            for key, persona in PERSONAS.items()
        ],
    }
