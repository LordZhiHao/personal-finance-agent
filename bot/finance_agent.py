import json
import os
import re
from datetime import date, timedelta

from dateutil.relativedelta import relativedelta

from bot.deepseek_client import client
from db.supabase import (
    contribute_to_goal as db_contribute_to_goal,
    create_account,
    create_custom_category,
    create_user_alert,
    create_user_budget,
    create_user_goal,
    create_user_memory,
    create_user_reminder,
    deactivate_account,
    delete_custom_category,
    delete_user_alert,
    delete_user_budget,
    delete_user_goal,
    delete_user_memory,
    delete_user_reminder,
    get_accounts,
    get_custom_categories_full,
    get_held_positions,
    get_portfolio_events,
    get_recent_transactions,
    get_transactions,
    get_user_alerts,
    get_user_budgets,
    get_user_by_id,
    get_user_goals,
    get_user_memories,
    get_user_reminders,
    update_account,
    update_custom_category,
    update_user,
)
from scheduler.report_builder import budget_status, month_comparison, summarize_transactions
from utils.balances import compute_account_balances, compute_net_worth_trend
from utils.constants import ACCOUNT_TYPES, CURRENCIES, DASHBOARD_URL, DEFAULT_CURRENCY, THEME_COLORS, TICKER_YFINANCE_MAP
from utils.equity_pricing import fetch_dividend_forecast
from utils.logger import get_logger
from utils.period import parse_period
from utils.portfolio import compute_holdings_summary
from utils.subscriptions import detect_recurring_charges

logger = get_logger(__name__)

AGENT_MODEL = os.getenv("DEEPSEEK_AGENT_MODEL", "deepseek-v4-pro")

MAX_TOOL_ROUNDS = 4
MAX_HISTORY_TURNS = 6  # rolling window: 6 user+assistant pairs = 12 messages kept

# Per-user rolling chat history for multi-turn Q&A context — same dict-keyed-by-user_id
# pattern as `pending`/`last_saved` in bot/handlers.py. Keyed by the Telegram int chat id
# for bot conversations, or the Supabase user_id string for web dashboard conversations —
# the two key types never collide, so the channels naturally stay in separate threads.
chat_history: dict[int | str, list[dict]] = {}

def _shared_prompt_body(currency: str) -> str:
    # Computed per call, not baked in at import time — the bot/backend process runs
    # continuously across days, so "today" must be re-read on every request.
    today = date.today().isoformat()
    return f"""Today's date is {today}. Use this as the anchor for any date-relative reasoning
(e.g. judging whether a dividend's ex-date or a due date is upcoming or already past).

Answer questions about their spending, holdings, balances, and recent transactions by
calling the provided tools — never guess figures from memory. All monetary values from tools are already
in {currency} (this user's chosen main currency) unless a tool result states otherwise. Default to the "week" period when a question
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
need to ask again to keep watching after a stock_price/net_worth/position_pnl alert fires.

You can also manage monthly category budgets (create_budget/list_budgets/delete_budget/get_budget_status)
and savings goals (create_goal/list_goals/contribute_to_goal/delete_goal). A budget is a monthly spending
limit for one category — creating a budget for a category the user already budgeted just updates the
limit. get_budget_status compares month-to-date spend against each budgeted category's limit. A goal has
a target_amount and a running current_amount (starts at 0) — contribute_to_goal ADDS to current_amount,
it does not set/replace it, so if the user says "I saved $200 more toward my house downpayment," call
contribute_to_goal with amount=200, not the new total. Both budgets and goals execute immediately, no
confirmation needed, same as the settings/reminder/alert tools above.

You can also surface likely recurring subscriptions (list_subscriptions) detected from the user's past
~6 months of transactions, and schedule a reminder ahead of one's next expected charge
(create_reminder_from_subscription). This detection is heuristic — pattern-matched from transaction
history, not a real subscription list — so mention that it might miss something irregular or occasionally
flag a false positive, and suggest the user double-check before relying on it."""


def _memories_block(memories: list[dict]) -> str:
    if not memories:
        return ""
    notes = "\n".join(f"- (id: {m['id']}) {m['content']}" for m in memories)
    return f"""

What you know about this user from past conversations — each tagged with its id; use
forget_memory(memory_id) with that id if the user asks you to forget/remove one:
{notes}"""


