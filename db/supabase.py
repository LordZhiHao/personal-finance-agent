import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client

from utils.constants import BUILTIN_CATEGORY_CLASSIFICATIONS, CATEGORIES, QUERYABLE_OPERATORS, QUERYABLE_SCHEMA
from utils.logger import get_logger

load_dotenv()
logger = get_logger(__name__)


def get_client(use_service_key: bool = False):
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") if use_service_key \
        else os.getenv("SUPABASE_ANON_KEY")
    return create_client(url, key)


def get_account_ids_for_user(user_id: str) -> list[str]:
    db = get_client()
    rows = db.table("accounts").select("id").eq("user_id", user_id).execute().data
    return [r["id"] for r in rows]


def _validate_owned_account(account_id: str, user_id: str):
    if account_id not in get_account_ids_for_user(user_id):
        raise PermissionError(f"Account {account_id} is not owned by user {user_id}")


def _validate_owned_accounts(account_ids: list[str], user_id: str):
    owned = set(get_account_ids_for_user(user_id))
    not_owned = [a for a in account_ids if a not in owned]
    if not_owned:
        raise PermissionError(f"Account(s) {not_owned} not owned by user {user_id}")


def insert_transactions(rows: list[dict], user_id: str):
    _validate_owned_accounts([r["account_id"] for r in rows], user_id)
    db = get_client(use_service_key=True)
    try:
        result = db.table("transactions").insert(rows).execute()
    except Exception:
        logger.exception("insert_transactions failed for %d row(s)", len(rows))
        raise
    logger.info("insert_transactions: saved %d row(s)", len(rows))
    return result


def insert_portfolio_events(rows: list[dict], user_id: str):
    _validate_owned_accounts([r["account_id"] for r in rows], user_id)
    db = get_client(use_service_key=True)
    try:
        result = db.table("portfolio_events").insert(rows).execute()
    except Exception:
        logger.exception("insert_portfolio_events failed for %d row(s)", len(rows))
        raise
    logger.info("insert_portfolio_events: saved %d row(s)", len(rows))
    return result


def create_receipt(user_id: str, storage_path: str, content_type: str) -> dict:
    db = get_client(use_service_key=True)
    result = (
        db.table("receipts")
        .insert({"user_id": user_id, "storage_path": storage_path, "content_type": content_type})
        .execute()
    )
    logger.info("create_receipt: user_id=%s storage_path=%s", user_id, storage_path)
    return result.data[0]


def get_receipt(receipt_id: str, user_id: str) -> dict | None:
    db = get_client(use_service_key=True)
    rows = db.table("receipts").select("*").eq("id", receipt_id).eq("user_id", user_id).execute().data
    return rows[0] if rows else None


def upload_receipt(user_id: str, receipt_bytes: bytes, content_type: str) -> dict:
    """Uploads the raw receipt/statement bytes to the private 'receipts' Supabase
    Storage bucket (must already exist — created manually, not by a migration) and
    records a receipts row pointing at it. Raises on failure — the caller
    (bot/handlers.py::save_extraction) treats a receipt as best-effort supplementary
    data and wraps this in its own try/except so an upload failure never blocks the
    underlying transaction/portfolio_event save."""
    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
    storage_path = f"{user_id}/{uuid.uuid4()}.{ext}"
    db = get_client(use_service_key=True)
    db.storage.from_("receipts").upload(storage_path, receipt_bytes, {"content-type": content_type})
    logger.info("upload_receipt: user_id=%s storage_path=%s", user_id, storage_path)
    return create_receipt(user_id, storage_path, content_type)


def create_signed_receipt_url(storage_path: str, expires_in: int = 300) -> str:
    """Short-lived signed URL into the private 'receipts' bucket — the frontend never
    holds a Supabase key, so this is how it gets time-limited read access to a receipt
    image, via GET /api/transactions/{id}/receipt."""
    db = get_client(use_service_key=True)
    result = db.storage.from_("receipts").create_signed_url(storage_path, expires_in)
    return result["signedURL"]


def get_transaction_receipt(transaction_id: str, user_id: str) -> dict | None:
    """Ownership-checked lookup of the receipt behind a transaction, for
    GET /api/transactions/{id}/receipt. Scoped via the transaction's account
    (accounts.user_id), same as every other transaction-ownership check in this file."""
    account_ids = get_account_ids_for_user(user_id)
    if not account_ids:
        return None
    db = get_client(use_service_key=True)
    rows = (
        db.table("transactions")
        .select("receipt_id")
        .eq("id", transaction_id)
        .in_("account_id", account_ids)
        .execute()
        .data
    )
    if not rows or not rows[0]["receipt_id"]:
        return None
    return get_receipt(rows[0]["receipt_id"], user_id)


