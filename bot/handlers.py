import os

from telegram import Update
from telegram.ext import ContextTypes

from bot.extractor import extract_from_image, extract_from_pdf_images, extract_from_text
from db.supabase import (
    delete_portfolio_events,
    delete_transactions,
    get_account_cash_totals,
    get_accounts,
    get_latest_snapshots,
    get_recent_transactions,
    get_transactions,
    insert_portfolio_events,
    insert_transactions,
)
from scheduler.report_builder import summarize_transactions
from utils.fx import convert
from utils.formatters import format_money, format_pct
from utils.logger import get_logger
from utils.period import parse_period
from utils.portfolio import compute_holdings_summary

logger = get_logger(__name__)

ALLOWED_USER_IDS = {int(os.getenv("YOUR_TELEGRAM_CHAT_ID"))}
DEFAULT_CURRENCY = "SGD"

# In-memory pending store: user_id → extracted data awaiting confirmation
pending = {}

# In-memory last-saved store: user_id → ids from the most recent confirm, for /undo
last_saved = {}

TELEGRAM_MESSAGE_LIMIT = 4000  # headroom under Telegram's hard 4096-char cap


def is_authorized(update: Update) -> bool:
    authorized = update.effective_user.id in ALLOWED_USER_IDS
    if not authorized:
        logger.warning("Unauthorized access attempt from user_id=%s", update.effective_user.id)
    return authorized


def _escape_md(text: str) -> str:
    for ch in ("_", "*", "`", "["):
        text = str(text).replace(ch, f"\\{ch}")
    return text


def build_confirmation_lines(data: dict) -> list[str]:
    lines = [f"📄 *{_escape_md(data['document_type'])}* — {_escape_md(data.get('currency', ''))}", ""]
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
    lines.append("Reply `confirm` to save, `cancel` to discard, or `edit 3` to fix a row.")
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


async def send_confirmation(update: Update, data: dict):
    for chunk in chunk_lines(build_confirmation_lines(data)):
        await update.message.reply_text(chunk, parse_mode="Markdown")


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    uid = update.effective_user.id
    logger.info("handle_photo: received photo from user_id=%s", uid)
    await update.message.reply_text("⏳ Extracting transactions...")
    photo = await update.message.photo[-1].get_file()
    image_bytes = await photo.download_as_bytearray()
    data = extract_from_image(bytes(image_bytes))
    data["raw_text"] = str(data)
    data["source"] = "telegram_image"
    pending[uid] = data
    logger.info(
        "handle_photo: extracted %d transaction(s), %d portfolio event(s) for user_id=%s",
        len(data.get("transactions", [])), len(data.get("portfolio_events", [])), uid,
    )
    await send_confirmation(update, data)


