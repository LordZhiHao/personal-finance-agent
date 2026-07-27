import asyncio
import json
from datetime import date

from dateutil.relativedelta import relativedelta
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from bot.account_matcher import match_account
from bot.extractor import extract_from_image, extract_from_pdf_images, extract_from_text
from bot.finance_agent import answer_question
from bot.router import classify_intent
from db.supabase import (
    consume_telegram_link_code,
    create_account,
    delete_portfolio_events,
    delete_transactions,
    get_accounts,
    get_categories_for_user,
    get_held_positions,
    get_latest_snapshots,
    get_recent_transactions,
    get_transactions,
    get_user_by_telegram_chat_id,
    insert_portfolio_events,
    insert_transactions,
)
from scheduler.report_builder import month_comparison, summarize_transactions
from utils.balances import compute_account_balances, compute_net_worth_trend
from utils.constants import ACCOUNT_TYPES, CURRENCIES, DASHBOARD_URL, DEFAULT_CURRENCY, TICKER_YFINANCE_MAP
from utils.equity_pricing import fetch_dividend_forecast
from utils.fx import convert
from utils.formatters import format_money, format_pct
from utils.logger import get_logger
from utils.period import parse_period
from utils.portfolio import compute_holdings_summary

logger = get_logger(__name__)

# In-memory last-saved store: telegram user_id → ids from the most recent auto-save, for /undo
last_saved = {}

# In-memory store: telegram user_id → {"data": ..., "user_id": ...} awaiting an account choice
# via the inline-keyboard prompt sent by _commit_and_reply when match_account is unsure.
pending_account_choice = {}

TELEGRAM_MESSAGE_LIMIT = 4000  # headroom under Telegram's hard 4096-char cap

UNLINKED_MSG = (
    "🔒 This Telegram account isn't linked yet. Log into the web dashboard, "
    "open *Link Telegram* in Settings, and send the code here as `/link 123456`."
)

NO_ACCOUNTS_MSG = (
    "⚠️ You don't have any accounts yet. Create one first, e.g.\n"
    "/newaccount DBS bank SGD\n\n"
    "Then resend the receipt/message to save it."
)


def _resolve_user(update: Update) -> dict | None:
    """Looks up the web account (a `users` row) linked to this Telegram chat, if any."""
    return get_user_by_telegram_chat_id(update.effective_user.id)


def _escape_md(text: str) -> str:
    for ch in ("_", "*", "`", "["):
        text = str(text).replace(ch, f"\\{ch}")
    return text


def build_saved_lines(data: dict) -> list[str]:
    lines = [f"✅ *Saved* — {_escape_md(data.get('document_type') or 'entry')} ({_escape_md(data.get('currency', ''))})", ""]
    for i, t in enumerate(data.get("transactions", []), 1):
        flag = "⚠️" if t["confidence"] < 0.7 else "✅"
        sign = "+" if t["amount"] > 0 else ""
        lines.append(
            f"{flag} {i}. {t['date']} | {_escape_md(t['description'])} | "
            f"{sign}{t['amount']:.2f} | _{t['category']}_"
        )
    for t in data.get("portfolio_events", []):
        lines.append(
            f"📈 {t['date']} | {t['action']} {t['quantity']} {t['ticker']} "
            f"@ {t['price']} {t['currency']}"
        )
    lines.append("")
    lines.append("Reply /undo to revert.")
    return lines


def chunk_lines(lines: list[str], limit: int = TELEGRAM_MESSAGE_LIMIT) -> list[str]:
    """Groups lines into chunks under Telegram's message length limit. Splitting on
    line boundaries keeps each line's Markdown formatting self-contained per chunk."""
    chunks, current, current_len = [], [], 0
    for line in lines:
        line_len = len(line) + 1
        if current and current_len + line_len > limit:
            chunks.append("\n".join(current))
            current, current_len = [], 0
        current.append(line)
        current_len += line_len
    if current:
        chunks.append("\n".join(current))
    return chunks


async def send_saved(update: Update, data: dict):
    for chunk in chunk_lines(build_saved_lines(data)):
        await update.message.reply_text(chunk, parse_mode="Markdown")