def get_transactions(start_date: str, end_date: str, user_id: str | None = None):
    """user_id=None returns every tenant's transactions in range — used only by the
    legacy dashboard (single-tenant) and must stay that way for backward compatibility."""
    logger.debug("get_transactions: %s to %s", start_date, end_date)
    db = get_client()
    query = (
        db.table("transactions")
        .select("*, accounts(name, currency)")
        .gte("date", start_date)
        .lte("date", end_date)
    )
    if user_id is not None:
        query = query.in_("account_id", get_account_ids_for_user(user_id))
    return query.order("date", desc=True).execute().data


def update_transaction(transaction_id: str, fields: dict, user_id: str | None = None):
    """user_id=None preserves the legacy dashboard's unscoped update. When given,
    the update only applies if transaction_id belongs to an account owned by user_id —
    otherwise raises LookupError (translated to a 404 by the backend). If fields moves
    the transaction to a different account, the new account must also be owned by
    user_id (same convention as update_portfolio_event)."""
    if user_id is not None and "account_id" in fields:
        _validate_owned_account(fields["account_id"], user_id)
    logger.info("update_transaction: id=%s fields=%s", transaction_id, list(fields.keys()))
    db = get_client(use_service_key=True)
    query = db.table("transactions").update(fields).eq("id", transaction_id)
    if user_id is not None:
        query = query.in_("account_id", get_account_ids_for_user(user_id))
    result = query.execute()
    if user_id is not None and not result.data:
        raise LookupError(f"Transaction {transaction_id} not found")
    return result


def dashboard_insert_portfolio_event(row: dict, user_id: str | None = None):
    """user_id=None preserves the legacy dashboard's unscoped insert."""
    if user_id is not None:
        _validate_owned_account(row["account_id"], user_id)
    db = get_client(use_service_key=True)
    try:
        result = db.table("portfolio_events").insert(row).execute()
    except Exception:
        logger.exception("dashboard_insert_portfolio_event failed for ticker=%s", row.get("ticker"))
        raise
    logger.info("dashboard_insert_portfolio_event: saved ticker=%s action=%s", row.get("ticker"), row.get("action"))
    return result


def update_portfolio_event(event_id: str, fields: dict, user_id: str):
    """Unlike update_transaction, this has no legacy dashboard caller, so user_id is
    required (standard convention). If fields moves the event to a different account,
    the new account must also be owned by user_id."""
    if "account_id" in fields:
        _validate_owned_account(fields["account_id"], user_id)
    logger.info("update_portfolio_event: id=%s fields=%s", event_id, list(fields.keys()))
    db = get_client(use_service_key=True)
    result = (
        db.table("portfolio_events")
        .update(fields)
        .eq("id", event_id)
        .in_("account_id", get_account_ids_for_user(user_id))
        .execute()
    )
    if not result.data:
        raise LookupError(f"Portfolio event {event_id} not found")
    return result


def get_latest_snapshots(user_id: str | None = None):
    """user_id=None returns every tenant's latest snapshots — used only by the legacy
    dashboard and the system-wide equity price updater."""
    logger.debug("get_latest_snapshots")
    db = get_client()
    query = db.table("asset_snapshots").select("*, accounts(name, currency)")
    if user_id is not None:
        query = query.in_("account_id", get_account_ids_for_user(user_id))
    snapshots = query.order("snapshot_date", desc=True).limit(50).execute().data
    seen = {}
    for s in snapshots:
        if s["account_id"] not in seen:
            seen[s["account_id"]] = s
    return list(seen.values())


def get_snapshot_history(
    user_id: str,
    account_id: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
):
    """Full asset_snapshots history (every row, not deduped to latest-per-account like
    get_latest_snapshots), for plotting a net worth trend over time. Optionally scoped
    to a single account_id (per-broker charts) and/or a date range."""
    logger.debug("get_snapshot_history: account_id=%s start=%s end=%s", account_id, start_date, end_date)
    db = get_client()
    query = (
        db.table("asset_snapshots")
        .select("*, accounts(name, currency)")
        .in_("account_id", get_account_ids_for_user(user_id))
    )
    if account_id is not None:
        query = query.eq("account_id", account_id)
    if start_date is not None:
        query = query.gte("snapshot_date", start_date)
    if end_date is not None:
        query = query.lte("snapshot_date", end_date)
    return query.order("snapshot_date").execute().data


