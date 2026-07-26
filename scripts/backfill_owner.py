"""One-time backfill: creates the `users` row for the existing single owner from
legacy env vars, and points every pre-existing `accounts` row at that owner.

Run once, after migrations/0001_multi_tenancy_schema.sql and before
migrations/0002_lock_accounts_owner.sql:

    python -m scripts.backfill_owner

Safe to re-run — skips creating the user if the email already exists, and only
updates accounts where user_id is still null.
"""
import os

from dotenv import load_dotenv

load_dotenv()

from backend.auth import hash_password  # noqa: E402
from db.supabase import create_user, get_client, get_user_by_email  # noqa: E402


def main():
    email = os.environ["DASHBOARD_EMAIL"]
    password = os.environ["DASHBOARD_PASSWORD"]
    telegram_chat_id = int(os.environ["YOUR_TELEGRAM_CHAT_ID"])
    notify_email = os.getenv("NOTIFY_EMAIL", email)

    user = get_user_by_email(email)
    db = get_client(use_service_key=True)
    if user is None:
        user = create_user(email, hash_password(password), notify_email=notify_email)
        db.table("users").update({"telegram_chat_id": telegram_chat_id}).eq("id", user["id"]).execute()
        print(f"created owner user {user['id']}")
    else:
        print(f"owner user already exists: {user['id']}")

    result = db.table("accounts").update({"user_id": user["id"]}).is_("user_id", "null").execute()
    print(f"backfilled {len(result.data)} account(s)")


if __name__ == "__main__":
    main()
