from fastapi import APIRouter, Depends, status

from backend.auth import get_current_user
from backend.schemas import CategoryCreate
from db.supabase import create_custom_category

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_category_route(payload: CategoryCreate, user_id: str = Depends(get_current_user)):
    return create_custom_category(user_id, payload.name)
