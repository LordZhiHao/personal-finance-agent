import time

import requests

from utils.logger import get_logger

logger = get_logger(__name__)

FRANKFURTER_URL = "https://api.frankfurter.app/latest"
_CACHE_TTL_SECONDS = 24 * 60 * 60

_cache: dict[str, dict] = {}


def get_rates(base: str) -> dict[str, float]:
    """Units of each other currency per 1 unit of `base`. Cached for 24h;
    falls back to the last cached value if Frankfurter is unreachable."""
    cached = _cache.get(base)
    if cached and time.time() - cached["fetched_at"] < _CACHE_TTL_SECONDS:
        return cached["rates"]

    try:
        resp = requests.get(FRANKFURTER_URL, params={"from": base}, timeout=10)
        resp.raise_for_status()
        rates = resp.json()["rates"]
        rates[base] = 1.0
        _cache[base] = {"rates": rates, "fetched_at": time.time()}
        return rates
    except requests.RequestException:
        if cached:
            logger.warning("get_rates: Frankfurter unreachable for base=%s — using stale cached rates", base)
            return cached["rates"]
        logger.exception("get_rates: Frankfurter unreachable for base=%s and no cache available", base)
        raise


def convert(amount: float, from_currency: str, to_currency: str) -> float:
    """Converts `amount` from `from_currency` to `to_currency` using the latest
    available Frankfurter rate (not the historical rate on any past date)."""
    if from_currency == to_currency:
        return amount
    rates = get_rates(to_currency)
    rate = rates.get(from_currency)
    if rate is None:
        logger.warning("convert: no rate for %s -> %s, returning amount unconverted", from_currency, to_currency)
        return amount
    return amount / rate
