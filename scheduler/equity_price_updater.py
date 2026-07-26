from datetime import date, datetime, timezone

from db.supabase import (
    get_accounts,
    get_held_positions,
    insert_equity_prices,
    upsert_asset_snapshot,
)
from utils.constants import TICKER_YFINANCE_MAP
from utils.equity_pricing import fetch_prices
from utils.fx import convert
from utils.logger import get_logger

logger = get_logger(__name__)


def update_equity_prices(user_id: str | None = None):
    """user_id=None (the hourly/end-of-day APScheduler jobs) prices every tenant's held
    positions in one batch. A concrete user_id (the manual "Refresh Prices" button)
    scopes both the held-position lookup and the account lookup to that user only.

    Every brokerage account gets a same-day asset_snapshots row, not just ones with a
    currently-held, successfully-priced position — otherwise a fully-sold-off account
    silently stops appearing in history instead of showing $0. An account whose held
    position simply failed to price today (yfinance outage/rate-limit) is left alone
    rather than zeroed, so a transient fetch failure can't destroy a real prior value."""
    logger.info("update_equity_prices: starting (user_id=%s)", user_id)
    accounts = {a["id"]: a for a in get_accounts(account_type="brokerage", user_id=user_id)}
    positions = get_held_positions(user_id)

    price_rows: list[dict] = []
    totals: dict[str, float] = {}
    held_account_ids: set[str] = set()
    if positions:
        held_account_ids = {p["account_id"] for p in positions}
        symbols = sorted({TICKER_YFINANCE_MAP.get(p["ticker"], p["ticker"]) for p in positions})
        prices = fetch_prices(symbols)

        fetched_at = datetime.now(timezone.utc).isoformat()
        price_rows = [
            {"ticker": symbol, "price": data["price"], "currency": data["currency"], "fetched_at": fetched_at}
            for symbol, data in prices.items()
        ]
        if price_rows:
            insert_equity_prices(price_rows)

        for p in positions:
            symbol = TICKER_YFINANCE_MAP.get(p["ticker"], p["ticker"])
            quote = prices.get(symbol)
            if not quote:
                logger.warning("update_equity_prices: no price for %s (%s) — excluded from snapshot", p["ticker"], symbol)
                continue
            account = accounts.get(p["account_id"])
            account_currency = account["currency"] if account else quote["currency"]
            value = p["quantity"] * convert(quote["price"], quote["currency"], account_currency)
            totals[p["account_id"]] = totals.get(p["account_id"], 0) + value
    else:
        logger.info("update_equity_prices: no equity positions held")

    today = date.today().isoformat()
    accounts_refreshed = 0
    for account_id, account in accounts.items():
        if account_id in totals:
            total_value = totals[account_id]
        elif account_id not in held_account_ids:
            total_value = 0.0
        else:
            logger.warning(
                "update_equity_prices: held position(s) in account=%s failed to price today — snapshot left untouched",
                account_id,
            )
            continue
        upsert_asset_snapshot(
            account_id,
            today,
            total_value,
            account["currency"],
            user_id=account["user_id"],
            notes="auto: equity price update",
        )
        accounts_refreshed += 1

    logger.info(
        "update_equity_prices: complete — %d symbol(s) priced, %d account snapshot(s) refreshed",
        len(price_rows), accounts_refreshed,
    )
    return {"symbols_priced": len(price_rows), "accounts_refreshed": accounts_refreshed}
