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


def update_equity_prices():
    positions = get_held_positions()
    if not positions:
        print("No equity positions held — skipping price update")
        return

    accounts = {a["id"]: a["currency"] for a in get_accounts()}
    symbols = sorted({TICKER_YFINANCE_MAP.get(p["ticker"], p["ticker"]) for p in positions})
    prices = fetch_prices(symbols)

    fetched_at = datetime.now(timezone.utc).isoformat()
    price_rows = [
        {"ticker": symbol, "price": data["price"], "currency": data["currency"], "fetched_at": fetched_at}
        for symbol, data in prices.items()
    ]
    if price_rows:
        insert_equity_prices(price_rows)

    totals: dict[str, float] = {}
    for p in positions:
        symbol = TICKER_YFINANCE_MAP.get(p["ticker"], p["ticker"])
        quote = prices.get(symbol)
        if not quote:
            print(f"⚠️ No price for {p['ticker']} ({symbol}) — excluded from snapshot")
            continue
        account_currency = accounts.get(p["account_id"], quote["currency"])
        value = p["quantity"] * convert(quote["price"], quote["currency"], account_currency)
        totals[p["account_id"]] = totals.get(p["account_id"], 0) + value

    today = date.today().isoformat()
    for account_id, total_value in totals.items():
        upsert_asset_snapshot(
            account_id,
            today,
            total_value,
            accounts[account_id],
            notes="auto: hourly equity price update",
        )

    print(f"✅ Equity prices updated — {len(price_rows)} symbols priced, {len(totals)} account snapshots refreshed")
