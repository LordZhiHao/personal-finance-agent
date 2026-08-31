from fastapi import APIRouter, Depends, HTTPException, status

from backend.auth import get_current_user
from backend.schemas import RuleCreate, RuleUpdate
from db.supabase import (
    apply_rule_backfill,
    create_category_rule,
    delete_category_rule,
    get_categories_for_user,
    get_category_rules,
    update_category_rule,
)

router = APIRouter(prefix="/api/rules", tags=["rules"])


def _require_valid_category(category: str, user_id: str) -> None:
    if category not in get_categories_for_user(user_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"'{category}' is not one of your valid categories.",
        )


@router.get("")
def list_rules(user_id: str = Depends(get_current_user)):
    return get_category_rules(user_id)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_rule_route(payload: RuleCreate, user_id: str = Depends(get_current_user)):
    _require_valid_category(payload.category, user_id)
    return create_category_rule(user_id, payload.match_type, payload.pattern, payload.category)


@router.patch("/{rule_id}")
def patch_rule(rule_id: str, fields: RuleUpdate, user_id: str = Depends(get_current_user)):
    updates = fields.model_dump(exclude_unset=True)
    if "category" in updates:
        _require_valid_category(updates["category"], user_id)
    return update_category_rule(rule_id, updates, user_id)


@router.delete("/{rule_id}")
def delete_rule_route(rule_id: str, user_id: str = Depends(get_current_user)):
    delete_category_rule(rule_id, user_id)
    return {"ok": True}


@router.post("/{rule_id}/apply")
def apply_rule_route(rule_id: str, user_id: str = Depends(get_current_user)):
    """Re-files past transactions against a rule's current pattern/category — the
    Settings page's "Re-file history" action, typically called right after editing
    a rule."""
    updated_count = apply_rule_backfill(rule_id, user_id)
    return {"updated_count": updated_count}
