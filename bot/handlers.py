import os

from telegram import Update
from telegram.ext import ContextTypes

from bot.extractor import extract_from_image, extract_from_text
from db.supabase import get_accounts, insert_portfolio_events, insert_transactions
from utils.logger import get_logger
from utils.pdf_text import extract_text_from_pdf

logger = get_logger(__name__)

ALLOWED_USER_IDS = {int(os.getenv("YOUR_TELEGRAM_CHAT_ID"))}

# In-memory pending store: user_id → extracted data awaiting confirmation
pending = {}

TELEGRAM_MESSAGE_LIMIT = 4000  # headroom under Telegram's hard 4096-char cap


def is_authorized(update: Update) -> bool:
    authorized = update.effective_user.id in ALLOWED_USER_IDS
    if not authorized:
        logger.warning("Unauthorized access attempt from user_id=%s", update.effective_user.id)
    return authorized


def build_confirmation_lines(data: dict) -> list[str]:
    lines = [f"📄 *{data['document_type']}* — {data.get('currency', '')}", ""]
    for i, t in enumerate(data.get("transactions", []), 1):
        flag = "⚠️" if t["confidence"] < 0.7 else "✅"
        sign = "+" if t["amount"] > 0 else ""
        lines.append(
            f"{flag} {i}. {t['date']} | {t['description']} | "
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
        text = extract_text_from_pdf(bytes(file_bytes))
        data = extract_from_text(text)
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
        if txn_rows:
            insert_transactions(txn_rows)
        if trade_rows:
            insert_portfolio_events(trade_rows)
        total = len(txn_rows) + len(trade_rows)
        logger.info(
            "handle_text: confirmed by user_id=%s — saved %d transaction(s), %d portfolio event(s)",
            uid, len(txn_rows), len(trade_rows),
        )
        await update.message.reply_text(f"✅ Saved {total} entries to database.")

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