def save_extraction(data: dict, user_id: str, account_id: str) -> dict:
    """Builds transaction/portfolio_event rows from extracted `data` and commits them
    immediately to Supabase against `account_id` — no confirm step. Shared by the
    Telegram handlers below and the web dashboard's chat-upload endpoint
    (backend/routers/chat.py), so both save through the exact same logic."""
    txn_rows = [
        {
            "account_id": account_id,
            "date": t["date"],
            "description": t["description"],
            "amount": t["amount"],
            "category": t["category"],
            "currency": data.get("currency", "SGD"),
            "raw_text": data.get("raw_text"),
            "source": data.get("source", "manual"),
        }
        for t in data.get("transactions", [])
    ]
    trade_rows = [
        {
            "account_id": account_id,
            "date": t["date"],
            "ticker": t["ticker"],
            "action": t["action"],
            "quantity": t["quantity"],
            "price": t["price"],
            "currency": t["currency"],
            "fees": t.get("fees", 0),
        }
        for t in data.get("portfolio_events", [])
    ]
    saved_txn_ids, saved_trade_ids = [], []
    if txn_rows:
        saved_txn_ids = [r["id"] for r in insert_transactions(txn_rows, user_id).data]
    if trade_rows:
        saved_trade_ids = [r["id"] for r in insert_portfolio_events(trade_rows, user_id).data]
    return {
        "transaction_ids": saved_txn_ids,
        "portfolio_event_ids": saved_trade_ids,
        "transactions": data.get("transactions", []),
        "portfolio_events": data.get("portfolio_events", []),
    }


async def _finalize(update: Update, data: dict, user_id: str, uid: int, account_id: str) -> None:
    """Commits via save_extraction, records ids in last_saved for /undo, and replies with
    a summary. Shared tail end of both the confident-match path and the account-choice
    callback below."""
    result = save_extraction(data, user_id, account_id)
    last_saved[uid] = {
        "transaction_ids": result["transaction_ids"],
        "portfolio_event_ids": result["portfolio_event_ids"],
    }
    logger.info(
        "_finalize: saved %d transaction(s), %d portfolio event(s) for user_id=%s account_id=%s",
        len(result["transaction_ids"]), len(result["portfolio_event_ids"]), uid, account_id,
    )
    await send_saved(update, data)


async def _commit_and_reply(update: Update, data: dict, user_id: str, uid: int) -> None:
    """Shared tail end of handle_photo/handle_document/handle_text's record path:
    resolves the caller's accounts, uses match_account to pick one (or asks via an
    inline-keyboard prompt if unsure), then auto-commits (no confirm step for the
    entry's contents — only the account can be ambiguous)."""
    accounts = get_accounts(user_id=user_id)
    if not accounts:
        logger.info("_commit_and_reply: no accounts for user_id=%s", uid)
        await update.message.reply_text(NO_ACCOUNTS_MSG)
        return
    match = match_account(data, accounts)
    if match["account_id"]:
        await _finalize(update, data, user_id, uid, match["account_id"])
        return
    pending_account_choice[uid] = {"data": data, "user_id": user_id}
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton(a["name"], callback_data=f"acct:{a['id']}")] for a in match["candidates"]]
    )
    logger.info("_commit_and_reply: account unsure for user_id=%s, prompting %d candidate(s)", uid, len(match["candidates"]))
    await update.message.reply_text("Which account should I log this to?", reply_markup=keyboard)


