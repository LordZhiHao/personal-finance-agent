from datetime import datetime, timezone

import yfinance as yf

from utils.logger import get_logger

logger = get_logger(__name__)


def fetch_prices(symbols: list[str]) -> dict[str, dict]:
    """Fetches the latest price (and display name, where available) for each Yahoo
    Finance symbol.

    Returns {symbol: {"price": float, "currency": str, "name": str | None}}, skipping
    symbols that fail to resolve. LSE listings are quoted in GBX (pence) by Yahoo,
    not GBP, so those are converted to GBP here to avoid a 100x error downstream.
    """
    prices: dict[str, dict] = {}
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.fast_info
            price = info["lastPrice"]
            currency = info["currency"]
        except Exception:
            logger.warning("fetch_prices: could not fetch price for %s", symbol, exc_info=True)
            continue

        if currency == "GBp":
            price /= 100
            currency = "GBP"

        name = None
        try:
            full_info = ticker.get_info()
            name = full_info.get("shortName") or full_info.get("longName")
        except Exception:
            logger.warning("fetch_prices: could not fetch name for %s", symbol, exc_info=True)

        prices[symbol] = {"price": price, "currency": currency, "name": name}
    return prices


def fetch_dividends(symbols: list[str]) -> dict[str, list[dict]]:
    """Fetches each symbol's full available dividend-payment history from Yahoo
    Finance.

    Returns {symbol: [{"ex_date": "YYYY-MM-DD", "amount_per_share": float,
    "currency": str}, ...]}, skipping symbols that fail to resolve. Same GBX
    (pence) -> GBP correction as fetch_prices, since LSE dividend amounts are
    quoted in the same sub-unit as LSE prices.
    """
    dividends: dict[str, list[dict]] = {}
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            history = ticker.dividends
            currency = ticker.fast_info["currency"]
        except Exception:
            logger.warning("fetch_dividends: could not fetch dividends for %s", symbol, exc_info=True)
            continue

        entries = []
        for ex_date, amount in history.items():
            amount = float(amount)
            entry_currency = currency
            if entry_currency == "GBp":
                amount /= 100
                entry_currency = "GBP"
            entries.append({"ex_date": ex_date.strftime("%Y-%m-%d"), "amount_per_share": amount, "currency": entry_currency})
        dividends[symbol] = entries
    return dividends


def fetch_dividend_forecast(symbols: list[str]) -> dict[str, dict]:
    """Fetches each symbol's next-known ex-dividend date plus two distinct dividend
    figures, where Yahoo Finance has that data — many tickers (especially non-US
    listings) don't, so a missing key means "no forecast available", not an error.

    `dividend_rate` is Yahoo's "Forward Annual Dividend Rate" (`info["dividendRate"]`)
    — for many non-US-listed tickers (e.g. KLSE) this is a trailing-twelve-month/
    annualized total, NOT the amount of the next single payment, so it must never be
    labeled as a per-payment figure in the UI. `last_dividend_amount`/
    `last_dividend_date` come from the ticker's actual payment history
    (`ticker.dividends`) instead, and reflect the real amount/date of the most recent
    single distribution — use these when a "how much will I actually get" figure is
    needed.

    Returns {symbol: {"ex_dividend_date": "YYYY-MM-DD" | None, "dividend_rate":
    float | None, "dividend_yield": float | None, "last_dividend_amount": float | None,
    "last_dividend_date": "YYYY-MM-DD" | None, "currency": str}}.
    """
    forecast: dict[str, dict] = {}
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.get_info()
            currency = ticker.fast_info["currency"]
        except Exception:
            logger.warning("fetch_dividend_forecast: could not fetch info for %s", symbol, exc_info=True)
            continue

        ex_div_ts = info.get("exDividendDate")
        ex_div_date = datetime.fromtimestamp(ex_div_ts, tz=timezone.utc).strftime("%Y-%m-%d") if ex_div_ts else None
        rate = info.get("dividendRate")
        if rate is not None and currency == "GBp":
            rate /= 100

        last_amount, last_date = None, None
        try:
            history = ticker.dividends
            if not history.empty:
                last_amount = float(history.iloc[-1])
                last_date = history.index[-1].strftime("%Y-%m-%d")
                if currency == "GBp":
                    last_amount /= 100
        except Exception:
            logger.warning("fetch_dividend_forecast: could not fetch dividend history for %s", symbol, exc_info=True)

        forecast[symbol] = {
            "ex_dividend_date": ex_div_date,
            "dividend_rate": rate,
            "dividend_yield": info.get("dividendYield"),
            "last_dividend_amount": last_amount,
            "last_dividend_date": last_date,
            "currency": "GBP" if currency == "GBp" else currency,
        }
    return forecast
