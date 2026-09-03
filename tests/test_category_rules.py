"""Run: python -m tests.test_category_rules

Exercises bot/category_rules.py's pure matching logic, then seeds two throwaway users
(same convention as tests/test_tenant_isolation.py) to verify a rule created by one
user never matches, is never editable/deletable, and never backfills the other
user's transactions — then deletes everything it created.
"""
import uuid
from datetime import date

from backend.auth import hash_password
from bot.category_rules import apply_rules
from db.supabase import (
    apply_rule_backfill,
    create_account,
    create_category_rule,
    create_user,
    delete_category_rule,
    get_category_rules,
    get_client,
    get_transactions,
    insert_transactions,
    update_category_rule,
)


def _make_user(label: str) -> dict:
    email = f"category-rules-test-{label}-{uuid.uuid4().hex[:8]}@example.invalid"
    return create_user(email, hash_password("throwaway-password-123"))


def _cleanup(user_ids: list[str], account_ids: list[str], rule_ids: list[str]):
    db = get_client(use_service_key=True)
    if rule_ids:
        db.table("category_rules").delete().in_("id", rule_ids).execute()
    if account_ids:
        db.table("transactions").delete().in_("account_id", account_ids).execute()
        db.table("accounts").delete().in_("id", account_ids).execute()
    if user_ids:
        db.table("users").delete().in_("id", user_ids).execute()


def _test_apply_rules_pure():
    transactions = [
        {"description": "Grab ride to work", "amount": -15.0, "category": "Other"},
        {"description": "NTUC groceries", "amount": -42.5, "category": "Other"},
    ]
    rules = [
        {"id": "rule-1", "match_type": "description_contains", "pattern": "Grab", "category": "Transport"},
    ]
    matched = apply_rules(transactions, rules)
    assert matched == {"rule-1"}
    assert transactions[0]["category"] == "Transport"
    assert transactions[1]["category"] == "Other"  # unmatched, untouched
    print("apply_rules() pure-function check passed.")


def main():
    _test_apply_rules_pure()

    user_a = _make_user("a")
    user_b = _make_user("b")
    user_ids = [user_a["id"], user_b["id"]]
    account_ids: list[str] = []
    rule_ids: list[str] = []

    try:
        account_a = create_account(user_a["id"], "Test A", "bank", "SGD")
        account_b = create_account(user_b["id"], "Test B", "bank", "SGD")
        account_ids = [account_a["id"], account_b["id"]]

        today = date.today().isoformat()
        insert_transactions(
            [{"account_id": account_a["id"], "date": today, "description": "Grab ride to work",
              "amount": -15, "category": "Other", "currency": "SGD", "source": "manual"}],
            user_a["id"],
        )
        insert_transactions(
            [{"account_id": account_b["id"], "date": today, "description": "Grab ride home",
              "amount": -12, "category": "Other", "currency": "SGD", "source": "manual"}],
            user_b["id"],
        )

        rule_a = create_category_rule(user_a["id"], "description_contains", "Grab", "Transport")
        rule_ids = [rule_a["id"]]

        # Cross-tenant read isolation
        assert get_category_rules(user_b["id"]) == []
        assert [r["id"] for r in get_category_rules(user_a["id"])] == [rule_a["id"]]

        # Cross-tenant write isolation
        try:
            update_category_rule(rule_a["id"], {"pattern": "hacked"}, user_b["id"])
            raise AssertionError("update_category_rule should have rejected a non-owned rule id")
        except LookupError:
            pass

        try:
            delete_category_rule(rule_a["id"], user_b["id"])
            raise AssertionError("delete_category_rule should have rejected a non-owned rule id")
        except LookupError:
            pass

        try:
            apply_rule_backfill(rule_a["id"], user_b["id"])
            raise AssertionError("apply_rule_backfill should have rejected a non-owned rule id")
        except LookupError:
            pass

        # Backfill only touches the calling user's own matching transactions
        updated_count = apply_rule_backfill(rule_a["id"], user_a["id"])
        assert updated_count == 1, f"expected 1 updated transaction, got {updated_count}"

        txns_a = get_transactions(today, today, user_a["id"])
        txns_b = get_transactions(today, today, user_b["id"])
        assert all(t["category"] == "Transport" for t in txns_a if t["description"] == "Grab ride to work")
        assert all(t["category"] == "Other" for t in txns_b if t["description"] == "Grab ride home")

        print("All category-rules isolation checks passed.")
    finally:
        _cleanup(user_ids, account_ids, rule_ids)


if __name__ == "__main__":
    main()
