import os
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


def insert_transactions(rows: list[dict]):
    db = get_client(use_service_key=True)
    try:
        result = db.table("transactions").insert(rows).execute()
    except Exception:
        logger.exception("insert_transactions failed for %d row(s)", len(rows))
        raise
    logger.info("insert_transactions: saved %d row(s)", len(rows))
    return result


def insert_portfolio_events(rows: list[dict]):
    db = get_client(use_service_key=True)
    try:
        result = db.table("portfolio_events").insert(rows).execute()
    except Exception:
        logger.exception("insert_portfolio_events failed for %d row(s)", len(rows))
        raise
    logger.info("insert_portfolio_events: saved %d row(s)", len(rows))
    return result


def get_transactions(start_date: str, end_date: str):
    logger.debug("get_transactions: %s to %s", start_date, end_date)
    db = get_client()
    return (
        db.table("transactions")
        .select("*, accounts(name, currency)")
        .gte("date", start_date)
        .lte("date", end_date)
        .order("date", desc=True)
        .execute()
        .data
    )


def update_transaction(transaction_id: str, fields: dict):
    logger.info("update_transaction: id=%s fields=%s", transaction_id, list(fields.keys()))
    db = get_client()
    db.table("transactions").update(fields).eq("id", transaction_id).execute()


def dashboard_insert_portfolio_event(row: dict):
    db = get_client()
    try:
        result = db.table("portfolio_events").insert(row).execute()
    except Exception:
        logger.exception("dashboard_insert_portfolio_event failed for ticker=%s", row.get("ticker"))
        raise
    logger.info("dashboard_insert_portfolio_event: saved ticker=%s action=%s", row.get("ticker"), row.get("action"))
    return result


def get_latest_snapshots():
    logger.debug("get_latest_snapshots")
    db = get_client()
    snapshots = (
        db.table("asset_snapshots")
        .select("*, accounts(name, currency)")
        .order("snapshot_date", desc=True)
        .limit(50)
        .execute()
        .data
    )
    seen = {}
    for s in snapshots:
        if s["account_id"] not in seen:
            seen[s["account_id"]] = s
    return list(seen.values())


def get_accounts(account_type: str | list[str] | None = None):
    logger.debug("get_accounts: type=%s", account_type)
    db = get_client()
    query = db.table("accounts").select("*").eq("is_active", True)
    if account_type:
        types = [account_type] if isinstance(account_type, str) else account_type
        query = query.in_("type", types)
    return query.execute().data


def get_portfolio_events(start_date: str, end_date: str):
    logger.debug("get_portfolio_events: %s to %s", start_date, end_date)
    db = get_client()
    return (
        db.table("portfolio_events")
        .select("*, accounts(name, currency)")
        .gte("date", start_date)
        .lte("date", end_date)
        .order("date", desc=True)
        .execute()
        .data
    )


def get_all_portfolio_events() -> list[dict]:
    """Full trade history ordered chronologically, needed to roll an average-cost
    basis from scratch (unlike get_portfolio_events, not bounded to a date range)."""
    logger.debug("get_all_portfolio_events")
    db = get_client()
    return (
        db.table("portfolio_events")
        .select("*")
        .order("date")
        .execute()
        .data
    )


def get_held_positions() -> list[dict]:
    """Net quantity per (account_id, ticker), derived from BUY/SELL portfolio_events.
    Positions that have been fully sold off (net quantity <= 0) are excluded."""
    logger.debug("get_held_positions")
    db = get_client()
    events = (
        db.table("portfolio_events")
        .select("account_id, ticker, action, quantity")
        .in_("action", ["BUY", "SELL"])
        .execute()
        .data
    )
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
    since supabase-py has no group-by — fine at this table's size."""
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


def get_recent_transactions(limit: int) -> list[dict]:
    logger.debug("get_recent_transactions: limit=%d", limit)
    db = get_client()
    return (
        db.table("transactions")
        .select("*, accounts(name, currency)")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )


def get_account_cash_totals() -> dict[str, float]:
    """Sums transactions.amount grouped by account_id (Python-side, no group-by
    in supabase-py). Reflects only cash-type activity recorded in `transactions`
    — brokerage accounts' invested value is tracked separately via asset_snapshots."""
    logger.debug("get_account_cash_totals")
    db = get_client()
    rows = db.table("transactions").select("account_id, amount").execute().data
    totals: dict[str, float] = {}
    for r in rows:
        totals[r["account_id"]] = totals.get(r["account_id"], 0) + r["amount"]
    return totals


def delete_transactions(ids: list[str]):
    if not ids:
        return
    db = get_client(use_service_key=True)
    try:
        result = db.table("transactions").delete().in_("id", ids).execute()
    except Exception:
        logger.exception("delete_transactions failed for ids=%s", ids)
        raise
    logger.info("delete_transactions: removed %d row(s)", len(ids))
    return result


def delete_portfolio_events(ids: list[str]):
    if not ids:
        return
    db = get_client(use_service_key=True)
    try:
        result = db.table("portfolio_events").delete().in_("id", ids).execute()
    except Exception:
        logger.exception("delete_portfolio_events failed for ids=%s", ids)
        raise
    logger.info("delete_portfolio_events: removed %d row(s)", len(ids))
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


def upsert_asset_snapshot(account_id: str, snapshot_date: str, total_value: float, currency: str, notes: str = None):
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
