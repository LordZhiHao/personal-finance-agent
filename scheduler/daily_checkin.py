from datetime import date

from db.supabase import get_transactions, get_users_with_telegram
from scheduler.report_builder import summarize_transactions
from utils.constants import DEFAULT_CURRENCY
from utils.formatters import format_money
from utils.logger import get_logger

logger = get_logger(__name__)


def format_checkin_message(txns: list, today: date, currency: str = DEFAULT_CURRENCY) -> str:
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
    lines.append(f"Total spent today: {format_money(summary['expenses'], currency)}")
    return "\n".join(lines)


async def send_daily_checkin(bot):
    today = date.today()
    users = get_users_with_telegram()
    logger.info("send_daily_checkin: checking transactions for %s across %d user(s)", today.isoformat(), len(users))
    for user in users:
        try:
            txns = get_transactions(today.isoformat(), today.isoformat(), user["id"])
            msg = format_checkin_message(txns, today, user.get("main_currency", DEFAULT_CURRENCY))
            await bot.send_message(chat_id=user["telegram_chat_id"], text=msg, parse_mode="Markdown")
            logger.info("send_daily_checkin: sent to user_id=%s — %d transaction(s) found", user["id"], len(txns))
        except Exception:
            logger.exception("send_daily_checkin: failed for user_id=%s", user["id"])
