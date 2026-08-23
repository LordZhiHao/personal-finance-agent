import json
import os

from bot.deepseek_client import client
from db.supabase import get_ticker_metadata, upsert_ticker_metadata
from utils.constants import EXCHANGE_YFINANCE_SUFFIX
from utils.equity_pricing import fetch_prices
from utils.fx import convert
from utils.logger import get_logger

logger = get_logger(__name__)

RESOLVER_MODEL = os.getenv("DEEPSEEK_TICKER_RESOLVER_MODEL", "deepseek-v4-pro")

RESOLVER_PROMPT = f"""You are resolving a user-provided stock/ETF reference (a company
name, nickname, or partial/informal ticker) to its canonical exchange ticker for a
personal finance tracker.

Given a single free-text query (e.g. "maybank", "cspx", "1155.KL", "apple"), identify
the company/fund's primary listing.

Return ONLY a JSON object:
{{"ticker": "<short ticker as normally quoted, e.g. '1155', 'CSPX', 'AAPL'>",
 "company": "<full company/fund name>",
 "symbol": "<exact exchange trading symbol/code, often the same as ticker>",
 "exchange": "<one of: {', '.join(EXCHANGE_YFINANCE_SUFFIX)}>"}}

Rules:
- exchange MUST be exactly one of: {', '.join(EXCHANGE_YFINANCE_SUFFIX)}. Pick the
  company's primary/most-liquid listing if it's dual-listed or ambiguous.
- ticker/symbol must NOT include any exchange suffix (no ".KL", ".SI", ".L", etc.) —
  that is derived separately from the exchange code.
- If you cannot confidently identify a real, currently-tradable security, return
  {{"ticker": null, "company": null, "symbol": null, "exchange": null}}."""


def resolve_ticker(query: str) -> dict | None:
    """Resolves a free-text company name/nickname/ticker to canonical ticker metadata.

    Returns {"ticker", "company", "symbol", "exchange", "yfinance_symbol"} or None if
    resolution failed/was unconfident — callers must treat None as "leave the input
    unchanged," never block a save on this. A single DeepSeek call, same safe-fallback
    pattern as bot/account_matcher.py::match_account.

    An exact (case-insensitive) match of `query` against an already-resolved ticker or
    symbol short-circuits before the LLM call; free-text variants of the same company
    ("maybank" vs "Malayan Banking") always still hit the LLM, but the result is cached
    for next time under its own canonical ticker.
    """
    query = query.strip()
    if not query:
        return None

    cached = get_ticker_metadata(query)
    if cached:
        return cached

    try:
        response = client.chat.completions.create(
            model=RESOLVER_MODEL,
            messages=[
                {"role": "system", "content": RESOLVER_PROMPT},
                {"role": "user", "content": query},
            ],
            response_format={"type": "json_object"},
            temperature=0,
        )
        obj = json.loads(response.choices[0].message.content)
        ticker = obj.get("ticker")
        exchange = obj.get("exchange")
        if not ticker or exchange not in EXCHANGE_YFINANCE_SUFFIX:
            logger.info("resolve_ticker: no confident match for query=%r", query)
            return None

        yfinance_symbol = f"{ticker}{EXCHANGE_YFINANCE_SUFFIX[exchange]}"
        result = {
            "ticker": ticker,
            "company": obj.get("company"),
            "symbol": obj.get("symbol") or ticker,
            "exchange": exchange,
            "yfinance_symbol": yfinance_symbol,
        }
        upsert_ticker_metadata(ticker, result["company"], exchange, result["symbol"], yfinance_symbol)
        return result
    except Exception:
        logger.exception("resolve_ticker: DeepSeek call failed for query=%r", query)
        return None


def enrich_portfolio_event(event: dict, default_currency: str = "SGD") -> dict:
    """Resolves event['ticker'] to its canonical form and, if the extraction gave a
    total_amount instead of a share quantity (e.g. "bought $300 worth of CSPX"),
    reverse-calculates quantity/price/currency from a live quote. Never raises — any
    failure leaves the event as close to its original shape as possible rather than
    dropping it; downstream schema validation (bot/extractor.py) is what ultimately
    rejects an event that still has no quantity."""
    resolved = resolve_ticker(event.get("ticker", ""))
    yfinance_symbol = event.get("ticker")
    if resolved:
        event = {**event, "ticker": resolved["ticker"]}
        yfinance_symbol = resolved["yfinance_symbol"]

    total_amount = event.pop("total_amount", None)
    if not event.get("quantity") and total_amount:
        quotes = fetch_prices([yfinance_symbol]) if yfinance_symbol else {}
        quote = quotes.get(yfinance_symbol)
        if quote:
            event_currency = event.get("currency", default_currency)
            converted_amount = convert(total_amount, event_currency, quote["currency"])
            event["quantity"] = converted_amount / quote["price"]
            event["price"] = quote["price"]
            event["currency"] = quote["currency"]
        else:
            logger.warning(
                "enrich_portfolio_event: no live quote for ticker=%s, cannot infer quantity from total_amount",
                event.get("ticker"),
            )

    return event
