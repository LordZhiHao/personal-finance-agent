from datetime import date, timedelta

from dateutil.relativedelta import relativedelta

from db.supabase import get_account_ids_for_user, get_client


def summarize_transactions(txns: list[dict]) -> dict:
    """Income/expense/category aggregation shared by the weekly report and
    the /expense command — only the date range differs between callers."""
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

    return {
        "income": income,
        "expenses": expenses,
        "net": net,
        "savings_rate": savings_rate,
        "by_category": by_category,
    }


def month_comparison(txns: list[dict]) -> list[dict]:
    """Expense-by-category totals across three calendar-month buckets — current,
    previous, and the same month one year ago — mirroring
    frontend/src/lib/dates.ts's monthComparison() so the bot's /compare command
    and the dashboard's MonthComparisonBarChart agree on the same buckets.
    Sorted descending by current-month spend."""
    today = date.today()
    current_month = today.replace(day=1)
    previous_month = current_month - relativedelta(months=1)
    year_ago_month = current_month - relativedelta(months=12)

    totals: dict[str, dict[str, float]] = {}
    for t in txns:
        if t["amount"] >= 0:
            continue
        t_month = date.fromisoformat(t["date"]).replace(day=1)
        if t_month == current_month:
            bucket = "current"
        elif t_month == previous_month:
            bucket = "previous"
        elif t_month == year_ago_month:
            bucket = "year_ago"
        else:
            continue

        cat = t.get("category") or "Other"
        row = totals.setdefault(cat, {"current": 0.0, "previous": 0.0, "year_ago": 0.0})
        row[bucket] += abs(t["amount"])

    rows = [{"category": cat, **v} for cat, v in totals.items()]
    rows.sort(key=lambda r: r["current"], reverse=True)
    return rows


def get_weekly_data(user_id: str) -> dict:
    db = get_client()
    today = date.today()
    # Last full Mon–Sun window
    days_since_sunday = (today.weekday() + 1) % 7
    week_end = today - timedelta(days=days_since_sunday)
    week_start = week_end - timedelta(days=6)

    account_ids = get_account_ids_for_user(user_id)

    txns = (
        db.table("transactions")
        .select("*")
        .in_("account_id", account_ids)
        .gte("date", week_start.isoformat())
        .lte("date", week_end.isoformat())
        .execute()
        .data
        if account_ids else []
    )

    summary = summarize_transactions(txns)

    snapshots = (
        db.table("asset_snapshots")
        .select("*, accounts(name, currency)")
        .in_("account_id", account_ids)
        .order("snapshot_date", desc=True)
        .limit(50)
        .execute()
        .data
        if account_ids else []
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
        **summary,
        "snapshots": latest_snapshots,
        "total_assets": total_assets,
    }