async def handle_account_choice_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Resolves the inline-keyboard account prompt sent by _commit_and_reply when
    match_account was unsure."""
    query = update.callback_query
    await query.answer()
    uid = query.from_user.id
    pending = pending_account_choice.pop(uid, None)
    if not pending:
        await query.edit_message_text("This request has expired — please resend the receipt/message.")
        return
    await query.edit_message_reply_markup(reply_markup=None)  # prevent double-taps on the same prompt
    account_id = query.data.split(":", 1)[1]
    await _finalize(query, pending["data"], pending["user_id"], uid, account_id)


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = _resolve_user(update)
    if not user:
        await update.message.reply_text(UNLINKED_MSG, parse_mode="Markdown")
        return
    uid = update.effective_user.id
    logger.info("handle_photo: received photo from user_id=%s", uid)
    await update.message.reply_text("⏳ Extracting transactions...")
    photo = await update.message.photo[-1].get_file()
    image_bytes = await photo.download_as_bytearray()
    try:
        data = extract_from_image(bytes(image_bytes), categories=get_categories_for_user(user["id"]))
    except (json.JSONDecodeError, ValueError):
        logger.exception("handle_photo: extraction failed for user_id=%s", uid)
        await update.message.reply_text(
            "⚠️ Couldn't parse that image — try again, or type the expense manually, "
            "e.g. 'spent 12 on lunch'."
        )
        return
    data["raw_text"] = str(data)
    data["source"] = "telegram_image"
    logger.info(
        "handle_photo: extracted %d transaction(s), %d portfolio event(s) for user_id=%s",
        len(data.get("transactions", [])), len(data.get("portfolio_events", [])), uid,
    )
    await _commit_and_reply(update, data, user["id"], uid)


async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = _resolve_user(update)
    if not user:
        await update.message.reply_text(UNLINKED_MSG, parse_mode="Markdown")
        return
    uid = update.effective_user.id
    doc = update.message.document
    logger.info("handle_document: received %s from user_id=%s", doc.mime_type, uid)
    file = await doc.get_file()
    file_bytes = await file.download_as_bytearray()

    await update.message.reply_text("⏳ Processing document...")

    categories = get_categories_for_user(user["id"])
    try:
        if doc.mime_type == "application/pdf":
            data = extract_from_pdf_images(bytes(file_bytes), categories=categories)
            data["source"] = "telegram_pdf"
        else:
            data = extract_from_image(bytes(file_bytes), categories=categories)
            data["source"] = "telegram_image"
    except (json.JSONDecodeError, ValueError):
        logger.exception("handle_document: extraction failed for user_id=%s", uid)
        await update.message.reply_text(
            "⚠️ Couldn't parse that document — try again, or type the expense manually, "
            "e.g. 'spent 12 on lunch'."
        )
        return

    data["raw_text"] = str(data)
    logger.info(
        "handle_document: extracted %d transaction(s), %d portfolio event(s) for user_id=%s",
        len(data.get("transactions", [])), len(data.get("portfolio_events", [])), uid,
    )
    await _commit_and_reply(update, data, user["id"], uid)


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = _resolve_user(update)
    if not user:
        await update.message.reply_text(UNLINKED_MSG, parse_mode="Markdown")
        return
    user_id = user["id"]
    raw_text = update.message.text.strip()
    uid = update.effective_user.id

    intent = classify_intent(raw_text)
    logger.info("handle_text: intent=%s for user_id=%s", intent, uid)

    if intent == "chat":
        reply = answer_question(uid, raw_text, user_id)
        for chunk in chunk_lines(reply.split("\n")):
            await update.message.reply_text(chunk)
        return

    logger.info("handle_text: parsing free-text entry from user_id=%s", uid)
    try:
        data = extract_from_text(raw_text, categories=get_categories_for_user(user_id))
    except (json.JSONDecodeError, ValueError):
        logger.exception("handle_text: extraction failed for user_id=%s", uid)
        await update.message.reply_text(
            "⚠️ Couldn't parse that — try rephrasing, e.g. 'spent 12 on lunch'."
        )
        return
    if not data.get("transactions") and not data.get("portfolio_events"):
        logger.info("handle_text: no transaction found in free-text from user_id=%s", uid)
        await update.message.reply_text(
            "I couldn't find a transaction in that. Try something like "
            "'Spent 0.5+3.5 on meals today', or send a screenshot/PDF."
        )
        return
    data["raw_text"] = str(data)
    data["source"] = "telegram_text"
    logger.info(
        "handle_text: extracted %d transaction(s), %d portfolio event(s) for user_id=%s",
        len(data.get("transactions", [])), len(data.get("portfolio_events", [])), uid,
    )
    await _commit_and_reply(update, data, user_id, uid)


async def handle_link_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Redeems a short-lived code generated on the web dashboard's Settings page,
    binding this Telegram chat to that web account. Runs without user resolution —
    that's the entire point of this command."""
    if not context.args:
        await update.message.reply_text(
            "Usage: /link <code> — get a code from the dashboard's Settings > Link Telegram page."
        )
        return
    code = context.args[0].strip()
    user = consume_telegram_link_code(code, update.effective_user.id)
    if not user:
        await update.message.reply_text("❌ That code is invalid or expired. Generate a new one from the dashboard.")
        return
    logger.info("handle_link_command: linked telegram_chat_id=%s to user_id=%s", update.effective_user.id, user["id"])
    await update.message.reply_text(f"✅ Linked! This chat is now connected to {user['email']}.")


