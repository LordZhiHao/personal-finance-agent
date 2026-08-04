import json
import os
import re
from datetime import date

from dateutil.relativedelta import relativedelta

from bot.deepseek_client import client
from db.supabase import (
    create_account,
    create_custom_category,
    create_user_alert,
    create_user_memory,
    create_user_reminder,
    deactivate_account,
    delete_custom_category,
    delete_user_alert,
    delete_user_memory,
    delete_user_reminder,
    get_accounts,
    get_custom_categories_full,
    get_held_positions,
    get_portfolio_events,
    get_recent_transactions,
    get_transactions,
    get_user_alerts,
    get_user_by_id,
    get_user_memories,
    get_user_reminders,
    update_account,
    update_custom_category,
    update_user,
)
from scheduler.report_builder import month_comparison, summarize_transactions
from utils.balances import compute_account_balances, compute_net_worth_trend
from utils.constants import ACCOUNT_TYPES, CURRENCIES, DASHBOARD_URL, DEFAULT_CURRENCY, THEME_COLORS, TICKER_YFINANCE_MAP
from utils.equity_pricing import fetch_dividend_forecast
from utils.logger import get_logger
from utils.period import parse_period
from utils.portfolio import compute_holdings_summary

logger = get_logger(__name__)

AGENT_MODEL = os.getenv("DEEPSEEK_AGENT_MODEL", "deepseek-v4-pro")

MAX_TOOL_ROUNDS = 4
MAX_HISTORY_TURNS = 6  # rolling window: 6 user+assistant pairs = 12 messages kept

# Per-user rolling chat history for multi-turn Q&A context — same dict-keyed-by-user_id
# pattern as `pending`/`last_saved` in bot/handlers.py. Keyed by the Telegram int chat id
# for bot conversations, or the Supabase user_id string for web dashboard conversations —
# the two key types never collide, so the channels naturally stay in separate threads.
chat_history: dict[int | str, list[dict]] = {}

def _shared_prompt_body() -> str:
    # Computed per call, not baked in at import time — the bot/backend process runs
    # continuously across days, so "today" must be re-read on every request.
    today = date.today().isoformat()
    return f"""Today's date is {today}. Use this as the anchor for any date-relative reasoning
(e.g. judging whether a dividend's ex-date or a due date is upcoming or already past).

Answer questions about their spending, holdings, balances, and recent transactions by
calling the provided tools — never guess figures from memory. All monetary values from tools are already
in {DEFAULT_CURRENCY} unless a tool result states otherwise. Default to the "week" period when a question
doesn't specify a timeframe. When a question refers to "this month" or "the current month," use the
"month_to_date" period, not "month" — "month" is a trailing ~30-day window, while "month_to_date" is the
current calendar month from the 1st.

When asked about a specific ticker's performance (e.g. "how's CSPX doing"), call get_holdings and find
that ticker in the results, then explicitly state its average buy price vs. current price and say
whether the position is in the green (unrealized_gain > 0) or red (unrealized_gain < 0).

You can also edit the user's own settings directly instead of telling them to go to the Settings page:
profile (main_currency, theme), accounts (create/edit/delete), custom categories (create/rename/delete),
and saved memories (forget one). Destructive actions (delete_account, delete_category, forget_memory,
delete_reminder) execute immediately with no confirmation step — do not ask the user to confirm first,
just do it, same as remember_preference. Never guess an account_id/category_id/memory_id/reminder_id —
call the matching list_* tool first if it isn't already visible in this conversation.

You can also schedule recurring personal reminders for the user (create_reminder/list_reminders/
delete_reminder), delivered via Telegram and/or email. Recurrence is one of: daily; weekly on a given
weekday (day_of_week, 0=Monday..6=Sunday); or monthly on a given day-of-month (day_of_month, 1-31).
All times are Singapore local time, given as 24-hour "HH:MM". Examples: "remind me every Friday at 6pm
to review my portfolio" -> frequency="weekly", day_of_week=4, time_of_day="18:00"; "remind me on the 5th
of every month to pay rent" -> frequency="monthly", day_of_month=5, time_of_day defaults to a reasonable
time like "09:00" if the user doesn't give one; "remind me every day at 9am to log my spending" ->
frequency="daily", time_of_day="09:00".

You can also set condition-based alerts (create_alert/list_alerts/delete_alert) that watch a live value
and notify the user once it crosses a threshold — distinct from reminders above, which fire on a clock,
not a condition. metric is one of: "daily_spend" (today's total spending so far), "stock_price" (a held
ticker's latest price, requires ticker), "net_worth" (total across all accounts), "position_pnl" (a held
ticker's unrealized gain/loss in dollars, requires ticker, can be negative for a loss). operator is
"above" or "below". Examples: "alert me if I spend more than $100 today" -> metric="daily_spend",
operator="above", threshold=100; "alert me if CSPX drops below $500" -> metric="stock_price",
operator="below", threshold=500, ticker="CSPX"; "alert me if my net worth drops below $50000" ->
metric="net_worth", operator="below", threshold=50000; "alert me if my CSPX position is down more than
$200" -> metric="position_pnl", operator="below", threshold=-200, ticker="CSPX". daily_spend alerts
re-arm automatically every day; the other three metrics fire once and then stop — tell the user they'd
need to ask again to keep watching after a stock_price/net_worth/position_pnl alert fires."""