def _build_system_prompt(channel: str, memories: list[dict], currency: str) -> str:
    shared = _shared_prompt_body(currency) + _memories_block(memories)
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
    {
        "type": "function",
        "function": {
            "name": "create_budget",
            "description": (
                "Set (or update) a monthly spending limit for a category. Re-running this for a "
                "category the user already budgeted just updates the limit. Executes immediately, "
                "no confirmation needed."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "description": "A category from the user's category list."},
                    "monthly_limit": {"type": "number", "description": "Must be greater than 0."},
                    "currency": {
                        "type": "string",
                        "description": "Defaults to the user's main_currency if omitted.",
                    },
                },
                "required": ["category", "monthly_limit"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_budgets",
            "description": "The user's budgeted categories with their monthly limits, and their ids.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_budget",
            "description": (
                "Remove a category's budget. Deletes immediately, no confirmation needed. Call "
                "list_budgets first if you don't already know the budget_id from this conversation."
            ),
            "parameters": {
                "type": "object",
                "properties": {"budget_id": {"type": "string"}},
                "required": ["budget_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_budget_status",
            "description": (
                "Spend-so-far vs. limit for each of the user's budgeted categories, for the "
                "current calendar month (month-to-date)."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_goal",
            "description": "Start tracking a new savings goal. Executes immediately, no confirmation needed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "A short name for the goal, e.g. 'House downpayment'."},
                    "target_amount": {"type": "number", "description": "Must be greater than 0."},
                    "target_date": {
                        "type": "string",
                        "description": "Optional target date, YYYY-MM-DD.",
                    },
                    "currency": {
                        "type": "string",
                        "description": "Defaults to the user's main_currency if omitted.",
                    },
                },
                "required": ["name", "target_amount"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_goals",
            "description": "The user's savings goals with their progress (current_amount vs target_amount), and their ids.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "contribute_to_goal",
            "description": (
                "Add an amount to a goal's saved-so-far total — this ADDS to current_amount, it "
                "does not replace it. Executes immediately, no confirmation needed. Call list_goals "
                "first if you don't already know the goal_id from this conversation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "goal_id": {"type": "string"},
                    "amount": {"type": "number", "description": "Must be greater than 0."},
                },
                "required": ["goal_id", "amount"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_goal",
            "description": (
                "Remove a savings goal. Deletes immediately, no confirmation needed. Call "
                "list_goals first if you don't already know the goal_id from this conversation."
            ),
            "parameters": {
                "type": "object",
                "properties": {"goal_id": {"type": "string"}},
                "required": ["goal_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_subscriptions",
            "description": (
                "Detected recurring charges (subscriptions, rent, etc.) from the user's last "
                "~6 months of transactions, with each one's next expected charge date. This is "
                "heuristic — it may miss irregular billing or occasionally flag something that "
                "isn't really recurring, so tell the user to double-check before relying on it."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_reminder_from_subscription",
            "description": (
                "Schedule a reminder a few days before a detected subscription's next expected "
                "charge. Call list_subscriptions first to get an exact description to match on. "
                "Executes immediately, no confirmation needed."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "description": {
                        "type": "string",
                        "description": "The subscription's description, from list_subscriptions — matched case-insensitively.",
                    },
                    "days_before": {
                        "type": "integer",
                        "description": "How many days before the next expected charge to remind. Defaults to 3.",
                    },
                },
                "required": ["description"],
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


def _run_tool(name: str, args: dict, user_id: str, currency: str) -> dict:
    if name == "get_spending_summary":
        start, end, label = parse_period(args.get("period"))
        txns = get_transactions(start.isoformat(), end.isoformat(), user_id)
        return {"period": label, **summarize_transactions(txns)}
    if name == "get_transactions_list":
        start, end, label = parse_period(args.get("period"))
        txns = get_transactions(start.isoformat(), end.isoformat(), user_id)
        return {"period": label, "transactions": txns}
    if name == "get_holdings":
        return compute_holdings_summary(user_id, currency)
    if name == "get_balances":
        return compute_account_balances(user_id, currency)
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
        summary = compute_holdings_summary(user_id, currency)
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
        return {"currency": currency, "allocation": allocation}
    if name == "get_net_worth_trend":
        days = max(1, int(args.get("days", 7)))
        return compute_net_worth_trend(user_id, currency, lookback_days=days)
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
    if name == "create_budget":
        category = (args.get("category") or "").strip()
        monthly_limit = args.get("monthly_limit")
        if not category:
            return {"error": "category is required"}
        if not isinstance(monthly_limit, (int, float)) or monthly_limit <= 0:
            return {"error": "monthly_limit must be greater than 0"}
        budget_currency = args.get("currency") or currency
        if budget_currency not in CURRENCIES:
            return {"error": f"currency must be one of {CURRENCIES}"}
        budget = create_user_budget(user_id, category, monthly_limit, budget_currency)
        return {"status": "saved", "budget_id": budget["id"]}
    if name == "list_budgets":
        return {"budgets": get_user_budgets(user_id)}
    if name == "delete_budget":
        budget_id = (args.get("budget_id") or "").strip()
        if not budget_id:
            return {"error": "budget_id is required"}
        _, err = _catch_lookup(delete_user_budget, budget_id, user_id)
        return {"error": err} if err else {"status": "deleted"}
    if name == "get_budget_status":
        budgets = get_user_budgets(user_id)
        if not budgets:
            return {"budgets": []}
        start, end, _ = parse_period("month_to_date")
        txns = get_transactions(start.isoformat(), end.isoformat(), user_id)
        return {"budgets": budget_status(txns, budgets)}
    if name == "create_goal":
        goal_name = (args.get("name") or "").strip()
        target_amount = args.get("target_amount")
        if not goal_name:
            return {"error": "name is required"}
        if not isinstance(target_amount, (int, float)) or target_amount <= 0:
            return {"error": "target_amount must be greater than 0"}
        goal_currency = args.get("currency") or currency
        if goal_currency not in CURRENCIES:
            return {"error": f"currency must be one of {CURRENCIES}"}
        goal = create_user_goal(user_id, goal_name, target_amount, goal_currency, args.get("target_date"))
        return {"status": "saved", "goal_id": goal["id"]}
    if name == "list_goals":
        return {"goals": get_user_goals(user_id)}
    if name == "contribute_to_goal":
        goal_id = (args.get("goal_id") or "").strip()
        amount = args.get("amount")
        if not goal_id:
            return {"error": "goal_id is required"}
        if not isinstance(amount, (int, float)) or amount <= 0:
            return {"error": "amount must be greater than 0"}
        result, err = _catch_lookup(db_contribute_to_goal, goal_id, amount, user_id)
        return {"error": err} if err else {"status": "updated", "current_amount": result["current_amount"]}
    if name == "delete_goal":
        goal_id = (args.get("goal_id") or "").strip()
        if not goal_id:
            return {"error": "goal_id is required"}
        _, err = _catch_lookup(delete_user_goal, goal_id, user_id)
        return {"error": err} if err else {"status": "deleted"}
    if name == "list_subscriptions":
        start = date.today() - relativedelta(months=6)
        txns = get_transactions(start.isoformat(), date.today().isoformat(), user_id)
        return {"subscriptions": detect_recurring_charges(txns)}
    if name == "create_reminder_from_subscription":
        description = (args.get("description") or "").strip().lower()
        if not description:
            return {"error": "description is required"}
        days_before = max(0, int(args.get("days_before", 3)))
        start = date.today() - relativedelta(months=6)
        txns = get_transactions(start.isoformat(), date.today().isoformat(), user_id)
        match = next(
            (s for s in detect_recurring_charges(txns) if description in s["description"].lower()), None
        )
        if not match:
            return {"error": f"no detected subscription matching {description!r} — call list_subscriptions first"}
        remind_date = date.fromisoformat(match["next_expected_date"]) - timedelta(days=days_before)
        if remind_date < date.today():
            remind_date = date.today()
        reminder = create_user_reminder(
            user_id,
            message=f"Subscription renewal expected: {match['description']} (~{match['amount']} {match['currency']})",
            frequency="monthly",
            time_of_day="09:00",
            day_of_month=remind_date.day,
        )
        return {"status": "created", "reminder_id": reminder["id"]}
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
    user = get_user_by_id(user_id)
    currency = (user or {}).get("main_currency") or DEFAULT_CURRENCY
    system_prompt = _build_system_prompt(channel, memories, currency)
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
                result = _run_tool(tc.function.name, args, user_id, currency)
                messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result, default=str)})
        if final_text is None:
            final_text = "Sorry, I couldn't finish answering that — try a more specific question."
    except Exception:
        logger.exception("answer_question: DeepSeek call failed for user_id=%s", uid)
        return "⚠️ Something went wrong answering that — please try again."

    history = history + [{"role": "user", "content": raw_text}, {"role": "assistant", "content": final_text}]
    chat_history[uid] = history[-(MAX_HISTORY_TURNS * 2):]
    return final_text
