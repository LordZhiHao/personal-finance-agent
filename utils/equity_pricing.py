import yfinance as yf

from utils.logger import get_logger

logger = get_logger(__name__)


def fetch_prices(symbols: list[str]) -> dict[str, dict]:
    """Fetches the latest price for each Yahoo Finance symbol.

    Returns {symbol: {"price": float, "currency": str}}, skipping symbols
    that fail to resolve. LSE listings are quoted in GBX (pence) by Yahoo,
    not GBP, so those are converted to GBP here to avoid a 100x error
    downstream.
    """
    prices: dict[str, dict] = {}
    for symbol in symbols:
        try:
            info = yf.Ticker(symbol).fast_info
            price = info["lastPrice"]
            currency = info["currency"]
        except Exception:
            logger.warning("fetch_prices: could not fetch price for %s", symbol, exc_info=True)
            continue

        if currency == "GBp":
            price /= 100
            currency = "GBP"

        prices[symbol] = {"price": price, "currency": currency}
    return prices
