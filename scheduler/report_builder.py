from datetime import date, timedelta

from db.supabase import get_client


def get_weekly_data() -> dict:
    db = get_client()
    today = date.today()
    # Last full Mon–Sun window
    days_since_sunday = (today.weekday() + 1) % 7
    week_end = today - timedelta(days=days_since_sunday)
    week_start = week_end - timedelta(days=6)

    txns = (
        db.table("transactions")
        .select("*")
        .gte("date", week_start.isoformat())
        .lte("date", week_end.isoformat())
        .execute()
        .data
    )

    income = sum(t["amount"] for t in txns if t["amount"] > 0)
    expenses = abs(sum(t["amount"] for t in txns if t["amount"] < 0))
    net = income - expenses
    savings_rate = round((net / income * 100), 1) if income else 0

    by_category = {}
    for t in txns:
        if t["amount"] < 0:
            cat = t.get("category") or "Other"
            by_category[cat] = by_category.get(cat, 0) + abs(t["amount"])
    by_category = dict(sorted(by_category.items(), key=lambda x: x[1], reverse=True))

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
    latest_snapshots = list(seen.values())
    total_assets = sum(s["total_value"] for s in latest_snapshots)

    return {
        "week_start": week_start,
        "week_end": week_end,
        "income": income,
        "expenses": expenses,
        "net": net,
        "savings_rate": savings_rate,
        "by_category": by_category,
        "snapshots": latest_snapshots,
        "total_assets": total_assets,
    }
