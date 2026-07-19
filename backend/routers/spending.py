from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.auth import get_current_user
from backend.schemas import TransactionUpdate
from db.supabase import get_transactions, update_transaction
from scheduler.report_builder import summarize_transactions

router = APIRouter(prefix="/api/transactions", tags=["spending"])


@router.get("")
def list_transactions(
    start_date: str = Query(...),
    end_date: str = Query(...),
    user: str = Depends(get_current_user),
):
    return get_transactions(start_date, end_date)


@router.get("/summary")
def expense_summary(
    start_date: str = Query(...),
    end_date: str = Query(...),
    user: str = Depends(get_current_user),
):
    return summarize_transactions(get_transactions(start_date, end_date))


@router.patch("/{transaction_id}")
def patch_transaction(transaction_id: str, fields: TransactionUpdate, user: str = Depends(get_current_user)):
    updates = fields.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    update_transaction(transaction_id, updates)
    return {"ok": True}
