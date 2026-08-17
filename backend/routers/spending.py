from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.auth import get_current_user
from backend.schemas import TransactionCreate, TransactionUpdate
from db.supabase import (
    create_signed_receipt_url,
    delete_transactions,
    get_categories_for_user,
    get_category_classifications_for_user,
    get_transaction_receipt,
    get_transactions,
    insert_transactions,
    update_transaction,
)
from scheduler.report_builder import summarize_transactions
from utils.fx import convert

router = APIRouter(prefix="/api/transactions", tags=["spending"])


@router.get("")
def list_transactions(
    start_date: str = Query(...),
    end_date: str = Query(...),
    currency: str = "SGD",
    user_id: str = Depends(get_current_user),
):
    """Each row keeps its native amount/currency (for editing, receipts, and the
    itemized transaction list) and additionally gets converted_amount — the amount
    FX-converted to `currency` — so pages that sum across transactions (which can
    genuinely span multiple currencies, see AddTransactionDialog) aggregate
    correctly instead of mixing raw amounts of different currencies together."""
    rows = get_transactions(start_date, end_date, user_id)
    for r in rows:
        r["converted_amount"] = convert(r["amount"], r["currency"], currency)
    return rows


@router.get("/summary")
def expense_summary(
    start_date: str = Query(...),
    end_date: str = Query(...),
    user_id: str = Depends(get_current_user),
):
    return summarize_transactions(
        get_transactions(start_date, end_date, user_id), get_category_classifications_for_user(user_id)
    )


@router.post("", status_code=201)
def create_transaction(payload: TransactionCreate, user_id: str = Depends(get_current_user)):
    if payload.category not in get_categories_for_user(user_id):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown category.")
    row = payload.model_dump(mode="json")
    row["source"] = "manual"
    result = insert_transactions([row], user_id)
    return result.data[0] if result.data else row


@router.patch("/{transaction_id}")
def patch_transaction(transaction_id: str, fields: TransactionUpdate, user_id: str = Depends(get_current_user)):
    updates = fields.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    update_transaction(transaction_id, updates, user_id)
    return {"ok": True}


@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: str, user_id: str = Depends(get_current_user)):
    delete_transactions([transaction_id], user_id)
    return {"ok": True}


@router.get("/{transaction_id}/receipt")
def get_receipt(transaction_id: str, user_id: str = Depends(get_current_user)):
    """Short-lived signed URL to the original receipt image/PDF behind a transaction,
    if one was stored. The bucket is private, so the frontend never gets a raw storage
    path or a Supabase key — only a time-limited signed URL."""
    receipt = get_transaction_receipt(transaction_id, user_id)
    if not receipt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No receipt for this transaction.")
    return {
        "url": create_signed_receipt_url(receipt["storage_path"]),
        "content_type": receipt["content_type"],
    }
