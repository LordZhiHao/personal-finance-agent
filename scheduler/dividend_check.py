from bot.handlers import chunk_lines
from db.supabase import get_all_portfolio_events, get_all_users, get_held_positions, insert_portfolio_events
from utils.constants import TICKER_YFINANCE_MAP
from utils.equity_pricing import fetch_dividends
from utils.formatters import format_money
from utils.logger import get_logger

logger = get_logger(__name__)


def _quantity_as_of(events: list[dict], as_of_date: str) -> float:
    """events: one (account_id, ticker)'s BUY/SELL rows. Sums signed quantity up to
    and including as_of_date — same accumulation as get_held_positions, but cut off
    at a point in time instead of summing full history."""
    qty = 0.0
    for e in events:
        if e["date"] > as_of_date:
            continue
        qty += e["quantity"] if e["action"] == "BUY" else -e["quantity"]
    return qty


def _scan_user_dividends(user_id: str) -> list[dict]:
    """Detects dividends paid on this user's currently held positions via yfinance,
    auto-inserts any not already logged, and returns the newly-inserted rows."""
    positions = get_held_positions(user_id)
    if not positions:
        return []

    all_events = get_all_portfolio_events(user_id)
    existing = {(e["account_id"], e["ticker"], e["date"]) for e in all_events if e["action"] == "DIVIDEND"}
    events_by_key: dict[tuple, list[dict]] = {}
    for e in all_events:
        if e["action"] in ("BUY", "SELL"):
            events_by_key.setdefault((e["account_id"], e["ticker"]), []).append(e)

    symbols = {p["ticker"]: TICKER_YFINANCE_MAP.get(p["ticker"], p["ticker"]) for p in positions}
    dividends = fetch_dividends(sorted(set(symbols.values())))

    new_rows = []
    for p in positions:
        for div in dividends.get(symbols[p["ticker"]], []):
            key = (p["account_id"], p["ticker"], div["ex_date"])
            if key in existing:
                continue
            qty = _quantity_as_of(events_by_key.get((p["account_id"], p["ticker"]), []), div["ex_date"])
            if qty <= 0:
                continue
            new_rows.append(
                {
                    "account_id": p["account_id"],
                    "date": div["ex_date"],
                    "ticker": p["ticker"],
                    "action": "DIVIDEND",
                    "quantity": qty,
                    "price": div["amount_per_share"],
                    "currency": div["currency"],
                    "fees": None,
                    "notes": "auto: dividend detected via yfinance",
                }
            )

    if new_rows:
        insert_portfolio_events(new_rows, user_id)
        logger.info("_scan_user_dividends: user_id=%s logged %d new dividend row(s)", user_id, len(new_rows))
    return new_rows


async def send_dividend_notifications(bot):
    """Loops every user (like weekly_report.py), auto-logging dividends for all of
    them, but only Telegram-notifying those with a linked chat."""
    users = get_all_users()
    logger.info("send_dividend_notifications: scanning %d user(s)", len(users))
    for user in users:
        try:
            new_rows = _scan_user_dividends(user["id"])
        except Exception:
            logger.exception("send_dividend_notifications: scan failed for user_id=%s", user["id"])
            continue

        if not new_rows or not user.get("telegram_chat_id"):
            continue

        lines = [
            f"{r['ticker']}: {format_money(r['quantity'] * r['price'], r['currency'])} (ex-div {r['date']})"
            for r in new_rows
        ]
        try:
            for chunk in chunk_lines(lines):
                await bot.send_message(
                    chat_id=user["telegram_chat_id"],
                    text="💰 *New dividends auto-logged:*\n" + chunk,
                    parse_mode="Markdown",
                )
        except Exception:
            logger.exception("send_dividend_notifications: telegram send failed for user_id=%s", user["id"])

    logger.info("send_dividend_notifications: complete")