async def handle_newaccount_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = _resolve_user(update)
    if not user:
        await update.message.reply_text(UNLINKED_MSG, parse_mode="Markdown")
        return
    if len(context.args) < 3:
        await update.message.reply_text(
            f"Usage: /newaccount <name> <{'|'.join(ACCOUNT_TYPES)}> <{'|'.join(CURRENCIES)}>"
        )
        return
    name = context.args[0]
    type_ = context.args[1].lower()
    currency = context.args[2].upper()
    if type_ not in ACCOUNT_TYPES:
        await update.message.reply_text(f"Account type must be one of: {', '.join(ACCOUNT_TYPES)}")
        return
    if currency not in CURRENCIES:
        await update.message.reply_text(f"Currency must be one of: {', '.join(CURRENCIES)}")
        return
    account = create_account(user["id"], name, type_, currency)
    logger.info("handle_newaccount_command: user_id=%s created account_id=%s", user["id"], account["id"])
    await update.message.reply_text(f"✅ Created account '{account['name']}' ({account['type']}, {account['currency']})")


async def handle_expense_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = _resolve_user(update)
    if not user:
        await update.message.reply_text(UNLINKED_MSG, parse_mode="Markdown")
        return
    uid = update.effective_user.id
    arg = context.args[0] if context.args else None
    start, end, label = parse_period(arg)
    txns = get_transactions(start.isoformat(), end.isoformat(), user["id"])
    summary = summarize_transactions(txns)

    lines = [f"📊 *Expense Summary* — {label}", ""]
    lines.append(f"Income:   {format_money(summary['income'], DEFAULT_CURRENCY)}")
    lines.append(f"Spent:    {format_money(summary['expenses'], DEFAULT_CURRENCY)}")
    lines.append(f"Net:      {format_money(summary['net'], DEFAULT_CURRENCY)}")
    lines.append(f"Savings:  {format_pct(summary['savings_rate'])}")
    lines.append("")
    lines.append("*By category:*")
    if summary["by_category"]:
        for cat, amt in summary["by_category"].items():
            lines.append(f"  ▪️ {cat}: {format_money(amt, DEFAULT_CURRENCY)}")
    else:
        lines.append("  No expenses in this period 🎉")

    logger.info("handle_expense_command: user_id=%s period=%s", uid, label)
    for chunk in chunk_lines(lines):
        await update.message.reply_text(chunk, parse_mode="Markdown")


async def handle_compare_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = _resolve_user(update)
    if not user:
        await update.message.reply_text(UNLINKED_MSG, parse_mode="Markdown")
        return
    uid = update.effective_user.id
    start = date.today() - relativedelta(months=13)
    txns = get_transactions(start.isoformat(), date.today().isoformat(), user["id"])
    rows = month_comparison(txns)[:8]
    if not rows:
        await update.message.reply_text("No expenses in the last 13 months to compare.")
        return

    lines = [f"📊 *Month Comparison* — {DEFAULT_CURRENCY}", ""]
    for r in rows:
        lines.append(
            f"▪️ {r['category']}: {format_money(r['current'], DEFAULT_CURRENCY)} this month | "
            f"{format_money(r['previous'], DEFAULT_CURRENCY)} last month | "
            f"{format_money(r['year_ago'], DEFAULT_CURRENCY)} same month last year"
        )

    logger.info("handle_compare_command: user_id=%s categories=%d", uid, len(rows))
    for chunk in chunk_lines(lines):
        await update.message.reply_text(chunk, parse_mode="Markdown")


