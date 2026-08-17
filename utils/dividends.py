from db.supabase import get_portfolio_events
from utils.fx import convert


def compute_dividend_total(
    user_id: str, display_currency: str, start_date: str | None = None, end_date: str | None = None
) -> dict:
    """Sum of DIVIDEND-action portfolio_events (quantity * price per row), each
    converted to display_currency via utils/fx.py — the one piece of dividend
    reporting that needs FX conversion; the by-currency chart breakdown deliberately
    stays unconverted and is computed client-side from the same raw portfolio_events."""
    events = get_portfolio_events(start_date, end_date, user_id)
    total = sum(
        convert(e["quantity"] * e["price"], e["currency"], display_currency)
        for e in events
        if e["action"] == "DIVIDEND"
    )
    return {"total": total, "currency": display_currency}
