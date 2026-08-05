from datetime import date, timedelta

from dateutil.relativedelta import relativedelta

from db.supabase import get_account_ids_for_user, get_category_classifications_for_user, get_client
from utils.constants import DEFAULT_CURRENCY
from utils.fx import convert


def summarize_transactions(txns: list[dict], classifications: dict[str, str]) -> dict:
    """Income/expense/category aggregation shared by the weekly report and
    the /expense command — only the date range differs between callers.

    `classifications` (category name -> "expense" | "income" | "transfer" | "investment",
    from db.supabase.get_category_classifications_for_user) decides whether a negative-
    amount row counts as spending. Only "expense"-classified rows count toward `expenses`/
    `by_category`; "investment"-classified rows are broken out into `invested` instead;
    "income"/"transfer"-classified rows with a negative amount (e.g. an outgoing transfer)
    count toward neither — they're not spending and not investing."""
    income = sum(t["amount"] for t in txns if t["amount"] > 0)
    expenses = 0.0
    invested = 0.0
    by_category = {}
    for t in txns:
        if t["amount"] >= 0:
            continue
        cat = t.get("category") or "Other"
        amount = abs(t["amount"])
        classification = classifications.get(cat, "expense")
        if classification == "investment":
            invested += amount
        elif classification == "expense":
            expenses += amount
            by_category[cat] = by_category.get(cat, 0) + amount
    net = income - expenses
    savings_rate = round((net / income * 100), 1) if income else 0
    by_category = dict(sorted(by_category.items(), key=lambda x: x[1], reverse=True))

    return {
        "income": income,
        "expenses": expenses,
        "invested": invested,
        "net": net,
        "savings_rate": savings_rate,
        "by_category": by_category,
    }


def budget_status(txns: list[dict], budgets: list[dict], classifications: dict[str, str]) -> list[dict]:
    """Month-to-date spend vs. each budgeted category's monthly_limit. `txns` should
    already be scoped to the current calendar month — shared by the finance agent's
    get_budget_status tool, GET /api/budgets/status, and scheduler/user_budgets.py's
    over-limit poll, so all three agree on the same numbers."""
    by_category = summarize_transactions(txns, classifications)["by_category"]
    return [
        {
            "id": b["id"],
            "category": b["category"],
            "monthly_limit": b["monthly_limit"],
            "currency": b["currency"],
            "spent": by_category.get(b["category"], 0.0),
        }
        for b in budgets
    ]


def month_comparison(txns: list[dict], classifications: dict[str, str]) -> list[dict]:
    """Expense-by-category totals across three calendar-month buckets — current,
    previous, and the same month one year ago — mirroring
    frontend/src/lib/dates.ts's monthComparison() so the bot's /compare command
    and the dashboard's MonthComparisonBarChart agree on the same buckets.
    Sorted descending by current-month spend. Only "expense"-classified categories
    (see summarize_transactions) are included — Investment/Transfer no longer show
    up as comparison columns."""
    today = date.today()
    current_month = today.replace(day=1)
    previous_month = current_month - relativedelta(months=1)
    year_ago_month = current_month - relativedelta(months=12)

    totals: dict[str, dict[str, float]] = {}
    for t in txns:
        if t["amount"] >= 0:
            continue
        cat = t.get("category") or "Other"
        if classifications.get(cat, "expense") != "expense":
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

        row = totals.setdefault(cat, {"current": 0.0, "previous": 0.0, "year_ago": 0.0})
        row[bucket] += abs(t["amount"])

    rows = [{"category": cat, **v} for cat, v in totals.items()]
    rows.sort(key=lambda r: r["current"], reverse=True)
    return rows


def get_weekly_data(user_id: str, display_currency: str = DEFAULT_CURRENCY) -> dict:
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

    summary = summarize_transactions(txns, get_category_classifications_for_user(user_id))

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
    total_assets = sum(convert(s["total_value"], s["currency"], display_currency) for s in latest_snapshots)

    return {
        "week_start": week_start,
        "week_end": week_end,
        **summary,
        "snapshots": latest_snapshots,
        "total_assets": total_assets,
        "currency": display_currency,
    }
