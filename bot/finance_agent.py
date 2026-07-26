import json
import os
from datetime import date

from dateutil.relativedelta import relativedelta

from bot.deepseek_client import client
from db.supabase import get_held_positions, get_portfolio_events, get_recent_transactions, get_transactions
from scheduler.report_builder import month_comparison, summarize_transactions
from utils.balances import compute_account_balances, compute_net_worth_trend
from utils.constants import DASHBOARD_URL, DEFAULT_CURRENCY, TICKER_YFINANCE_MAP
from utils.equity_pricing import fetch_dividend_forecast
from utils.logger import get_logger
from utils.period import parse_period
from utils.portfolio import compute_holdings_summary

logger = get_logger(__name__)

AGENT_MODEL = os.getenv("DEEPSEEK_AGENT_MODEL", "deepseek-v4-pro")

MAX_TOOL_ROUNDS = 4
MAX_HISTORY_TURNS = 6  # rolling window: 6 user+assistant pairs = 12 messages kept

# Per-user rolling chat history for multi-turn Q&A context — same dict-keyed-by-user_id
# pattern as `pending`/`last_saved` in bot/handlers.py.
chat_history: dict[int, list[dict]] = {}

AGENT_SYSTEM_PROMPT = f"""You are a personal finance assistant for a user based in Singapore, built into
their Telegram bot. Answer questions about their spending, holdings, balances, and recent transactions by
calling the provided tools — never guess figures from memory. All monetary values from tools are already
in {DEFAULT_CURRENCY} unless a tool result states otherwise. Keep replies concise and use plain text
(no Markdown formatting — the message is sent unformatted). Default to the "week" period when a question
doesn't specify a timeframe. When a question refers to "this month" or "the current month," use the
"month_to_date" period, not "month" — "month" is a trailing ~30-day window, while "month_to_date" is the
current calendar month from the 1st.

If asked for the web dashboard link or how to get to the dashboard, answer directly with this URL —
no tool call needed: {DASHBOARD_URL}

When asked about a specific ticker's performance (e.g. "how's CSPX doing"), call get_holdings and find
that ticker in the results, then explicitly state its average buy price vs. current price and say
whether the position is in the green (unrealized_gain > 0) or red (unrealized_gain < 0)."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_spending_summary",
            "description": "Income, expenses, net, savings rate, and spend-by-category for a period.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {
                        "type": "string",
                        "enum": ["day", "week", "month", "year", "month_to_date"],
                        "description": (
                            "'day'/'week'/'month'/'year' are trailing windows ending today; "
                            "'month_to_date' is the current calendar month from the 1st. "
                            "Defaults to 'week' if omitted."
                        ),
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_transactions_list",
            "description": "The actual itemized transactions (date, description, amount, category) for a period — use this when the user wants to see/list transactions, not just a summary.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {
                        "type": "string",
                        "enum": ["day", "week", "month", "year", "month_to_date"],
                        "description": (
                            "'day'/'week'/'month'/'year' are trailing windows ending today; "
                            "'month_to_date' is the current calendar month from the 1st. "
                            "Defaults to 'week' if omitted."
                        ),
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_holdings",
            "description": "Current investment holdings: quantity, average cost, market value, and unrealized gain/loss per ticker.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_balances",
            "description": "Unified cash + brokerage balance per account, plus total across all accounts.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_recent_transactions_tool",
            "description": "The most recently logged transactions (by creation time, not transaction date).",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Number of transactions to return (1-30). Defaults to 10.",
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_portfolio_trades",
            "description": "Trade history (BUY/SELL/DIVIDEND events), optionally bounded to a trailing period. Omit period for full history.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {
                        "type": "string",
                        "enum": ["day", "week", "month", "year"],
                        "description": "Trailing window ending today. Omit for full trade history.",
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_month_comparison",
            "description": "Expense-by-category totals across this calendar month, last calendar month, and the same calendar month one year ago — use this for 'how does this month compare' style questions.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_dividend_forecast",
            "description": "Next-known ex-dividend date, rate per share, and yield for each currently held ticker, where Yahoo Finance has that data. Distinct from get_portfolio_trades' DIVIDEND events, which are dividends already paid/logged — this is a forward-looking forecast.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_allocation",
            "description": "Portfolio allocation percentages, grouped by ticker, account, or original quote currency.",
            "parameters": {
                "type": "object",
                "properties": {
                    "group_by": {
                        "type": "string",
                        "enum": ["ticker", "account", "currency"],
                        "description": "How to group the allocation. Defaults to 'ticker' if omitted.",
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_net_worth_trend",
            "description": "Net worth now vs. N days ago, with the dollar and percentage delta. Returns null comparison fields if there isn't enough asset-snapshot history yet across all accounts for a fair comparison.",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {
                        "type": "integer",
                        "description": "How many days back to compare against. Defaults to 7 if omitted.",
                    }
                },
            },
        },
    },
]


def _run_tool(name: str, args: dict, user_id: str) -> dict:
    if name == "get_spending_summary":
        start, end, label = parse_period(args.get("period"))
        txns = get_transactions(start.isoformat(), end.isoformat(), user_id)
        return {"period": label, **summarize_transactions(txns)}
    if name == "get_transactions_list":
        start, end, label = parse_period(args.get("period"))
        txns = get_transactions(start.isoformat(), end.isoformat(), user_id)
        return {"period": label, "transactions": txns}
    if name == "get_holdings":
        return compute_holdings_summary(user_id, DEFAULT_CURRENCY)
    if name == "get_balances":
        return compute_account_balances(user_id, DEFAULT_CURRENCY)
    if name == "get_recent_transactions_tool":
        n = max(1, min(int(args.get("limit", 10)), 30))
        return {"transactions": get_recent_transactions(n, user_id)}
    if name == "get_portfolio_trades":
        period = args.get("period")
        if period:
            start, end, label = parse_period(period)
            events = get_portfolio_events(start.isoformat(), end.isoformat(), user_id)
        else:
            label, events = "all time", get_portfolio_events(user_id=user_id)
        return {"period": label, "events": events}
    if name == "get_month_comparison":
        start = date.today() - relativedelta(months=13)
        txns = get_transactions(start.isoformat(), date.today().isoformat(), user_id)
        return {"categories": month_comparison(txns)[:8]}
    if name == "get_dividend_forecast":
        positions = get_held_positions(user_id)
        tickers = sorted({p["ticker"] for p in positions})
        symbols = {t: TICKER_YFINANCE_MAP.get(t, t) for t in tickers}
        forecast = fetch_dividend_forecast(sorted(set(symbols.values())))
        return {"forecast": [{"ticker": t, **forecast.get(symbols[t], {})} for t in tickers]}
    if name == "get_allocation":
        group_field = {"ticker": "ticker", "account": "account_name", "currency": "price_currency"}[
            args.get("group_by", "ticker")
        ]
        summary = compute_holdings_summary(user_id, DEFAULT_CURRENCY)
        totals: dict[str, float] = {}
        for h in summary["holdings"]:
            if h["market_value"] is None:
                continue
            key = h[group_field] or "Unknown"
            totals[key] = totals.get(key, 0.0) + h["market_value"]
        total = summary["total_market_value"] or 1
        allocation = sorted(
            ({"name": k, "value": v, "pct": v / total * 100} for k, v in totals.items()),
            key=lambda r: r["value"],
            reverse=True,
        )
        return {"currency": DEFAULT_CURRENCY, "allocation": allocation}
    if name == "get_net_worth_trend":
        days = max(1, int(args.get("days", 7)))
        return compute_net_worth_trend(user_id, DEFAULT_CURRENCY, lookback_days=days)
    return {"error": f"unknown tool {name!r}"}


def answer_question(uid: int, raw_text: str, user_id: str) -> str:
    """Runs a bounded tool-calling loop against DeepSeek. Never raises — any failure
    (network, malformed tool call, etc.) is caught and turned into an apology string,
    the same graceful-degradation convention used elsewhere in this bot (e.g. weekly
    report email failures don't crash the job)."""
    history = chat_history.get(uid, [])
    messages = [{"role": "system", "content": AGENT_SYSTEM_PROMPT}] + history + [{"role": "user", "content": raw_text}]

    try:
        final_text = None
        for _ in range(MAX_TOOL_ROUNDS):
            response = client.chat.completions.create(
                model=AGENT_MODEL,
                messages=messages,
                tools=TOOLS,
                tool_choice="auto",
            )
            msg = response.choices[0].message
            if not msg.tool_calls:
                final_text = msg.content
                break
            messages.append(msg.model_dump(exclude_unset=True))
            for tc in msg.tool_calls:
                args = json.loads(tc.function.arguments or "{}")
                logger.info("answer_question: tool=%s args=%s user_id=%s", tc.function.name, args, uid)
                result = _run_tool(tc.function.name, args, user_id)
                messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result, default=str)})
        if final_text is None:
            final_text = "Sorry, I couldn't finish answering that — try a more specific question."
    except Exception:
        logger.exception("answer_question: DeepSeek call failed for user_id=%s", uid)
        return "⚠️ Something went wrong answering that — please try again."

    history = history + [{"role": "user", "content": raw_text}, {"role": "assistant", "content": final_text}]
    chat_history[uid] = history[-(MAX_HISTORY_TURNS * 2):]
    return final_text