async def handle_portfolio_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = _resolve_user(update)
    if not user:
        await update.message.reply_text(UNLINKED_MSG, parse_mode="Markdown")
        return
    uid = update.effective_user.id
    summary = compute_holdings_summary(user["id"], DEFAULT_CURRENCY)
    if not summary["holdings"]:
        await update.message.reply_text("No holdings found.")
        return

    lines = [f"📈 *Portfolio* — {DEFAULT_CURRENCY}", ""]
    for h in summary["holdings"]:
        if h["market_value"] is None:
            lines.append(f"⚠️ {h['ticker']} ({h['account_name']}): {h['quantity']:g} units — no price available")
            continue
        gain_pct = f" ({format_pct(h['unrealized_gain_pct'])})" if h["unrealized_gain_pct"] is not None else ""
        lines.append(
            f"▪️ {h['ticker']} ({h['account_name']}): {h['quantity']:g} units @ avg "
            f"{h['avg_cost']:.2f} {h['cost_currency']} | now {h['price']:.2f} {h['price_currency']} → "
            f"{format_money(h['market_value'], DEFAULT_CURRENCY)} | "
            f"{format_money(h['unrealized_gain'], DEFAULT_CURRENCY)}{gain_pct}"
        )
    lines.append("")
    lines.append(f"Total Market Value: {format_money(summary['total_market_value'], DEFAULT_CURRENCY)}")
    lines.append(f"Total Cost Basis:   {format_money(summary['total_cost_basis'], DEFAULT_CURRENCY)}")
    lines.append(f"Unrealized Gain:    {format_money(summary['total_unrealized_gain'], DEFAULT_CURRENCY)}")

    logger.info("handle_portfolio_command: user_id=%s holdings=%d", uid, len(summary["holdings"]))
    for chunk in chunk_lines(lines):
        await update.message.reply_text(chunk, parse_mode="Markdown")


async def handle_dividends_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = _resolve_user(update)
    if not user:
        await update.message.reply_text(UNLINKED_MSG, parse_mode="Markdown")
        return
    uid = update.effective_user.id
    positions = get_held_positions(user["id"])
    tickers = sorted({p["ticker"] for p in positions})
    if not tickers:
        await update.message.reply_text("No holdings found.")
        return

    symbols = {t: TICKER_YFINANCE_MAP.get(t, t) for t in tickers}
    await update.message.reply_text("⏳ Checking dividend forecasts...")
    # Blocking yfinance I/O — offloaded to a thread so it doesn't stall the bot's
    # single asyncio event loop (and every other user's messages) while it runs.
    forecast = await asyncio.to_thread(fetch_dividend_forecast, sorted(set(symbols.values())))

    lines = ["💰 *Dividend Forecast*", ""]
    no_forecast = []
    for t in tickers:
        f = forecast.get(symbols[t])
        if not f or not f.get("ex_dividend_date"):
            no_forecast.append(t)
            continue
        yield_str = f"{f['dividend_yield']:.2f}%" if f.get("dividend_yield") is not None else "—"
        rate_str = f"{f['dividend_rate']:.2f} {f['currency']}" if f.get("dividend_rate") is not None else "—"
        lines.append(f"▪️ {t}: next ex-div {f['ex_dividend_date']} | rate {rate_str}/share | yield {yield_str}")
    if no_forecast:
        lines.append("")
        lines.append(f"⚠️ No forecast available for: {', '.join(no_forecast)}")

    logger.info("handle_dividends_command: user_id=%s tickers=%d", uid, len(tickers))
    for chunk in chunk_lines(lines):
        await update.message.reply_text(chunk, parse_mode="Markdown")


ALLOCATION_GROUPS = {"ticker": "ticker", "account": "account_name", "currency": "price_currency"}


