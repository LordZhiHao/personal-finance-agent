from datetime import datetime

import pytz

from db.supabase import (
    get_all_active_alerts,
    get_category_classifications_for_user,
    get_latest_equity_prices,
    get_transactions,
    mark_alert_triggered,
)
from scheduler.emailer import send_reminder_email
from scheduler.report_builder import summarize_transactions
from utils.balances import compute_account_balances
from utils.constants import DEFAULT_CURRENCY, TICKER_YFINANCE_MAP
from utils.logger import get_logger
from utils.portfolio import compute_holdings_summary

logger = get_logger(__name__)

SGT = pytz.timezone("Asia/Singapore")

_OPERATORS = {
    "above": lambda value, threshold: value > threshold,
    "below": lambda value, threshold: value < threshold,
}


def _already_fired_today(alert: dict, now: datetime) -> bool:
    last_triggered_at = alert.get("last_triggered_at")
    if not last_triggered_at:
        return False
    return datetime.fromisoformat(last_triggered_at).astimezone(SGT).date() == now.date()


def _daily_spend_totals(user_ids: set[str], now: datetime) -> dict[str, float]:
    today = now.date().isoformat()
    return {
        user_id: summarize_transactions(
            get_transactions(today, today, user_id), get_category_classifications_for_user(user_id)
        )["expenses"]
        for user_id in user_ids
    }


def _stock_prices(tickers: set[str]) -> dict[str, dict | None]:
    """Keyed by the raw ticker (e.g. 'CSPX'), mapped through TICKER_YFINANCE_MAP before
    the lookup — same pattern bot/finance_agent.py's get_dividend_forecast tool uses,
    since equity_prices stores the Yahoo Finance symbol, not the raw broker ticker."""
    symbol_map = {t: TICKER_YFINANCE_MAP.get(t, t) for t in tickers}
    prices = get_latest_equity_prices(sorted(set(symbol_map.values())))
    return {t: prices.get(symbol_map[t]) for t in tickers}


def _net_worths(user_ids: set[str], currencies: dict[str, str]) -> dict[str, float]:
    return {
        user_id: compute_account_balances(user_id, currencies.get(user_id, DEFAULT_CURRENCY))["total"]
        for user_id in user_ids
    }


def _holdings_summaries(user_ids: set[str], currencies: dict[str, str]) -> dict[str, dict]:
    return {
        user_id: compute_holdings_summary(user_id, currencies.get(user_id, DEFAULT_CURRENCY))
        for user_id in user_ids
    }


def _current_value(alert: dict, daily_spend: dict, stock_prices: dict, net_worths: dict, holdings: dict) -> float | None:
    metric = alert["metric"]
    if metric == "daily_spend":
        return daily_spend.get(alert["user_id"])
    if metric == "stock_price":
        price_info = stock_prices.get(alert["ticker"])
        return price_info["price"] if price_info else None
    if metric == "net_worth":
        return net_worths.get(alert["user_id"])
    if metric == "position_pnl":
        summary = holdings.get(alert["user_id"]) or {}
        for h in summary.get("holdings", []):
            if h["ticker"] == alert["ticker"]:
                return h["unrealized_gain"]
        return None
    return None


def _format_message(alert: dict, value: float) -> str:
    if alert.get("message"):
        return alert["message"]
    direction = "above" if alert["operator"] == "above" else "below"
    subject = {
        "daily_spend": "Today's spending",
        "stock_price": f"{alert.get('ticker')}'s price",
        "net_worth": "Your net worth",
        "position_pnl": f"Your {alert.get('ticker')} position's unrealized P&L",
    }[alert["metric"]]
    return f"{subject} is now {direction} your threshold of {alert['threshold']:,.2f} (currently {value:,.2f})."


async def check_alerts(bot):
    """Polled every 15 minutes (see bot/main.py) — evaluates a live condition per
    alert rather than matching a clock, unlike scheduler/user_reminders.py. One bad
    alert row, Telegram failure, or email failure never blocks the rest — same
    per-item try/except isolation as the rest of this package."""
    now = datetime.now(SGT)
    alerts = get_all_active_alerts()
    logger.info("check_alerts: evaluating %d active alert(s) at %s", len(alerts), now.isoformat())
    if not alerts:
        return

    currencies = {
        a["user_id"]: (a.get("users") or {}).get("main_currency") or DEFAULT_CURRENCY for a in alerts
    }
    daily_spend = _daily_spend_totals({a["user_id"] for a in alerts if a["metric"] == "daily_spend"}, now)
    stock_prices = _stock_prices({a["ticker"] for a in alerts if a["metric"] == "stock_price"})
    net_worths = _net_worths({a["user_id"] for a in alerts if a["metric"] == "net_worth"}, currencies)
    holdings = _holdings_summaries({a["user_id"] for a in alerts if a["metric"] == "position_pnl"}, currencies)

    for alert in alerts:
        try:
            if alert["metric"] == "daily_spend" and _already_fired_today(alert, now):
                continue
            value = _current_value(alert, daily_spend, stock_prices, net_worths, holdings)
            if value is None:
                continue
            if not _OPERATORS[alert["operator"]](value, alert["threshold"]):
                continue

            user = alert.get("users") or {}
            text = f"🚨 {_format_message(alert, value)}"
            if alert["channel"] in ("telegram", "both") and user.get("telegram_chat_id"):
                try:
                    await bot.send_message(chat_id=user["telegram_chat_id"], text=text)
                except Exception:
                    logger.exception("check_alerts: telegram send failed for alert_id=%s", alert["id"])
            if alert["channel"] in ("email", "both") and user.get("notify_email"):
                try:
                    send_reminder_email(
                        text, to_email=user["notify_email"], theme=user.get("theme", "green"),
                        subject="🚨 Alert triggered",
                    )
                except Exception:
                    logger.exception("check_alerts: email send failed for alert_id=%s", alert["id"])
            mark_alert_triggered(alert["id"], now, deactivate=(alert["metric"] != "daily_spend"))
        except Exception:
            logger.exception("check_alerts: failed processing alert_id=%s", alert.get("id"))
