from datetime import date, timedelta

from dateutil.relativedelta import relativedelta

PERIOD_LABELS = {
    "day": "the past day",
    "week": "the past week",
    "month": "the past month",
    "year": "the past year",
    "month_to_date": "this month so far",
}

_DEFAULT_PERIOD = "week"


def parse_period(arg: str | None) -> tuple[date, date, str]:
    """Maps a `day|week|month|year|month_to_date` arg to a date window ending
    today. `month` is a trailing ~30-day window; `month_to_date` is the current
    calendar month from the 1st. Falls back to `week` for missing/unrecognised
    args. Returns (start_date, end_date, label) for use in both querying and
    messages."""
    period = (arg or "").strip().lower()
    if period not in PERIOD_LABELS:
        period = _DEFAULT_PERIOD

    today = date.today()
    if period == "day":
        start = today
    elif period == "week":
        start = today - timedelta(days=7)
    elif period == "month":
        start = today - relativedelta(months=1)
    elif period == "month_to_date":
        start = today.replace(day=1)
    else:  # year
        start = today - relativedelta(years=1)

    return start, today, PERIOD_LABELS[period]