async def handle_allocation_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = _resolve_user(update)
    if not user:
        await update.message.reply_text(UNLINKED_MSG, parse_mode="Markdown")
        return
    uid = update.effective_user.id
    group_arg = context.args[0].lower() if context.args else "ticker"
    if group_arg not in ALLOCATION_GROUPS:
        await update.message.reply_text(f"Usage: /allocation [{'|'.join(ALLOCATION_GROUPS)}]")
        return
    group_key = ALLOCATION_GROUPS[group_arg]

    summary = compute_holdings_summary(user["id"], DEFAULT_CURRENCY)
    if not summary["holdings"] or not summary["total_market_value"]:
        await update.message.reply_text("No priced holdings to allocate.")
        return

    totals: dict[str, float] = {}
    for h in summary["holdings"]:
        if h["market_value"] is None:
            continue
        key = h[group_key] or "Unknown"
        totals[key] = totals.get(key, 0.0) + h["market_value"]
    rows = sorted(totals.items(), key=lambda x: x[1], reverse=True)

    lines = [f"🧭 *Allocation by {group_arg}* — {DEFAULT_CURRENCY}", ""]
    for name, value in rows:
        pct = value / summary["total_market_value"] * 100
        lines.append(f"▪️ {name}: {format_money(value, DEFAULT_CURRENCY)} ({pct:.1f}%)")

    logger.info("handle_allocation_command: user_id=%s group=%s groups=%d", uid, group_arg, len(rows))
    for chunk in chunk_lines(lines):
        await update.message.reply_text(chunk, parse_mode="Markdown")


async def handle_assets_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = _resolve_user(update)
    if not user:
        await update.message.reply_text(UNLINKED_MSG, parse_mode="Markdown")
        return
    uid = update.effective_user.id
    snapshots = get_latest_snapshots(user_id=user["id"])
    if not snapshots:
        await update.message.reply_text("No asset snapshots found.")
        return

    lines = [f"🏦 *Net Assets* — {DEFAULT_CURRENCY}", ""]
    total = 0.0
    for s in snapshots:
        converted = convert(s["total_value"], s["currency"], DEFAULT_CURRENCY)
        total += converted
        lines.append(f"▪️ {s['accounts']['name']}: {format_money(converted, DEFAULT_CURRENCY)}")
    lines.append("")
    lines.append(f"Total: {format_money(total, DEFAULT_CURRENCY)}")

    trend = compute_net_worth_trend(user["id"], DEFAULT_CURRENCY, lookback_days=7)
    if trend["delta"] is not None:
        arrow = "▲" if trend["delta"] >= 0 else "▼"
        lines.append(
            f"{arrow} {format_money(trend['delta'], DEFAULT_CURRENCY)} "
            f"({format_pct(trend['delta_pct'])}) vs 7 days ago"
        )

    logger.info("handle_assets_command: user_id=%s accounts=%d total=%.2f", uid, len(snapshots), total)
    for chunk in chunk_lines(lines):
        await update.message.reply_text(chunk, parse_mode="Markdown")


async def handle_balance_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = _resolve_user(update)
    if not user:
        await update.message.reply_text(UNLINKED_MSG, parse_mode="Markdown")
        return
    uid = update.effective_user.id
    query = " ".join(context.args).strip().lower() if context.args else None

    accounts = get_accounts(user_id=user["id"])
    if query:
        accounts = [a for a in accounts if query in a["name"].lower()]
        if not accounts:
            await update.message.reply_text(f"No account matching '{query}'.")
            return

    result = compute_account_balances(user["id"], DEFAULT_CURRENCY, accounts=accounts)

    lines = [f"💳 *Balances* — {DEFAULT_CURRENCY}", ""]
    for b in result["balances"]:
        if b["balance"] is None:
            lines.append(f"▪️ {b['account_name']}: no snapshot yet")
        else:
            lines.append(f"▪️ {b['account_name']}: {format_money(b['balance'], DEFAULT_CURRENCY)}")
    lines.append("")
    lines.append(f"Total: {format_money(result['total'], DEFAULT_CURRENCY)}")

    logger.info("handle_balance_command: user_id=%s query=%s accounts=%d", uid, query, len(accounts))
    for chunk in chunk_lines(lines):
        await update.message.reply_text(chunk, parse_mode="Markdown")


