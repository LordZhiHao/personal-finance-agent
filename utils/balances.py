from db.supabase import get_account_cash_totals, get_accounts, get_latest_snapshots
from utils.fx import convert


def compute_account_balances(display_currency: str = "SGD", accounts: list[dict] | None = None) -> dict:
    """Per-account balance, unified across account types: bank/ewallet balances come
    from summed transactions.amount (get_account_cash_totals), brokerage balances come
    from the latest asset_snapshots row instead, since brokerage cash flow isn't tracked
    separately from invested value anywhere in this codebase. Shared by /balance and the
    dashboard's balances view so both report the same numbers from one implementation."""
    accounts = accounts if accounts is not None else get_accounts()
    cash_totals = get_account_cash_totals()
    snapshots_by_account = {s["account_id"]: s for s in get_latest_snapshots()}

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
