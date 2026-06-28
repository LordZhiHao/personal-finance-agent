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


def get_accounts():
    db = get_client()
    return db.table("accounts").select("*").eq("is_active", True).execute().data