async def handle_recent_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = _resolve_user(update)
    if not user:
        await update.message.reply_text(UNLINKED_MSG, parse_mode="Markdown")
        return
    uid = update.effective_user.id
    try:
        n = int(context.args[0]) if context.args else 10
    except ValueError:
        n = 10
    n = max(1, min(n, 30))  # cap to stay comfortably under the Telegram message limit

    txns = get_recent_transactions(n, user["id"])
    if not txns:
        await update.message.reply_text("No transactions found.")
        return

    lines = [f"🧾 *Last {len(txns)} Transaction(s)*", ""]
    for t in txns:
        sign = "+" if t["amount"] > 0 else ""
        account_name = t["accounts"]["name"] if t.get("accounts") else "Unknown"
        lines.append(
            f"▪️ {t['date']} | {t['description']} | {sign}{t['amount']:.2f} {t['currency']} | "
            f"_{t['category']}_ | {account_name}"
        )

    logger.info("handle_recent_command: user_id=%s n=%d", uid, n)
    for chunk in chunk_lines(lines):
        await update.message.reply_text(chunk, parse_mode="Markdown")


async def handle_undo_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = _resolve_user(update)
    if not user:
        await update.message.reply_text(UNLINKED_MSG, parse_mode="Markdown")
        return
    uid = update.effective_user.id
    saved = last_saved.pop(uid, None)
    if not saved or not (saved["transaction_ids"] or saved["portfolio_event_ids"]):
        await update.message.reply_text("Nothing to undo.")
        return

    if saved["transaction_ids"]:
        delete_transactions(saved["transaction_ids"], user["id"])
    if saved["portfolio_event_ids"]:
        delete_portfolio_events(saved["portfolio_event_ids"], user["id"])
    total = len(saved["transaction_ids"]) + len(saved["portfolio_event_ids"])

    logger.info("handle_undo_command: user_id=%s reverted %d entries", uid, total)
    await update.message.reply_text(f"↩️ Reverted {total} entries from your last confirm.")


async def handle_error(update: object, context: ContextTypes.DEFAULT_TYPE):
    """Catch-all for exceptions raised anywhere in a handler. python-telegram-bot swallows
    unhandled exceptions into its own logger and never replies — this is the safety net so
    the bot can't go silent, even for failures not covered by the try/excepts above (e.g. a
    Supabase write failing on confirm, or a Gemini network/rate-limit error)."""
    logger.error("handle_error: unhandled exception", exc_info=context.error)
    if isinstance(update, Update) and update.effective_message:
        await update.effective_message.reply_text(
            "⚠️ Something went wrong handling that — please try again."
        )


async def handle_dashboard_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(f"🌐 Your dashboard: {DASHBOARD_URL}")


async def handle_help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    lines = [
        "*Available commands:*",
        "/link <code> — link this chat to your web dashboard account",
        "/dashboard — get the link to your web dashboard",
        "/newaccount <name> <type> <currency> — create your first account",
        "/expense [day|week|month|year|month_to_date] — spending summary (default: week)",
        "/compare — this month vs last month vs same month last year, by category",
        "/portfolio — current holdings & unrealized gain/loss",
        "/dividends — next ex-dividend date, rate & yield per holding",
        "/allocation [ticker|account|currency] — portfolio allocation % (default: ticker)",
        "/assets — net worth across all accounts, with 7-day trend once enough history exists",
        "/balance [account] — balance for one account, or all accounts",
        "/recent [n] — last n transactions (default 10)",
        "/undo — revert your last confirmed save",
        "/help — this message",
        "",
        "Send a photo, PDF, or just type a transaction to log a new entry. You can also just "
        "ask questions in plain English, e.g. \"how's CSPX doing\" or \"what did I spend this month\".",
    ]
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")