def _memories_block(memories: list[dict]) -> str:
    if not memories:
        return ""
    notes = "\n".join(f"- (id: {m['id']}) {m['content']}" for m in memories)
    return f"""

What you know about this user from past conversations — each tagged with its id; use
forget_memory(memory_id) with that id if the user asks you to forget/remove one:
{notes}"""


def _build_system_prompt(channel: str, memories: list[dict]) -> str:
    shared = _shared_prompt_body() + _memories_block(memories)
    if channel == "web":
        return f"""You are a personal finance assistant for a user based in Singapore, integrated into
their web dashboard. Keep replies concise and use plain text with line breaks where helpful.

{shared}"""
    return f"""You are a personal finance assistant for a user based in Singapore, built into
their Telegram bot. Keep replies concise and use plain text
(no Markdown formatting — the message is sent unformatted).

If asked for the web dashboard link or how to get to the dashboard, answer directly with this URL —
no tool call needed: {DASHBOARD_URL}

{shared}"""

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
    {
        "type": "function",
        "function": {
            "name": "remember_preference",
            "description": (
                "Save a durable fact, preference, or goal about the user for future "
                "conversations (e.g. 'prefers seeing amounts in USD', 'saving for a house "
                "downpayment', 'dislikes budgeting tips'). Only call this for information "
                "that should persist across sessions — not one-off transaction details "
                "already captured elsewhere. Save silently; do not ask the user for "
                "permission first."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": "A concise (<200 char) statement of the fact/preference to remember.",
                    }
                },
                "required": ["content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "forget_memory",
            "description": (
                "Delete a previously saved memory about the user. Deletes immediately, "
                "no confirmation needed — matches this app's auto-commit convention. "
                "The memory's id is shown alongside it in 'what you know about this user' above."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "memory_id": {"type": "string", "description": "id of the memory to delete."}
                },
                "required": ["memory_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_profile_settings",
            "description": "Change the user's own profile settings. Only pass the field(s) you want to change.",
            "parameters": {
                "type": "object",
                "properties": {
                    "main_currency": {"type": "string", "enum": CURRENCIES},
                    "theme": {"type": "string", "enum": list(THEME_COLORS.keys())},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_accounts",
            "description": "The user's accounts with their id, name, type, currency, and comments — call this before update_account/delete_account if you don't already know the account_id.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_account",
            "description": "Create a new account for the user. Executes immediately, no confirmation needed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "type": {"type": "string", "enum": ACCOUNT_TYPES},
                    "currency": {"type": "string", "enum": CURRENCIES},
                    "comments": {
                        "type": "string",
                        "description": "Optional freeform usage note (e.g. 'for US stock trades') — used to auto-match future receipt uploads to this account.",
                    },
                },
                "required": ["name", "type", "currency"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_account",
            "description": (
                "Edit an existing account's name, type, currency, or usage note. Only pass "
                "the fields you want to change — omit the rest. Call list_accounts first if "
                "you don't already know the account_id from this conversation; never guess it."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "account_id": {"type": "string", "description": "The account's id, from list_accounts."},
                    "name": {"type": "string"},
                    "type": {"type": "string", "enum": ACCOUNT_TYPES},
                    "currency": {"type": "string", "enum": CURRENCIES},
                    "comments": {"type": "string"},
                },
                "required": ["account_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_account",
            "description": (
                "Deactivate (soft-delete) an account — hides it from lists/dropdowns but "
                "keeps its transaction history intact. Deletes immediately, no confirmation "
                "needed. Call list_accounts first if you don't already know the account_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {"account_id": {"type": "string"}},
                "required": ["account_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_categories",
            "description": "The user's own custom transaction categories with their id and name (built-in categories aren't included here and can't be renamed/deleted) — call this before rename_category/delete_category if you don't already know the category_id.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_category",
            "description": "Add a new custom transaction category for the user. Executes immediately, no confirmation needed.",
            "parameters": {
                "type": "object",
                "properties": {"name": {"type": "string"}},
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "rename_category",
            "description": "Rename one of the user's own custom categories. Call list_categories first if you don't already know the category_id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category_id": {"type": "string"},
                    "name": {"type": "string", "description": "The new name."},
                },
                "required": ["category_id", "name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_category",
            "description": (
                "Delete one of the user's own custom categories. Deletes immediately, no "
                "confirmation needed. Past transactions keep their old category value "
                "unchanged. Call list_categories first if you don't already know the category_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {"category_id": {"type": "string"}},
                "required": ["category_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_reminder",
            "description": (
                "Schedule a recurring personal reminder for the user, delivered via Telegram "
                "and/or email. Executes immediately, no confirmation needed."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "What to remind the user about."},
                    "frequency": {"type": "string", "enum": ["daily", "weekly", "monthly"]},
                    "time_of_day": {
                        "type": "string",
                        "description": "24-hour HH:MM in Singapore time, e.g. '18:00' for 6pm.",
                    },
                    "day_of_week": {
                        "type": "integer",
                        "description": "0=Monday..6=Sunday. Required only when frequency='weekly'.",
                    },
                    "day_of_month": {
                        "type": "integer",
                        "description": (
                            "1-31. Required only when frequency='monthly'. If the month is "
                            "shorter, fires on that month's last day instead."
                        ),
                    },
                    "channel": {
                        "type": "string",
                        "enum": ["telegram", "email", "both"],
                        "description": "Defaults to 'both' if omitted.",
                    },
                },
                "required": ["message", "frequency", "time_of_day"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_reminders",
            "description": "The user's currently scheduled reminders, with their ids.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_reminder",
            "description": (
                "Cancel a reminder. Deletes immediately, no confirmation needed. Call "
                "list_reminders first if you don't already know the reminder_id from this conversation."
            ),
            "parameters": {
                "type": "object",
                "properties": {"reminder_id": {"type": "string"}},
                "required": ["reminder_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_alert",
            "description": (
                "Watch a live value (today's spending, a stock's price, net worth, or a "
                "position's unrealized P&L) and notify the user once it crosses a threshold. "
                "Executes immediately, no confirmation needed. daily_spend alerts re-arm every "
                "day; the other three metrics fire once, then deactivate."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "metric": {
                        "type": "string",
                        "enum": ["daily_spend", "stock_price", "net_worth", "position_pnl"],
                    },
                    "operator": {"type": "string", "enum": ["above", "below"]},
                    "threshold": {
                        "type": "number",
                        "description": "The value to compare against. Can be negative for position_pnl (e.g. -200 for 'down more than $200').",
                    },
                    "ticker": {
                        "type": "string",
                        "description": "Required for stock_price and position_pnl. Not used for the other metrics.",
                    },
                    "message": {
                        "type": "string",
                        "description": "Optional custom notification text. A sensible message is auto-generated if omitted.",
                    },
                    "channel": {
                        "type": "string",
                        "enum": ["telegram", "email", "both"],
                        "description": "Defaults to 'both' if omitted.",
                    },
                },
                "required": ["metric", "operator", "threshold"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_alerts",
            "description": "The user's currently active alerts, with their ids.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_alert",
            "description": (
                "Cancel an alert. Deletes immediately, no confirmation needed. Call "
                "list_alerts first if you don't already know the alert_id from this conversation."
            ),
            "parameters": {
                "type": "object",
                "properties": {"alert_id": {"type": "string"}},
                "required": ["alert_id"],
            },
        },
    },
]


def _catch_lookup(fn, *args, **kwargs):
    """Runs a db/supabase.py ownership-checked write; LookupError (cross-tenant/missing
    id — the same exception backend/main.py's 404 handler catches) becomes an
    {"error": ...} the model can relay, instead of raising into answer_question()'s
    outer try/except and producing a generic apology for what's actually a bad id."""
    try:
        return fn(*args, **kwargs), None
    except LookupError as e:
        return None, str(e)


_TIME_OF_DAY_RE = re.compile(r"[0-2]\d:[0-5]\d")


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
    if name == "remember_preference":
        content = (args.get("content") or "").strip()
        if not content:
            return {"error": "empty content"}
        create_user_memory(user_id, content, source="agent")
        return {"status": "saved"}
    if name == "forget_memory":
        memory_id = (args.get("memory_id") or "").strip()
        if not memory_id:
            return {"error": "memory_id is required"}
        _, err = _catch_lookup(delete_user_memory, memory_id, user_id)
        return {"error": err} if err else {"status": "deleted"}
    if name == "update_profile_settings":
        fields = {k: args[k] for k in ("main_currency", "theme") if k in args}
        if not fields:
            return {"error": "no fields provided to update"}
        if "main_currency" in fields and fields["main_currency"] not in CURRENCIES:
            return {"error": f"main_currency must be one of {CURRENCIES}"}
        if "theme" in fields and fields["theme"] not in THEME_COLORS:
            return {"error": f"theme must be one of {list(THEME_COLORS.keys())}"}
        update_user(user_id, fields)
        return {"status": "updated"}
    if name == "list_accounts":
        return {"accounts": get_accounts(user_id=user_id)}
    if name == "create_account":
        acc_name = (args.get("name") or "").strip()
        acc_type = args.get("type")
        currency = args.get("currency")
        if not acc_name:
            return {"error": "name is required"}
        if acc_type not in ACCOUNT_TYPES:
            return {"error": f"type must be one of {ACCOUNT_TYPES}"}
        if currency not in CURRENCIES:
            return {"error": f"currency must be one of {CURRENCIES}"}
        account = create_account(user_id, acc_name, acc_type, currency, args.get("comments"))
        return {"status": "created", "account_id": account["id"]}
    if name == "update_account":
        account_id = (args.get("account_id") or "").strip()
        if not account_id:
            return {"error": "account_id is required"}
        fields = {k: args[k] for k in ("name", "type", "currency", "comments") if k in args}
        if not fields:
            return {"error": "no fields provided to update"}
        if "type" in fields and fields["type"] not in ACCOUNT_TYPES:
            return {"error": f"type must be one of {ACCOUNT_TYPES}"}
        if "currency" in fields and fields["currency"] not in CURRENCIES:
            return {"error": f"currency must be one of {CURRENCIES}"}
        _, err = _catch_lookup(update_account, account_id, fields, user_id)
        return {"error": err} if err else {"status": "updated"}
    if name == "delete_account":
        account_id = (args.get("account_id") or "").strip()
        if not account_id:
            return {"error": "account_id is required"}
        _, err = _catch_lookup(deactivate_account, account_id, user_id)
        return {"error": err} if err else {"status": "deleted"}
    if name == "list_categories":
        return {"categories": get_custom_categories_full(user_id)}
    if name == "create_category":
        cat_name = (args.get("name") or "").strip()
        if not cat_name:
            return {"error": "name is required"}
        category = create_custom_category(user_id, cat_name)
        return {"status": "created", "category_id": category["id"]}
    if name == "rename_category":
        category_id = (args.get("category_id") or "").strip()
        new_name = (args.get("name") or "").strip()
        if not category_id:
            return {"error": "category_id is required"}
        if not new_name:
            return {"error": "name is required"}
        _, err = _catch_lookup(update_custom_category, category_id, new_name, user_id)
        return {"error": err} if err else {"status": "updated"}
    if name == "delete_category":
        category_id = (args.get("category_id") or "").strip()
        if not category_id:
            return {"error": "category_id is required"}
        _, err = _catch_lookup(delete_custom_category, category_id, user_id)
        return {"error": err} if err else {"status": "deleted"}
    if name == "create_reminder":
        message = (args.get("message") or "").strip()
        frequency = args.get("frequency")
        time_of_day = args.get("time_of_day") or ""
        if not message:
            return {"error": "message is required"}
        if frequency not in ("daily", "weekly", "monthly"):
            return {"error": "frequency must be one of daily, weekly, monthly"}
        if not _TIME_OF_DAY_RE.fullmatch(time_of_day):
            return {"error": "time_of_day must be HH:MM 24-hour, e.g. '09:00'"}
        day_of_week = args.get("day_of_week")
        day_of_month = args.get("day_of_month")
        if frequency == "weekly" and not (isinstance(day_of_week, int) and 0 <= day_of_week <= 6):
            return {"error": "day_of_week (0=Monday..6=Sunday) is required for weekly reminders"}
        if frequency == "monthly" and not (isinstance(day_of_month, int) and 1 <= day_of_month <= 31):
            return {"error": "day_of_month (1-31) is required for monthly reminders"}
        channel = args.get("channel", "both")
        if channel not in ("telegram", "email", "both"):
            return {"error": "channel must be one of telegram, email, both"}
        reminder = create_user_reminder(
            user_id, message, frequency, time_of_day,
            day_of_week=day_of_week if frequency == "weekly" else None,
            day_of_month=day_of_month if frequency == "monthly" else None,
            channel=channel,
        )
        return {"status": "created", "reminder_id": reminder["id"]}
    if name == "list_reminders":
        return {"reminders": get_user_reminders(user_id)}
    if name == "delete_reminder":
        reminder_id = (args.get("reminder_id") or "").strip()
        if not reminder_id:
            return {"error": "reminder_id is required"}
        _, err = _catch_lookup(delete_user_reminder, reminder_id, user_id)
        return {"error": err} if err else {"status": "deleted"}
    if name == "create_alert":
        metric = args.get("metric")
        operator = args.get("operator")
        threshold = args.get("threshold")
        if metric not in ("daily_spend", "stock_price", "net_worth", "position_pnl"):
            return {"error": "metric must be one of daily_spend, stock_price, net_worth, position_pnl"}
        if operator not in ("above", "below"):
            return {"error": "operator must be one of above, below"}
        if not isinstance(threshold, (int, float)):
            return {"error": "threshold must be a number"}
        ticker = (args.get("ticker") or "").strip().upper()
        if metric in ("stock_price", "position_pnl") and not ticker:
            return {"error": "ticker is required for stock_price and position_pnl alerts"}
        channel = args.get("channel", "both")
        if channel not in ("telegram", "email", "both"):
            return {"error": "channel must be one of telegram, email, both"}
        message = (args.get("message") or "").strip() or None
        alert = create_user_alert(
            user_id, metric, operator, threshold,
            ticker=ticker if metric in ("stock_price", "position_pnl") else None,
            message=message, channel=channel,
        )
        return {"status": "created", "alert_id": alert["id"]}
    if name == "list_alerts":
        return {"alerts": get_user_alerts(user_id)}
    if name == "delete_alert":
        alert_id = (args.get("alert_id") or "").strip()
        if not alert_id:
            return {"error": "alert_id is required"}
        _, err = _catch_lookup(delete_user_alert, alert_id, user_id)
        return {"error": err} if err else {"status": "deleted"}
    return {"error": f"unknown tool {name!r}"}


def answer_question(uid: int | str, raw_text: str, user_id: str, channel: str = "telegram") -> str:
    """Runs a bounded tool-calling loop against DeepSeek. Never raises — any failure
    (network, malformed tool call, etc.) is caught and turned into an apology string,
    the same graceful-degradation convention used elsewhere in this bot (e.g. weekly
    report email failures don't crash the job).

    `channel` selects the system prompt copy ("telegram" or "web") — the tools and
    tool-calling loop are identical either way."""
    history = chat_history.get(uid, [])
    try:
        memories = get_user_memories(user_id)
    except Exception:
        logger.exception("answer_question: get_user_memories failed for user_id=%s", user_id)
        memories = []
    system_prompt = _build_system_prompt(channel, memories)
    messages = [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": raw_text}]

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
