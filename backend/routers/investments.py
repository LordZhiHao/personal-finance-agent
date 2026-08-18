from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool

from backend.auth import get_current_user
from backend.schemas import PortfolioEventCreate, PortfolioEventUpdate
from db.supabase import (
    dashboard_insert_portfolio_event,
    delete_portfolio_events,
    get_held_positions,
    get_latest_snapshots,
    get_portfolio_events,
    get_snapshot_history,
    update_portfolio_event,
)
from scheduler.equity_price_updater import update_equity_prices
from utils.constants import TICKER_YFINANCE_MAP
from utils.dividends import compute_dividend_total
from utils.equity_pricing import fetch_dividend_forecast
from utils.fx import convert
from utils.portfolio import compute_holdings_summary

router = APIRouter(prefix="/api", tags=["investments"])


@router.get("/snapshots")
def snapshots(currency: str = "SGD", user_id: str = Depends(get_current_user)):
    """Latest asset_snapshots per account, each with converted_value added (converted
    to `currency` via utils/fx.py) so the frontend doesn't need its own FX calls."""
    rows = get_latest_snapshots(user_id=user_id)
    for r in rows:
        r["converted_value"] = convert(r["total_value"], r["currency"], currency)
    return rows


@router.get("/snapshots/history")
def snapshot_history(
    currency: str = "SGD",
    account_id: str | None = Query(None),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    user_id: str = Depends(get_current_user),
):
    """Full asset_snapshots history (not just the latest row per account), for the Net
    Worth Over Time chart. Same converted_value enrichment as GET /snapshots."""
    rows = get_snapshot_history(user_id, account_id=account_id, start_date=start_date, end_date=end_date)
    for r in rows:
        r["converted_value"] = convert(r["total_value"], r["currency"], currency)
    return rows


@router.get("/portfolio-events")
def portfolio_events(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    currency: str | None = Query(None),
    user_id: str = Depends(get_current_user),
):
    """Date bounds are optional, matching dashboard_insert_portfolio_event's default of
    full unfiltered trade history until the frontend's filter bar has been applied.
    `currency` is also optional — when passed, each row gets a converted_value field
    (quantity * price converted via utils/fx.py), same enrichment pattern as
    GET /snapshots, so charts comparing events across currencies (e.g. Dividends by
    Currency) don't need their own FX calls. Omitting it keeps every other caller
    (trade history table, edit dialogs, dividend calendar) unchanged."""
    rows = get_portfolio_events(start_date, end_date, user_id)
    if currency:
        for r in rows:
            r["converted_value"] = convert(r["quantity"] * r["price"], r["currency"], currency)
    return rows


@router.post("/portfolio-events", status_code=201)
def create_portfolio_event(payload: PortfolioEventCreate, user_id: str = Depends(get_current_user)):
    row = payload.model_dump(mode="json")
    if not row.get("fees"):
        row["fees"] = None
    if row.get("notes"):
        row["notes"] = row["notes"].strip() or None
    result = dashboard_insert_portfolio_event(row, user_id)
    return result.data[0] if result.data else row


@router.patch("/portfolio-events/{event_id}")
def patch_portfolio_event(
    event_id: str, fields: PortfolioEventUpdate, user_id: str = Depends(get_current_user)
):
    updates = fields.model_dump(exclude_unset=True, mode="json")
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    update_portfolio_event(event_id, updates, user_id)
    return {"ok": True}


@router.delete("/portfolio-events/{event_id}")
def delete_portfolio_event(event_id: str, user_id: str = Depends(get_current_user)):
    delete_portfolio_events([event_id], user_id)
    return {"ok": True}


@router.post("/refresh-prices")
async def refresh_prices(user_id: str = Depends(get_current_user)):
    """Manual on-demand equivalent of the hourly APScheduler job — scoped to only this
    user's held positions/accounts. Runs in a threadpool since yfinance calls are
    blocking network I/O and must not block the event loop."""
    return await run_in_threadpool(update_equity_prices, user_id)


@router.get("/holdings")
def holdings(currency: str = "SGD", user_id: str = Depends(get_current_user)):
    """Per-ticker avg-cost basis, market value, unrealized P&L — the /portfolio
    bot command's math, not currently surfaced in any dashboard."""
    return compute_holdings_summary(user_id, currency)


@router.get("/dividends/summary")
def dividends_summary(
    currency: str = "SGD",
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    user_id: str = Depends(get_current_user),
):
    """Total of DIVIDEND-action portfolio_events over the given date range, converted
    to `currency` — powers the Investments page's Year to Date Dividends KPI card."""
    return compute_dividend_total(user_id, currency, start_date, end_date)


@router.get("/dividend-forecast")
async def dividend_forecast(user_id: str = Depends(get_current_user)):
    """Next-known ex-dividend date/rate/yield per currently held ticker, where
    Yahoo Finance has that data. Runs in a threadpool since it's blocking yfinance
    I/O, same as /refresh-prices."""
    positions = get_held_positions(user_id)
    tickers = sorted({p["ticker"] for p in positions})
    symbols = {t: TICKER_YFINANCE_MAP.get(t, t) for t in tickers}
    forecast = await run_in_threadpool(fetch_dividend_forecast, sorted(set(symbols.values())))
    return [{"ticker": t, **forecast.get(symbols[t], {})} for t in tickers]
