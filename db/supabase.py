import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client

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
    otherwise raises LookupError (translated to a 404 by the backend)."""
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


def create_account(user_id: str, name: str, type_: str, currency: str) -> dict:
    db = get_client(use_service_key=True)
    result = (
        db.table("accounts")
        .insert({"name": name, "type": type_, "currency": currency, "user_id": user_id, "is_active": True})
        .execute()
    )
    logger.info("create_account: user_id=%s name=%s type=%s currency=%s", user_id, name, type_, currency)
    return result.data[0]


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
