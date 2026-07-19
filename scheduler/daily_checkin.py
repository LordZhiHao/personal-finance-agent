import os
from datetime import date

from db.supabase import get_transactions
from scheduler.report_builder import summarize_transactions
from utils.formatters import format_money
from utils.logger import get_logger

logger = get_logger(__name__)


def format_checkin_message(txns: list, today: date) -> str:
    header = f"🌙 *Daily Check-in* — {today.strftime('%d %b %Y')}"

    if not txns:
        return (
            f"{header}\n\n"
            "No spending logged today. Forgot to note something down?\n"
            "Just type it in — e.g. 'spent 12 on dinner'."
        )

    lines = [header, ""]
    for t in txns:
        sign = "+" if t["amount"] > 0 else ""
        lines.append(
            f"▪️ {t['description']} | {sign}{t['amount']:.2f} {t['currency']} | _{t['category']}_"
        )

    summary = summarize_transactions(txns)
    lines.append("")
    lines.append(f"Total spent today: {format_money(summary['expenses'], 'SGD')}")
    return "\n".join(lines)


async def send_daily_checkin(bot):
    today = date.today()
    logger.info("send_daily_checkin: checking transactions for %s", today.isoformat())
    txns = get_transactions(today.isoformat(), today.isoformat())
    msg = format_checkin_message(txns, today)
    await bot.send_message(
        chat_id=int(os.getenv("YOUR_TELEGRAM_CHAT_ID")),
        text=msg,
        parse_mode="Markdown",
    )
    logger.info("send_daily_checkin: sent — %d transaction(s) found", len(txns))
