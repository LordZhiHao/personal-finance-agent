from fastapi import APIRouter, Depends, status

from backend.auth import get_current_user
from backend.schemas import MemoryCreate
from db.supabase import create_user_memory, delete_user_memory, get_user_memories

router = APIRouter(prefix="/api/memories", tags=["memories"])


@router.get("")
def list_memories(user_id: str = Depends(get_current_user)):
    return get_user_memories(user_id)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_memory_route(payload: MemoryCreate, user_id: str = Depends(get_current_user)):
    return create_user_memory(user_id, payload.content, source="manual")


@router.delete("/{memory_id}")
def delete_memory_route(memory_id: str, user_id: str = Depends(get_current_user)):
    delete_user_memory(memory_id, user_id)
    return {"ok": True}
