"""Run: python -m tests.test_field_encryption

Requires FIELD_ENCRYPTION_KEY to be set and migrations/0017_field_encryption.sql to
already be applied. Seeds a throwaway user/account, inserts a transaction and a
portfolio event, verifies db/supabase.py's read path returns the original plaintext,
verifies the raw stored *_enc columns are NOT the plaintext (i.e. actually
ciphertext), and exercises query_records' Python-side filter on an encrypted field
(amount). Cleans up after itself, same convention as test_tenant_isolation.py.
"""
import uuid
from datetime import date

from backend.auth import hash_password
from db.supabase import (
    create_account,
    create_user,
    get_client,
    get_transactions,
    insert_portfolio_events,
    insert_transactions,
    query_records,
)


def _make_user() -> dict:
    email = f"field-encryption-test-{uuid.uuid4().hex[:8]}@example.invalid"
    return create_user(email, hash_password("throwaway-password-123"))


def _cleanup(user_id: str, account_id: str):
    db = get_client(use_service_key=True)
    if account_id:
        db.table("transactions").delete().eq("account_id", account_id).execute()
        db.table("portfolio_events").delete().eq("account_id", account_id).execute()
        db.table("accounts").delete().eq("id", account_id).execute()
    if user_id:
        db.table("users").delete().eq("id", user_id).execute()


def main():
    user = _make_user()
    account = create_account(user["id"], "Test Encryption", "bank", "SGD")
    today = date.today().isoformat()

    try:
        insert_transactions(
            [{
                "account_id": account["id"], "date": today,
                "description": "top secret grocery run", "amount": -123.45,
                "category": "Groceries", "currency": "SGD", "source": "manual",
            }],
            user["id"],
        )
        insert_portfolio_events(
            [{
                "account_id": account["id"], "date": today, "ticker": "AAPL",
                "action": "BUY", "quantity": 10, "price": 199.5, "currency": "USD", "fees": 1.0,
            }],
            user["id"],
        )

        # 1. db/supabase.py's read path returns decrypted plaintext.
        txns = get_transactions(today, today, user["id"])
        assert len(txns) == 1
        assert txns[0]["amount"] == -123.45
        assert txns[0]["description"] == "top secret grocery run"

        # 2. The raw stored value is NOT plaintext — confirms it's actually encrypted.
        db = get_client(use_service_key=True)
        raw = db.table("transactions").select("*").eq("account_id", account["id"]).execute().data[0]
        assert raw.get("amount") is None or raw["amount"] != -123.45
        assert raw["amount_enc"] is not None
        assert "top secret" not in (raw.get("description") or "")
        assert "top secret" not in raw["description_enc"]

        # 3. query_records' Python-side filter on an encrypted field (amount) still works.
        result = query_records(
            user_id=user["id"], table="transactions",
            filters=[{"field": "amount", "op": "<", "value": -100}],
            start_date=today, end_date=today, group_by=None, limit=50,
        )
        assert result["row_count"] == 1
        assert result["rows"][0]["amount"] == -123.45

        result_no_match = query_records(
            user_id=user["id"], table="transactions",
            filters=[{"field": "amount", "op": ">", "value": 0}],
            start_date=today, end_date=today, group_by=None, limit=50,
        )
        assert result_no_match["row_count"] == 0

        print("All field encryption checks passed.")
    finally:
        _cleanup(user["id"], account["id"])


if __name__ == "__main__":
    main()
