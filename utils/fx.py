import threading
import time

import requests

from utils.logger import get_logger

logger = get_logger(__name__)

FRANKFURTER_URL = "https://api.frankfurter.app/latest"
_CACHE_TTL_SECONDS = 24 * 60 * 60
_REQUEST_TIMEOUT_SECONDS = 5

_cache: dict[str, dict] = {}
# Guards both the cache read-check-fetch-write sequence below. A single lock (not
# per-base) is fine at this call volume, and is what actually fixes the bug: without
# it, N requests hitting a cold cache for the same base each fired their own
# Frankfurter call and blocked FastAPI's sync-route threadpool — see
# compute_holdings_summary's per-row convert() loop, the worst offender.
_lock = threading.Lock()


def get_rates(base: str) -> dict[str, float]:
    """Units of each other currency per 1 unit of `base`. Cached for 24h;
    falls back to the last cached value if Frankfurter is unreachable. Serialized
    so concurrent callers on a cold cache wait for one fetch instead of each firing
    their own blocking HTTP request."""
    with _lock:
        cached = _cache.get(base)
        if cached and time.time() - cached["fetched_at"] < _CACHE_TTL_SECONDS:
            return cached["rates"]

        try:
            resp = requests.get(FRANKFURTER_URL, params={"from": base}, timeout=_REQUEST_TIMEOUT_SECONDS)
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


def warm_cache(bases: list[str]) -> None:
    """Best-effort cache warm-up (e.g. on backend startup) so the first real request
    doesn't pay the cold-cache cost — see get_rates' docstring. Never raises: a
    failed warm-up just means the first real call falls through to get_rates'
    normal (locked, logged) fetch-or-fail path."""
    for base in bases:
        try:
            get_rates(base)
        except requests.RequestException:
            pass


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
