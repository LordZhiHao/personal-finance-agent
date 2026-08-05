from fastapi import APIRouter, Depends, status

from backend.auth import get_current_user
from backend.schemas import CategoryCreate, CustomCategoryUpdate
from db.supabase import (
    create_custom_category,
    delete_custom_category,
    get_custom_categories_full,
    update_custom_category,
)

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("")
def list_categories(user_id: str = Depends(get_current_user)):
    """The user's own custom categories only ({id, name}), for the Settings page's manage
    UI — distinct from GET /api/meta's merged built-in+custom string list used elsewhere."""
    return get_custom_categories_full(user_id)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_category_route(payload: CategoryCreate, user_id: str = Depends(get_current_user)):
    return create_custom_category(user_id, payload.name, payload.classification)


@router.patch("/{category_id}")
def patch_category(category_id: str, fields: CustomCategoryUpdate, user_id: str = Depends(get_current_user)):
    return update_custom_category(category_id, user_id, fields.model_dump(exclude_unset=True))


@router.delete("/{category_id}")
def delete_category_route(category_id: str, user_id: str = Depends(get_current_user)):
    delete_custom_category(category_id, user_id)
    return {"ok": True}