async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    uid = update.effective_user.id
    doc = update.message.document
    logger.info("handle_document: received %s from user_id=%s", doc.mime_type, uid)
    file = await doc.get_file()
    file_bytes = await file.download_as_bytearray()

    await update.message.reply_text("⏳ Processing document...")

    if doc.mime_type == "application/pdf":
        data = extract_from_pdf_images(bytes(file_bytes))
        data["source"] = "telegram_pdf"
    else:
        data = extract_from_image(bytes(file_bytes))
        data["source"] = "telegram_image"

    data["raw_text"] = str(data)
    pending[uid] = data
    logger.info(
        "handle_document: extracted %d transaction(s), %d portfolio event(s) for user_id=%s",
        len(data.get("transactions", [])), len(data.get("portfolio_events", [])), uid,
    )
    await send_confirmation(update, data)


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    raw_text = update.message.text.strip()
    text = raw_text.lower()
    uid = update.effective_user.id

    if text == "confirm":
        data = pending.pop(uid, None)
        if not data:
            logger.info("handle_text: confirm with nothing pending for user_id=%s", uid)
            await update.message.reply_text("Nothing pending to confirm.")
            return
        accounts = get_accounts()
        default_account_id = accounts[0]["id"] if accounts else None

        txn_rows = [
            {
                "account_id": default_account_id,
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
                "account_id": default_account_id,
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
            saved_txn_ids = [r["id"] for r in insert_transactions(txn_rows).data]
        if trade_rows:
            saved_trade_ids = [r["id"] for r in insert_portfolio_events(trade_rows).data]
        last_saved[uid] = {"transaction_ids": saved_txn_ids, "portfolio_event_ids": saved_trade_ids}
        total = len(txn_rows) + len(trade_rows)
        logger.info(
            "handle_text: confirmed by user_id=%s — saved %d transaction(s), %d portfolio event(s)",
            uid, len(txn_rows), len(trade_rows),
        )
        await update.message.reply_text(f"✅ Saved {total} entries to database. Reply /undo to revert.")

    elif text == "cancel":
        had_pending = uid in pending
        pending.pop(uid, None)
        logger.info("handle_text: cancelled by user_id=%s (had_pending=%s)", uid, had_pending)
        await update.message.reply_text("❌ Cancelled. Nothing was saved.")

    elif text.startswith("edit"):
        logger.info("handle_text: edit requested by user_id=%s", uid)
        await update.message.reply_text(
            "To edit, resend the image with corrections, or manually fix in the dashboard."
        )
    else:
        logger.info("handle_text: parsing free-text entry from user_id=%s", uid)
        data = extract_from_text(raw_text)
        if not data.get("transactions") and not data.get("portfolio_events"):
            logger.info("handle_text: no transaction found in free-text from user_id=%s", uid)
            await update.message.reply_text(
                "I couldn't find a transaction in that. Try something like "
                "'Spent 0.5+3.5 on meals today', or send a screenshot/PDF."
            )
            return
        data["raw_text"] = str(data)
        data["source"] = "telegram_text"
        pending[uid] = data
        logger.info(
            "handle_text: extracted %d transaction(s), %d portfolio event(s) for user_id=%s",
            len(data.get("transactions", [])), len(data.get("portfolio_events", [])), uid,
        )
        await send_confirmation(update, data)


async def handle_expense_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    uid = update.effective_user.id
    arg = context.args[0] if context.args else None
    start, end, label = parse_period(arg)
    txns = get_transactions(start.isoformat(), end.isoformat())
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


async def handle_portfolio_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    uid = update.effective_user.id
    summary = compute_holdings_summary(DEFAULT_CURRENCY)
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
            f"{h['avg_cost']:.2f} {h['cost_currency']} → {format_money(h['market_value'], DEFAULT_CURRENCY)} | "
            f"{format_money(h['unrealized_gain'], DEFAULT_CURRENCY)}{gain_pct}"
        )
    lines.append("")
    lines.append(f"Total Market Value: {format_money(summary['total_market_value'], DEFAULT_CURRENCY)}")
    lines.append(f"Total Cost Basis:   {format_money(summary['total_cost_basis'], DEFAULT_CURRENCY)}")
    lines.append(f"Unrealized Gain:    {format_money(summary['total_unrealized_gain'], DEFAULT_CURRENCY)}")

    logger.info("handle_portfolio_command: user_id=%s holdings=%d", uid, len(summary["holdings"]))
    for chunk in chunk_lines(lines):
        await update.message.reply_text(chunk, parse_mode="Markdown")


async def handle_assets_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    uid = update.effective_user.id
    snapshots = get_latest_snapshots()
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

    logger.info("handle_assets_command: user_id=%s accounts=%d total=%.2f", uid, len(snapshots), total)
    for chunk in chunk_lines(lines):
        await update.message.reply_text(chunk, parse_mode="Markdown")


async def handle_balance_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    uid = update.effective_user.id
    query = " ".join(context.args).strip().lower() if context.args else None

    accounts = get_accounts()
    if query:
        accounts = [a for a in accounts if query in a["name"].lower()]
        if not accounts:
            await update.message.reply_text(f"No account matching '{query}'.")
            return

    cash_totals = get_account_cash_totals()
    snapshots_by_account = {s["account_id"]: s for s in get_latest_snapshots()}

    lines = [f"💳 *Balances* — {DEFAULT_CURRENCY}", ""]
    total = 0.0
    for a in accounts:
        if a["type"] == "brokerage":
            snap = snapshots_by_account.get(a["id"])
            balance = convert(snap["total_value"], snap["currency"], DEFAULT_CURRENCY) if snap else None
        else:
            balance = convert(cash_totals.get(a["id"], 0.0), a["currency"], DEFAULT_CURRENCY)

        if balance is None:
            lines.append(f"▪️ {a['name']}: no snapshot yet")
        else:
            lines.append(f"▪️ {a['name']}: {format_money(balance, DEFAULT_CURRENCY)}")
            total += balance
    lines.append("")
    lines.append(f"Total: {format_money(total, DEFAULT_CURRENCY)}")

    logger.info("handle_balance_command: user_id=%s query=%s accounts=%d", uid, query, len(accounts))
    for chunk in chunk_lines(lines):
        await update.message.reply_text(chunk, parse_mode="Markdown")


async def handle_recent_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    uid = update.effective_user.id
    try:
        n = int(context.args[0]) if context.args else 10
    except ValueError:
        n = 10
    n = max(1, min(n, 30))  # cap to stay comfortably under the Telegram message limit

    txns = get_recent_transactions(n)
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
    if not is_authorized(update):
        return
    uid = update.effective_user.id
    saved = last_saved.pop(uid, None)
    if not saved or not (saved["transaction_ids"] or saved["portfolio_event_ids"]):
        await update.message.reply_text("Nothing to undo.")
        return

    if saved["transaction_ids"]:
        delete_transactions(saved["transaction_ids"])
    if saved["portfolio_event_ids"]:
        delete_portfolio_events(saved["portfolio_event_ids"])
    total = len(saved["transaction_ids"]) + len(saved["portfolio_event_ids"])

    logger.info("handle_undo_command: user_id=%s reverted %d entries", uid, total)
    await update.message.reply_text(f"↩️ Reverted {total} entries from your last confirm.")


async def handle_help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    lines = [
        "*Available commands:*",
        "/expense [day|week|month|year] — spending summary (default: week)",
        "/portfolio — current holdings & unrealized gain/loss",
        "/assets — net worth across all accounts",
        "/balance [account] — balance for one account, or all accounts",
        "/recent [n] — last n transactions (default 10)",
        "/undo — revert your last confirmed save",
        "/help — this message",
        "",
        "Send a photo, PDF, or just type a transaction to log a new entry.",
    ]
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")