def get_accounts(account_type: str | list[str] | None = None, user_id: str | None = None):
    """user_id=None returns every tenant's accounts — used only by the legacy dashboard
    and system-wide jobs (e.g. the equity price updater)."""
    logger.debug("get_accounts: type=%s user_id=%s", account_type, user_id)
    db = get_client()
    query = db.table("accounts").select("*").eq("is_active", True)
    if account_type:
        types = [account_type] if isinstance(account_type, str) else account_type
        query = query.in_("type", types)
    if user_id is not None:
        query = query.eq("user_id", user_id)
    return query.execute().data


def create_account(user_id: str, name: str, type_: str, currency: str, comments: str | None = None) -> dict:
    db = get_client(use_service_key=True)
    result = (
        db.table("accounts")
        .insert({
            "name": name, "type": type_, "currency": currency, "user_id": user_id,
            "is_active": True, "comments": comments,
        })
        .execute()
    )
    logger.info("create_account: user_id=%s name=%s type=%s currency=%s", user_id, name, type_, currency)
    return result.data[0]


def update_account(account_id: str, fields: dict, user_id: str) -> dict:
    db = get_client(use_service_key=True)
    result = db.table("accounts").update(fields).eq("id", account_id).eq("user_id", user_id).execute()
    if not result.data:
        raise LookupError(f"Account {account_id} not found")
    logger.info("update_account: id=%s fields=%s", account_id, list(fields.keys()))
    return result.data[0]


