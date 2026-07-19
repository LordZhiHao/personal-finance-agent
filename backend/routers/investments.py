from fastapi import APIRouter, Depends, Query

from backend.auth import get_current_user
from backend.schemas import PortfolioEventCreate
from db.supabase import dashboard_insert_portfolio_event, get_latest_snapshots, get_portfolio_events
from utils.fx import convert
from utils.portfolio import compute_holdings_summary

router = APIRouter(prefix="/api", tags=["investments"])


@router.get("/snapshots")
def snapshots(currency: str = "SGD", user: str = Depends(get_current_user)):
    """Latest asset_snapshots per account, each with converted_value added (converted
    to `currency` via utils/fx.py) so the frontend doesn't need its own FX calls."""
    rows = get_latest_snapshots()
    for r in rows:
        r["converted_value"] = convert(r["total_value"], r["currency"], currency)
    return rows


@router.get("/portfolio-events")
def portfolio_events(
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    user: str = Depends(get_current_user),
):
    """Date bounds are optional, matching dashboard_insert_portfolio_event's default of
    full unfiltered trade history until the frontend's filter bar has been applied."""
    return get_portfolio_events(start_date, end_date)


@router.post("/portfolio-events", status_code=201)
def create_portfolio_event(payload: PortfolioEventCreate, user: str = Depends(get_current_user)):
    row = payload.model_dump(mode="json")
    if not row.get("fees"):
        row["fees"] = None
    if row.get("notes"):
        row["notes"] = row["notes"].strip() or None
    result = dashboard_insert_portfolio_event(row)
    return result.data[0] if result.data else row


@router.get("/holdings")
def holdings(currency: str = "SGD", user: str = Depends(get_current_user)):
    """Per-ticker avg-cost basis, market value, unrealized P&L — the /portfolio
    bot command's math, not currently surfaced in any dashboard."""
    return compute_holdings_summary(currency)
