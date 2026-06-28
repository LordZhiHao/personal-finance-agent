import os

from telegram import Update
from telegram.ext import ContextTypes

from bot.extractor import extract_from_image
from db.supabase import get_accounts, insert_portfolio_events, insert_transactions
from utils.pdf_converter import pdf_to_images

ALLOWED_USER_IDS = {int(os.getenv("YOUR_TELEGRAM_CHAT_ID"))}

# In-memory pending store: user_id → extracted data awaiting confirmation
pending = {}


def is_authorized(update: Update) -> bool:
    return update.effective_user.id in ALLOWED_USER_IDS


def format_confirmation(data: dict) -> str:
    lines = [f"📄 *{data['document_type']}* — {data.get('currency', '')}"]
    lines.append("")
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
    return "\n".join(lines)


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    await update.message.reply_text("⏳ Extracting transactions...")
    photo = await update.message.photo[-1].get_file()
    image_bytes = await photo.download_as_bytearray()
    data = extract_from_image(bytes(image_bytes))
    data["raw_text"] = str(data)
    pending[update.effective_user.id] = data
    await update.message.reply_text(
        format_confirmation(data), parse_mode="Markdown"
    )


async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    doc = update.message.document
    file = await doc.get_file()
    file_bytes = await file.download_as_bytearray()

    await update.message.reply_text("⏳ Processing document...")

    if doc.mime_type == "application/pdf":
        pages = pdf_to_images(bytes(file_bytes))
        all_txns = []
        all_trades = []
        result = {}
        for page_bytes in pages:
            result = extract_from_image(page_bytes)
            all_txns.extend(result.get("transactions", []))
            all_trades.extend(result.get("portfolio_events", []))
        data = {
            "document_type": "bank_statement",
            "currency": result.get("currency", "SGD"),
            "transactions": all_txns,
            "portfolio_events": all_trades,
        }
    else:
        data = extract_from_image(bytes(file_bytes))

    data["raw_text"] = str(data)
    pending[update.effective_user.id] = data
    await update.message.reply_text(
        format_confirmation(data), parse_mode="Markdown"
    )


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update):
        return
    text = update.message.text.strip().lower()
    uid = update.effective_user.id

    if text == "confirm":
        data = pending.pop(uid, None)
        if not data:
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
                "source": "telegram_image",
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
        await update.message.reply_text(f"✅ Saved {total} entries to database.")

    elif text == "cancel":
        pending.pop(uid, None)
        await update.message.reply_text("❌ Cancelled. Nothing was saved.")

    elif text.startswith("edit"):
        await update.message.reply_text(
            "To edit, resend the image with corrections, or manually fix in the dashboard."
        )
    else:
        await update.message.reply_text(
            "Send me a bank statement screenshot, trade screenshot, or PDF to get started."
        )
