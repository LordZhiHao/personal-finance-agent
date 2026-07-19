from db.supabase import get_accounts, get_all_portfolio_events, get_held_positions, get_latest_equity_prices
from utils.fx import convert
from utils.logger import get_logger

logger = get_logger(__name__)


def _build_cost_basis_state(events: list[dict]) -> dict[tuple, dict]:
    """Average-cost basis per (account_id, ticker): BUYs roll a running weighted
    average cost; SELLs reduce quantity without changing the average (standard
    average-cost method, not FIFO). DIVIDEND events don't affect cost basis."""
    state: dict[tuple, dict] = {}
    for e in events:
        if e["action"] not in ("BUY", "SELL"):
            continue
        key = (e["account_id"], e["ticker"])
        s = state.setdefault(key, {"qty": 0.0, "avg_cost": 0.0, "currency": e["currency"]})
        s["currency"] = e["currency"]
        if e["action"] == "BUY":
            cost_before = s["qty"] * s["avg_cost"]
            new_qty = s["qty"] + e["quantity"]
            cost_after = cost_before + e["quantity"] * e["price"] + (e.get("fees") or 0)
            s["qty"] = new_qty
            s["avg_cost"] = cost_after / new_qty if new_qty > 0 else 0.0
        else:
            s["qty"] -= e["quantity"]
    return state


def compute_holdings_summary(display_currency: str = "SGD") -> dict:
    """Current brokerage holdings with market value (from the latest equity_prices
    row per ticker) and unrealized gain/loss vs average-cost basis, all converted
    to display_currency. Holdings with no price available report market_value=None
    rather than being dropped, so a stale/unmapped ticker is still visible."""
    positions = get_held_positions()
    if not positions:
        return {"holdings": [], "total_market_value": 0.0, "total_cost_basis": 0.0,
                 "total_unrealized_gain": 0.0, "currency": display_currency}

    accounts = {a["id"]: a for a in get_accounts(account_type="brokerage")}
    tickers = sorted({p["ticker"] for p in positions})
    prices = get_latest_equity_prices(tickers)
    cost_state = _build_cost_basis_state(get_all_portfolio_events())

    holdings = []
    total_market_value = 0.0
    total_cost_basis = 0.0
    for p in positions:
        account = accounts.get(p["account_id"])
        if not account:
            continue  # not an active brokerage account

        ticker = p["ticker"]
        qty = p["quantity"]
        state = cost_state.get((p["account_id"], ticker), {"avg_cost": 0.0, "currency": display_currency})
        cost_basis = convert(qty * state["avg_cost"], state["currency"], display_currency)

        price_info = prices.get(ticker)
        market_value = None
        unrealized_gain = None
        unrealized_gain_pct = None
        if price_info:
            market_value = convert(qty * price_info["price"], price_info["currency"], display_currency)
            unrealized_gain = market_value - cost_basis
            unrealized_gain_pct = (unrealized_gain / cost_basis * 100) if cost_basis else None
        else:
            logger.warning("compute_holdings_summary: no price available for ticker=%s", ticker)

        holdings.append({
            "account_name": account["name"],
            "ticker": ticker,
            "quantity": qty,
            "avg_cost": state["avg_cost"],
            "cost_currency": state["currency"],
            "market_value": market_value,
            "cost_basis": cost_basis,
            "unrealized_gain": unrealized_gain,
            "unrealized_gain_pct": unrealized_gain_pct,
        })

        if market_value is not None:
            total_market_value += market_value
        total_cost_basis += cost_basis

    return {
        "holdings": holdings,
        "total_market_value": total_market_value,
        "total_cost_basis": total_cost_basis,
        "total_unrealized_gain": total_market_value - total_cost_basis,
        "currency": display_currency,
    }
