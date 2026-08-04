import re
from collections import defaultdict
from datetime import date, timedelta

from utils.constants import DEFAULT_CURRENCY

# Trailing digits/punctuation (reference numbers, embedded dates) stripped so
# near-identical charge descriptions collapse into one group — no fuzzy-matching
# library involved, since none is in requirements.txt.
_TRAILING_NUMERIC_RE = re.compile(r"[\d/\-.:]+$")

MIN_OCCURRENCES = 3
AMOUNT_TOLERANCE = 0.10
MIN_INTERVAL_DAYS = 25
MAX_INTERVAL_DAYS = 35


def _normalize_description(description: str) -> str:
    normalized = description.strip().lower()
    return _TRAILING_NUMERIC_RE.sub("", normalized).strip()


def detect_recurring_charges(txns: list[dict], lookback_months: int = 6) -> list[dict]:
    """Heuristic, Python-side pass over already-fetched transactions (same style as
    scheduler/report_builder.py's month_comparison) — groups expense rows by a
    normalized description, and flags a group as recurring if it has enough
    occurrences at a roughly-monthly cadence with consistent amounts. Purely
    computed on demand — no persistence table, so a cancelled subscription just
    stops appearing rather than needing cleanup."""
    cutoff = date.today() - timedelta(days=lookback_months * 31)
    groups: dict[str, list[dict]] = defaultdict(list)
    for t in txns:
        if t["amount"] >= 0:
            continue
        t_date = date.fromisoformat(t["date"])
        if t_date < cutoff:
            continue
        key = _normalize_description(t.get("description") or "")
        if not key:
            continue
        groups[key].append({**t, "_date": t_date})

    results = []
    for rows in groups.values():
        if len(rows) < MIN_OCCURRENCES:
            continue
        rows.sort(key=lambda r: r["_date"])

        amounts = [abs(r["amount"]) for r in rows]
        avg_amount = sum(amounts) / len(amounts)
        if avg_amount == 0 or any(abs(a - avg_amount) / avg_amount > AMOUNT_TOLERANCE for a in amounts):
            continue

        intervals = [(rows[i]["_date"] - rows[i - 1]["_date"]).days for i in range(1, len(rows))]
        avg_interval = sum(intervals) / len(intervals)
        if not (MIN_INTERVAL_DAYS <= avg_interval <= MAX_INTERVAL_DAYS):
            continue

        last = rows[-1]
        results.append({
            "description": last["description"],
            "amount": round(avg_amount, 2),
            "currency": last.get("currency", DEFAULT_CURRENCY),
            "cadence": "monthly",
            "last_charge_date": last["_date"].isoformat(),
            "next_expected_date": (last["_date"] + timedelta(days=round(avg_interval))).isoformat(),
            "occurrences": len(rows),
        })

    results.sort(key=lambda r: r["next_expected_date"])
    return results
