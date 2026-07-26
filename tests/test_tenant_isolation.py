"""Run: python -m tests.test_tenant_isolation

Seeds two throwaway users with one account + one transaction each against the real
Supabase project (same convention as test_supabase_connection.py), verifies that
scoped queries/writes never leak across tenants, then deletes everything it created.
"""
import uuid
from datetime import date

from backend.auth import hash_password
from db.supabase import (
    create_account,
    create_user,
    get_account_ids_for_user,
    get_client,
    get_transactions,
    insert_transactions,
)
from utils.balances import compute_account_balances
from utils.portfolio import compute_holdings_summary


def _make_user(label: str) -> dict:
    email = f"tenant-isolation-test-{label}-{uuid.uuid4().hex[:8]}@example.invalid"
    return create_user(email, hash_password("throwaway-password-123"))


def _cleanup(user_ids: list[str], account_ids: list[str]):
    db = get_client(use_service_key=True)
    if account_ids:
        db.table("transactions").delete().in_("account_id", account_ids).execute()
        db.table("accounts").delete().in_("id", account_ids).execute()
    if user_ids:
        db.table("users").delete().in_("id", user_ids).execute()


def main():
    user_a = _make_user("a")
    user_b = _make_user("b")
    user_ids = [user_a["id"], user_b["id"]]
    account_ids: list[str] = []

    try:
        account_a = create_account(user_a["id"], "Test A", "bank", "SGD")
        account_b = create_account(user_b["id"], "Test B", "bank", "SGD")
        account_ids = [account_a["id"], account_b["id"]]

        today = date.today().isoformat()
        insert_transactions(
            [{"account_id": account_a["id"], "date": today, "description": "A's lunch",
              "amount": -10, "category": "Food & Drink", "currency": "SGD", "source": "manual"}],
            user_a["id"],
        )
        insert_transactions(
            [{"account_id": account_b["id"], "date": today, "description": "B's lunch",
              "amount": -20, "category": "Food & Drink", "currency": "SGD", "source": "manual"}],
            user_b["id"],
        )

        assert get_account_ids_for_user(user_a["id"]) == [account_a["id"]]
        assert get_account_ids_for_user(user_b["id"]) == [account_b["id"]]

        txns_a = get_transactions(today, today, user_a["id"])
        txns_b = get_transactions(today, today, user_b["id"])
        assert all(t["account_id"] == account_a["id"] for t in txns_a)
        assert all(t["account_id"] == account_b["id"] for t in txns_b)
        assert not any(t["description"] == "B's lunch" for t in txns_a)
        assert not any(t["description"] == "A's lunch" for t in txns_b)

        balances_a = compute_account_balances(user_a["id"], "SGD")
        assert {b["account_id"] for b in balances_a["balances"]} == {account_a["id"]}

        holdings_a = compute_holdings_summary(user_a["id"], "SGD")
        assert holdings_a["holdings"] == []

        try:
            insert_transactions(
                [{"account_id": account_b["id"], "date": today, "description": "should fail",
                  "amount": -1, "category": "Other", "currency": "SGD", "source": "manual"}],
                user_a["id"],
            )
            raise AssertionError("insert_transactions should have rejected a non-owned account_id")
        except PermissionError:
            pass

        print("All tenant isolation checks passed.")
    finally:
        _cleanup(user_ids, account_ids)


if __name__ == "__main__":
    main()
