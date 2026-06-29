import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()


def get_client(use_service_key: bool = False):
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") if use_service_key \
        else os.getenv("SUPABASE_ANON_KEY")
    return create_client(url, key)


def insert_transactions(rows: list[dict]):
    db = get_client(use_service_key=True)
    return db.table("transactions").insert(rows).execute()


def insert_portfolio_events(rows: list[dict]):
    db = get_client(use_service_key=True)
    return db.table("portfolio_events").insert(rows).execute()


def get_transactions(start_date: str, end_date: str):
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


def get_latest_snapshots():
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
    db = get_client()
    query = db.table("accounts").select("*").eq("is_active", True)
    if account_type:
        types = [account_type] if isinstance(account_type, str) else account_type
        query = query.in_("type", types)
    return query.execute().data


def get_portfolio_events(start_date: str, end_date: str):
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


def get_held_positions() -> list[dict]:
    """Net quantity per (account_id, ticker), derived from BUY/SELL portfolio_events.
    Positions that have been fully sold off (net quantity <= 0) are excluded."""
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


def insert_equity_prices(rows: list[dict]):
    db = get_client(use_service_key=True)
    return db.table("equity_prices").insert(rows).execute()


def upsert_asset_snapshot(account_id: str, snapshot_date: str, total_value: float, currency: str, notes: str = None):
    db = get_client(use_service_key=True)
    return (
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