def deactivate_account(account_id: str, user_id: str) -> None:
    """Soft-delete: accounts.transactions/portfolio_events/asset_snapshots have no
    ON DELETE clause on their account_id FK (defaults to restrict), so a hard delete
    would fail once an account has any history. Setting is_active=False hides it from
    get_accounts()/dropdowns while leaving historical data untouched everywhere else —
    get_account_ids_for_user() doesn't filter on is_active."""
    db = get_client(use_service_key=True)
    result = (
        db.table("accounts")
        .update({"is_active": False})
        .eq("id", account_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise LookupError(f"Account {account_id} not found")
    logger.info("deactivate_account: id=%s user_id=%s", account_id, user_id)


def create_custom_category(user_id: str, name: str, classification: str = "expense") -> dict:
    db = get_client(use_service_key=True)
    result = (
        db.table("custom_categories")
        .insert({"user_id": user_id, "name": name, "classification": classification})
        .execute()
    )
    logger.info("create_custom_category: user_id=%s name=%s classification=%s", user_id, name, classification)
    return result.data[0]


def get_custom_categories(user_id: str) -> list[str]:
    # Uses the service key, not the anon key like most reads — custom_categories has RLS
    # enabled with no anon SELECT grant (unlike the other tenant-scoped tables), so an
    # anon-key read here silently returns zero rows instead of erroring.
    db = get_client(use_service_key=True)
    rows = db.table("custom_categories").select("name").eq("user_id", user_id).execute().data
    return [r["name"] for r in rows]


def get_custom_categories_full(user_id: str) -> list[dict]:
    """Full {id, name, classification} rows for the Settings page's manage-categories UI —
    distinct from get_custom_categories(), which returns bare names for merging into
    get_categories_for_user()."""
    # Service key — see get_custom_categories() above for why anon can't read this table.
    db = get_client(use_service_key=True)
    return (
        db.table("custom_categories")
        .select("id, name, classification")
        .eq("user_id", user_id)
        .order("name")
        .execute()
        .data
    )


def update_custom_category(category_id: str, user_id: str, fields: dict) -> dict:
    """`fields` is a partial update (e.g. {"name": ...} and/or {"classification": ...}),
    same convention as update_account/update_user_budget."""
    db = get_client(use_service_key=True)
    result = (
        db.table("custom_categories")
        .update(fields)
        .eq("id", category_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise LookupError(f"Category {category_id} not found")
    logger.info("update_custom_category: id=%s fields=%s", category_id, fields)
    return result.data[0]


def delete_custom_category(category_id: str, user_id: str) -> None:
    db = get_client(use_service_key=True)
    result = (
        db.table("custom_categories")
        .delete()
        .eq("id", category_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise LookupError(f"Category {category_id} not found")
    logger.info("delete_custom_category: id=%s user_id=%s", category_id, user_id)


def get_categories_for_user(user_id: str) -> list[str]:
    """Built-in CATEGORIES plus this user's own custom categories — the one list every
    caller (extraction prompts, GET /api/meta, transaction category validation) uses."""
    return CATEGORIES + get_custom_categories(user_id)


def get_category_classifications_for_user(user_id: str) -> dict[str, str]:
    """Category name -> classification ("expense" | "income" | "transfer" | "investment")
    for every category this user can use — built-ins from BUILTIN_CATEGORY_CLASSIFICATIONS
    (defaulting to "expense") overlaid with this user's own custom categories' own
    classification. The one shared lookup every spend/budget/subscription aggregation
    uses to decide whether a negative-amount row counts as spending."""
    classifications = {c: BUILTIN_CATEGORY_CLASSIFICATIONS.get(c, "expense") for c in CATEGORIES}
    for row in get_custom_categories_full(user_id):
        classifications[row["name"]] = row["classification"]
    return classifications


def create_user_memory(user_id: str, content: str, source: str = "agent") -> dict:
    """A durable freeform note about the user (preference/goal/idea). source is
    'agent' when the finance Q&A agent saves it mid-conversation, 'manual' when the
    user adds it directly (Settings page or onboarding)."""
    db = get_client(use_service_key=True)
    result = (
        db.table("user_memories")
        .insert({"user_id": user_id, "content": content, "source": source})
        .execute()
    )
    logger.info("create_user_memory: user_id=%s source=%s", user_id, source)
    return result.data[0]


def get_user_memories(user_id: str, limit: int = 30) -> list[dict]:
    """Most recent notes first, capped so the agent's system prompt stays bounded."""
    db = get_client(use_service_key=True)
    return (
        db.table("user_memories")
        .select("id, content, source, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )


def delete_user_memory(memory_id: str, user_id: str) -> None:
    db = get_client(use_service_key=True)
    result = (
        db.table("user_memories")
        .delete()
        .eq("id", memory_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise LookupError(f"Memory {memory_id} not found")
    logger.info("delete_user_memory: id=%s user_id=%s", memory_id, user_id)


def create_user_reminder(
    user_id: str,
    message: str,
    frequency: str,
    time_of_day: str,
    day_of_week: int | None = None,
    day_of_month: int | None = None,
    channel: str = "both",
) -> dict:
    db = get_client(use_service_key=True)
    result = (
        db.table("user_reminders")
        .insert({
            "user_id": user_id, "message": message, "frequency": frequency,
            "time_of_day": time_of_day, "day_of_week": day_of_week,
            "day_of_month": day_of_month, "channel": channel,
        })
        .execute()
    )
    logger.info("create_user_reminder: user_id=%s frequency=%s", user_id, frequency)
    return result.data[0]


def get_user_reminders(user_id: str) -> list[dict]:
    db = get_client(use_service_key=True)
    return (
        db.table("user_reminders")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )


def get_all_active_reminders() -> list[dict]:
    """System-wide poll source for scheduler/user_reminders.py — same unscoped-by-design
    pattern as get_all_users()/get_users_with_telegram(). Joins each owner's delivery
    info in one query so the poller doesn't need a second lookup per reminder."""
    db = get_client(use_service_key=True)
    return (
        db.table("user_reminders")
        .select("*, users(telegram_chat_id, notify_email, theme)")
        .eq("active", True)
        .execute()
        .data
    )


def delete_user_reminder(reminder_id: str, user_id: str) -> None:
    db = get_client(use_service_key=True)
    result = (
        db.table("user_reminders")
        .delete()
        .eq("id", reminder_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise LookupError(f"Reminder {reminder_id} not found")
    logger.info("delete_user_reminder: id=%s user_id=%s", reminder_id, user_id)


def mark_reminder_sent(reminder_id: str, sent_at: datetime) -> None:
    # No ownership check — only ever called by the poller against a row id it just read.
    db = get_client(use_service_key=True)
    db.table("user_reminders").update({"last_sent_at": sent_at.isoformat()}).eq("id", reminder_id).execute()


def create_user_alert(
    user_id: str,
    metric: str,
    operator: str,
    threshold: float,
    ticker: str | None = None,
    message: str | None = None,
    channel: str = "both",
) -> dict:
    db = get_client(use_service_key=True)
    result = (
        db.table("user_alerts")
        .insert({
            "user_id": user_id, "metric": metric, "operator": operator,
            "threshold": threshold, "ticker": ticker, "message": message, "channel": channel,
        })
        .execute()
    )
    logger.info("create_user_alert: user_id=%s metric=%s operator=%s threshold=%s", user_id, metric, operator, threshold)
    return result.data[0]


def get_user_alerts(user_id: str) -> list[dict]:
    db = get_client(use_service_key=True)
    return (
        db.table("user_alerts")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )


def get_all_active_alerts() -> list[dict]:
    """System-wide poll source for scheduler/user_alerts.py — same unscoped-by-design
    pattern as get_all_active_reminders(). Joins each owner's delivery info in one
    query so the poller doesn't need a second lookup per alert."""
    db = get_client(use_service_key=True)
    return (
        db.table("user_alerts")
        .select("*, users(telegram_chat_id, notify_email, theme, main_currency)")
        .eq("active", True)
        .execute()
        .data
    )


def delete_user_alert(alert_id: str, user_id: str) -> None:
    db = get_client(use_service_key=True)
    result = (
        db.table("user_alerts")
        .delete()
        .eq("id", alert_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise LookupError(f"Alert {alert_id} not found")
    logger.info("delete_user_alert: id=%s user_id=%s", alert_id, user_id)


def mark_alert_triggered(alert_id: str, sent_at: datetime, deactivate: bool) -> None:
    # No ownership check — only ever called by the poller against a row id it just read.
    db = get_client(use_service_key=True)
    fields = {"last_triggered_at": sent_at.isoformat()}
    if deactivate:
        fields["active"] = False
    db.table("user_alerts").update(fields).eq("id", alert_id).execute()


def create_user_budget(user_id: str, category: str, monthly_limit: float, currency: str) -> dict:
    """Upsert on (user_id, category) — re-budgeting a category just updates the limit
    rather than erroring on the unique constraint, same convention as upsert_asset_snapshot."""
    db = get_client(use_service_key=True)
    result = (
        db.table("user_budgets")
        .upsert(
            {"user_id": user_id, "category": category, "monthly_limit": monthly_limit, "currency": currency},
            on_conflict="user_id,category",
        )
        .execute()
    )
    logger.info("create_user_budget: user_id=%s category=%s monthly_limit=%s", user_id, category, monthly_limit)
    return result.data[0]


def get_user_budgets(user_id: str) -> list[dict]:
    db = get_client(use_service_key=True)
    return (
        db.table("user_budgets")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )


def update_user_budget(budget_id: str, fields: dict, user_id: str) -> dict:
    db = get_client(use_service_key=True)
    result = db.table("user_budgets").update(fields).eq("id", budget_id).eq("user_id", user_id).execute()
    if not result.data:
        raise LookupError(f"Budget {budget_id} not found")
    logger.info("update_user_budget: id=%s fields=%s", budget_id, list(fields.keys()))
    return result.data[0]


def delete_user_budget(budget_id: str, user_id: str) -> None:
    db = get_client(use_service_key=True)
    result = db.table("user_budgets").delete().eq("id", budget_id).eq("user_id", user_id).execute()
    if not result.data:
        raise LookupError(f"Budget {budget_id} not found")
    logger.info("delete_user_budget: id=%s user_id=%s", budget_id, user_id)


def get_all_budgets() -> list[dict]:
    """System-wide poll source for scheduler/user_budgets.py — same unscoped-by-design
    pattern as get_all_active_reminders()/get_all_active_alerts()."""
    db = get_client(use_service_key=True)
    return (
        db.table("user_budgets")
        .select("*, users(telegram_chat_id, notify_email, theme, main_currency)")
        .execute()
        .data
    )


def mark_budget_alerted(budget_id: str, month: str) -> None:
    # No ownership check — only ever called by the poller against a row id it just read.
    db = get_client(use_service_key=True)
    db.table("user_budgets").update({"last_alerted_month": month}).eq("id", budget_id).execute()


def create_user_goal(
    user_id: str, name: str, target_amount: float, currency: str, target_date: str | None = None
) -> dict:
    db = get_client(use_service_key=True)
    result = (
        db.table("user_goals")
        .insert({
            "user_id": user_id, "name": name, "target_amount": target_amount,
            "currency": currency, "target_date": target_date,
        })
        .execute()
    )
    logger.info("create_user_goal: user_id=%s name=%s target_amount=%s", user_id, name, target_amount)
    return result.data[0]


def get_user_goals(user_id: str) -> list[dict]:
    db = get_client(use_service_key=True)
    return (
        db.table("user_goals")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )


def update_user_goal(goal_id: str, fields: dict, user_id: str) -> dict:
    db = get_client(use_service_key=True)
    result = db.table("user_goals").update(fields).eq("id", goal_id).eq("user_id", user_id).execute()
    if not result.data:
        raise LookupError(f"Goal {goal_id} not found")
    logger.info("update_user_goal: id=%s fields=%s", goal_id, list(fields.keys()))
    return result.data[0]


def contribute_to_goal(goal_id: str, amount: float, user_id: str) -> dict:
    db = get_client(use_service_key=True)
    rows = db.table("user_goals").select("current_amount").eq("id", goal_id).eq("user_id", user_id).execute().data
    if not rows:
        raise LookupError(f"Goal {goal_id} not found")
    new_amount = rows[0]["current_amount"] + amount
    result = (
        db.table("user_goals")
        .update({"current_amount": new_amount})
        .eq("id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    logger.info("contribute_to_goal: id=%s amount=%s new_amount=%s", goal_id, amount, new_amount)
    return result.data[0]


def delete_user_goal(goal_id: str, user_id: str) -> None:
    db = get_client(use_service_key=True)
    result = db.table("user_goals").delete().eq("id", goal_id).eq("user_id", user_id).execute()
    if not result.data:
        raise LookupError(f"Goal {goal_id} not found")
    logger.info("delete_user_goal: id=%s user_id=%s", goal_id, user_id)


def get_portfolio_events(start_date: str | None = None, end_date: str | None = None, user_id: str | None = None):
    """Trade history with account info joined in, for dashboard/frontend display.
    Date bounds are optional — omit both to fetch full history unfiltered.
    user_id=None preserves the legacy dashboard's unscoped behavior."""
    logger.debug("get_portfolio_events: %s to %s", start_date, end_date)
    db = get_client()
    query = db.table("portfolio_events").select("*, accounts(name, currency)")
    if start_date:
        query = query.gte("date", start_date)
    if end_date:
        query = query.lte("date", end_date)
    if user_id is not None:
        query = query.in_("account_id", get_account_ids_for_user(user_id))
    return query.order("date", desc=True).execute().data


def get_all_portfolio_events(user_id: str) -> list[dict]:
    """Full trade history ordered chronologically, needed to roll an average-cost
    basis from scratch (unlike get_portfolio_events, not bounded to a date range)."""
    logger.debug("get_all_portfolio_events")
    db = get_client()
    return (
        db.table("portfolio_events")
        .select("*")
        .in_("account_id", get_account_ids_for_user(user_id))
        .order("date")
        .execute()
        .data
    )


def get_held_positions(user_id: str | None = None) -> list[dict]:
    """Net quantity per (account_id, ticker), derived from BUY/SELL portfolio_events.
    Positions that have been fully sold off (net quantity <= 0) are excluded.
    user_id=None returns positions across every tenant — used only by the system-wide
    equity price updater, which prices every held ticker in one batch regardless of owner."""
    logger.debug("get_held_positions: user_id=%s", user_id)
    db = get_client()
    query = db.table("portfolio_events").select("account_id, ticker, action, quantity").in_("action", ["BUY", "SELL"])
    if user_id is not None:
        query = query.in_("account_id", get_account_ids_for_user(user_id))
    events = query.execute().data
    positions: dict[tuple, float] = {}
    for e in events:
        key = (e["account_id"], e["ticker"])
        sign = 1 if e["action"] == "BUY" else -1
        positions[key] = positions.get(key, 0) + sign * e["quantity"]
    return [
        {"account_id": account_id, "ticker": ticker, "quantity": qty}
        for (account_id, ticker), qty in positions.items()
        if qty > 0
    ]


def get_latest_equity_prices(tickers: list[str]) -> dict[str, dict]:
    """Most recent equity_prices row per ticker. Python-side "latest per group"
    since supabase-py has no group-by — fine at this table's size. Global market
    data, not tenant-scoped."""
    logger.debug("get_latest_equity_prices: tickers=%s", tickers)
    if not tickers:
        return {}
    db = get_client()
    rows = (
        db.table("equity_prices")
        .select("*")
        .in_("ticker", tickers)
        .order("fetched_at", desc=True)
        .execute()
        .data
    )
    latest: dict[str, dict] = {}
    for r in rows:
        if r["ticker"] not in latest:
            latest[r["ticker"]] = r
    return latest


def get_recent_transactions(limit: int, user_id: str) -> list[dict]:
    logger.debug("get_recent_transactions: limit=%d", limit)
    db = get_client()
    return (
        db.table("transactions")
        .select("*, accounts(name, currency)")
        .in_("account_id", get_account_ids_for_user(user_id))
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )


def get_account_cash_totals(user_id: str) -> dict[str, float]:
    """Sums transactions.amount grouped by account_id (Python-side, no group-by
    in supabase-py). Reflects only cash-type activity recorded in `transactions`
    — brokerage accounts' invested value is tracked separately via asset_snapshots."""
    logger.debug("get_account_cash_totals")
    db = get_client()
    rows = (
        db.table("transactions")
        .select("account_id, amount")
        .in_("account_id", get_account_ids_for_user(user_id))
        .execute()
        .data
    )
    totals: dict[str, float] = {}
    for r in rows:
        totals[r["account_id"]] = totals.get(r["account_id"], 0) + r["amount"]
    return totals


def _apply_operator(query, field: str, op: str, value, field_type: str):
    """Applies one already-validated {field, op, value} filter to a supabase-py
    query builder chain, for query_records below. `field_type` (from
    QUERYABLE_SCHEMA) further restricts which operators are valid per field —
    e.g. 'like' only makes sense on text columns."""
    if op == "like" and field_type != "text":
        raise ValueError(f"operator 'like' is not valid for field '{field}'")
    if op == "in":
        if not isinstance(value, list):
            raise ValueError("operator 'in' requires a list value")
        return query.in_(field, value)
    if op == "like":
        return query.ilike(field, f"%{value}%")
    return getattr(query, QUERYABLE_OPERATORS[op])(field, value)


def _group_rows(rows: list[dict], group_by: str, metric_field: str | None) -> list[dict]:
    """Python-side group-by-count(-and-sum) over an already-fetched, already-capped
    row list — query_records never pushes aggregation into SQL, so nothing beyond
    SELECT/WHERE/ORDER/LIMIT is ever needed for this tool."""
    groups: dict = {}
    for r in rows:
        key = r.get(group_by)
        g = groups.setdefault(key, {group_by: key, "count": 0, "sum": 0.0})
        g["count"] += 1
        if metric_field:
            g["sum"] += r.get(metric_field) or 0
    if not metric_field:
        for g in groups.values():
            del g["sum"]
    return sorted(groups.values(), key=lambda g: g["count"], reverse=True)


def query_records(
    user_id: str,
    table: str,
    filters: list[dict],
    start_date: str | None,
    end_date: str | None,
    group_by: str | None,
    limit: int,
) -> dict:
    """Generic, allowlist-scoped read backing bot/finance_agent.py's
    query_financial_records tool — the agent's fallback for ad-hoc questions that
    don't fit one of its purpose-built tools. `table` must be a QUERYABLE_SCHEMA key,
    and every filter's field/op plus group_by must already be validated by the caller
    against that table's schema (same convention as other tool args re-validated in
    bot/finance_agent.py::_run_tool, since a DeepSeek tool call's JSON isn't
    FastAPI/Pydantic-validated). Tenant scoping is applied here unconditionally,
    regardless of what filters the caller passes in — never left to the LLM."""
    schema = QUERYABLE_SCHEMA[table]
    db = get_client()
    query = db.table(table).select("*")
    if schema["scope"] == "account":
        query = query.in_("account_id", get_account_ids_for_user(user_id))
    else:
        query = query.eq("user_id", user_id)
    date_field = schema["date_field"]
    if start_date:
        query = query.gte(date_field, start_date)
    if end_date:
        query = query.lte(date_field, end_date)
    for f in filters:
        field_type = schema["fields"][f["field"]]
        query = _apply_operator(query, f["field"], f["op"], f["value"], field_type)
    rows = query.order(date_field, desc=True).limit(limit).execute().data
    result = {"rows": rows, "row_count": len(rows), "truncated": len(rows) == limit}
    if group_by:
        result["grouped"] = _group_rows(rows, group_by, schema.get("metric_field"))
    return result


def delete_transactions(ids: list[str], user_id: str):
    if not ids:
        return
    db = get_client(use_service_key=True)
    try:
        result = (
            db.table("transactions")
            .delete()
            .in_("id", ids)
            .in_("account_id", get_account_ids_for_user(user_id))
            .execute()
        )
    except Exception:
        logger.exception("delete_transactions failed for ids=%s", ids)
        raise
    logger.info("delete_transactions: removed %d row(s)", len(result.data or []))
    return result


def delete_portfolio_events(ids: list[str], user_id: str):
    if not ids:
        return
    db = get_client(use_service_key=True)
    try:
        result = (
            db.table("portfolio_events")
            .delete()
            .in_("id", ids)
            .in_("account_id", get_account_ids_for_user(user_id))
            .execute()
        )
    except Exception:
        logger.exception("delete_portfolio_events failed for ids=%s", ids)
        raise
    logger.info("delete_portfolio_events: removed %d row(s)", len(result.data or []))
    return result


def insert_equity_prices(rows: list[dict]):
    db = get_client(use_service_key=True)
    try:
        result = db.table("equity_prices").insert(rows).execute()
    except Exception:
        logger.exception("insert_equity_prices failed for %d row(s)", len(rows))
        raise
    logger.info("insert_equity_prices: saved %d row(s)", len(rows))
    return result


def upsert_asset_snapshot(
    account_id: str, snapshot_date: str, total_value: float, currency: str, user_id: str, notes: str = None
):
    _validate_owned_account(account_id, user_id)
    db = get_client(use_service_key=True)
    try:
        result = (
            db.table("asset_snapshots")
            .upsert(
                {
                    "account_id": account_id,
                    "snapshot_date": snapshot_date,
                    "total_value": total_value,
                    "currency": currency,
                    "notes": notes,
                },
                on_conflict="account_id,snapshot_date",
            )
            .execute()
        )
    except Exception:
        logger.exception("upsert_asset_snapshot failed for account_id=%s date=%s", account_id, snapshot_date)
        raise
    logger.info(
        "upsert_asset_snapshot: account_id=%s date=%s total_value=%.2f %s",
        account_id, snapshot_date, total_value, currency,
    )
    return result


# ── Users & Telegram linking ──────────────────────────────────────────────

def create_user(email: str, password_hash: str, notify_email: str | None = None) -> dict:
    db = get_client(use_service_key=True)
    result = (
        db.table("users")
        .insert({"email": email, "password_hash": password_hash, "notify_email": notify_email or email})
        .execute()
    )
    logger.info("create_user: email=%s", email)
    return result.data[0]


def get_user_by_email(email: str) -> dict | None:
    db = get_client(use_service_key=True)
    rows = db.table("users").select("*").eq("email", email).execute().data
    return rows[0] if rows else None


def get_user_by_id(user_id: str) -> dict | None:
    db = get_client(use_service_key=True)
    rows = db.table("users").select("*").eq("id", user_id).execute().data
    return rows[0] if rows else None


def update_user(user_id: str, fields: dict) -> dict:
    db = get_client(use_service_key=True)
    result = db.table("users").update(fields).eq("id", user_id).execute()
    if not result.data:
        raise LookupError(f"User {user_id} not found")
    logger.info("update_user: id=%s fields=%s", user_id, list(fields.keys()))
    return result.data[0]


def get_user_by_telegram_chat_id(telegram_chat_id: int) -> dict | None:
    db = get_client(use_service_key=True)
    rows = db.table("users").select("*").eq("telegram_chat_id", telegram_chat_id).execute().data
    return rows[0] if rows else None


def get_all_users() -> list[dict]:
    db = get_client(use_service_key=True)
    return db.table("users").select("*").execute().data


def get_users_with_telegram() -> list[dict]:
    db = get_client(use_service_key=True)
    return db.table("users").select("*").not_.is_("telegram_chat_id", "null").execute().data


def create_telegram_link_code(user_id: str, code: str, expires_at: datetime) -> dict:
    db = get_client(use_service_key=True)
    result = (
        db.table("telegram_link_codes")
        .insert({"code": code, "user_id": user_id, "expires_at": expires_at.isoformat()})
        .execute()
    )
    logger.info("create_telegram_link_code: user_id=%s", user_id)
    return result.data[0]


def consume_telegram_link_code(code: str, telegram_chat_id: int) -> dict | None:
    """Looks up an unused, unexpired code, marks it used, releases the chat id from
    any other user currently holding it (device re-linked to a different account),
    and binds it to the code's owning user. Three sequential statements, not one
    transaction — acceptable for an invite-only, low-concurrency tool."""
    db = get_client(use_service_key=True)
    now = datetime.now(timezone.utc).isoformat()
    rows = (
        db.table("telegram_link_codes")
        .select("*")
        .eq("code", code)
        .is_("used_at", "null")
        .gt("expires_at", now)
        .execute()
        .data
    )
    if not rows:
        return None
    link_code = rows[0]
    db.table("telegram_link_codes").update({"used_at": now}).eq("code", code).execute()
    db.table("users").update({"telegram_chat_id": None}).eq("telegram_chat_id", telegram_chat_id).execute()
    result = db.table("users").update({"telegram_chat_id": telegram_chat_id}).eq("id", link_code["user_id"]).execute()
    logger.info("consume_telegram_link_code: user_id=%s telegram_chat_id=%s", link_code["user_id"], telegram_chat_id)
    return result.data[0] if result.data else None
