from fastapi import APIRouter, Depends, HTTPException, status

from backend.auth import get_current_user
from backend.schemas import PreferencesUpdate
from db.supabase import get_user_by_id, update_user

router = APIRouter(prefix="/api/preferences", tags=["preferences"])

_FIELDS = ("budget_nudge_threshold", "weekly_recap")


def _preferences_response(user: dict) -> dict:
    return {field: user.get(field) for field in _FIELDS}


@router.get("")
def get_preferences(user_id: str = Depends(get_current_user)):
    """"How Finn behaves" Settings card — a separate endpoint from GET /api/auth/me
    by design (see CLAUDE.md's Preferences api-gap note)."""
    user = get_user_by_id(user_id)
    return _preferences_response(user or {})


@router.patch("")
def patch_preferences(fields: PreferencesUpdate, user_id: str = Depends(get_current_user)):
    updates = fields.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    user = update_user(user_id, updates)
    return _preferences_response(user)
