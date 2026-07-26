from datetime import date, timedelta

from db.supabase import get_account_cash_totals, get_accounts, get_latest_snapshots, get_snapshot_history
from utils.fx import convert


def compute_account_balances(user_id: str, display_currency: str = "SGD", accounts: list[dict] | None = None) -> dict:
    """Per-account balance, unified across account types: bank/ewallet balances come
    from summed transactions.amount (get_account_cash_totals), brokerage balances come
    from the latest asset_snapshots row instead, since brokerage cash flow isn't tracked
    separately from invested value anywhere in this codebase. Shared by /balance and the
    dashboard's balances view so both report the same numbers from one implementation."""
    accounts = accounts if accounts is not None else get_accounts(user_id=user_id)
    cash_totals = get_account_cash_totals(user_id)
    snapshots_by_account = {s["account_id"]: s for s in get_latest_snapshots(user_id=user_id)}

    balances = []
    total = 0.0
    for a in accounts:
        if a["type"] == "brokerage":
            snap = snapshots_by_account.get(a["id"])
            balance = convert(snap["total_value"], snap["currency"], display_currency) if snap else None
        else:
            balance = convert(cash_totals.get(a["id"], 0.0), a["currency"], display_currency)

        balances.append({
            "account_id": a["id"],
            "account_name": a["name"],
            "type": a["type"],
            "balance": balance,
        })
        if balance is not None:
            total += balance

    return {"balances": balances, "total": total, "currency": display_currency}


def compute_net_worth_trend(user_id: str, display_currency: str = "SGD", lookback_days: int = 7) -> dict:
    """Net worth now vs. `lookback_days` ago. "Now" reuses get_latest_snapshots
    (the same total /assets already reports); the comparison point takes each
    account's own latest snapshot on/before the target date, rather than summing
    whatever snapshots happen to share one exact calendar date — accounts don't
    all get snapshotted on the same day (manual ones especially, or a brokerage
    account added after the target date), so a same-date sum would compare
    mismatched sets of accounts and produce a nonsense delta. Returns None fields
    where there isn't enough history for a comparison."""
    empty = {"current_total": None, "current_date": None, "compare_total": None,
             "compare_date": None, "delta": None, "delta_pct": None}

    current_snapshots = get_latest_snapshots(user_id=user_id)
    if not current_snapshots:
        return empty
    current_total = sum(convert(s["total_value"], s["currency"], display_currency) for s in current_snapshots)
    current_date = max(s["snapshot_date"] for s in current_snapshots)

    target = (date.today() - timedelta(days=lookback_days)).isoformat()
    history = get_snapshot_history(user_id, end_date=target)
    latest_per_account: dict[str, dict] = {}
    for row in history:
        existing = latest_per_account.get(row["account_id"])
        if existing is None or row["snapshot_date"] > existing["snapshot_date"]:
            latest_per_account[row["account_id"]] = row

    # Only compare if every currently-tracked account also has snapshot history back to
    # the target date — otherwise the "compare" total silently omits accounts the
    # "current" total includes (e.g. a brokerage account added this week), which would
    # understate the past and produce a misleading delta rather than an honest one.
    current_account_ids = {s["account_id"] for s in current_snapshots}
    if not current_account_ids.issubset(latest_per_account.keys()):
        return {**empty, "current_total": current_total, "current_date": current_date}

    compare_total = sum(convert(s["total_value"], s["currency"], display_currency) for s in latest_per_account.values())
    compare_date = max(s["snapshot_date"] for s in latest_per_account.values())
    delta = current_total - compare_total
    delta_pct = (delta / compare_total * 100) if compare_total else None

    return {
        "current_total": current_total,
        "current_date": current_date,
        "compare_total": compare_total,
        "compare_date": compare_date,
        "delta": delta,
        "delta_pct": delta_pct,
    }
