from db.supabase import get_all_users
from scheduler.emailer import send_email
from scheduler.report_builder import get_weekly_data
from utils.constants import DEFAULT_CURRENCY
from utils.logger import get_logger

logger = get_logger(__name__)


def format_telegram_message(data: dict) -> str:
    currency = data["currency"]
    cat_lines = "\n".join(
        f"  {'📍' if i == 0 else '▪️'} {cat}: {currency} {amt:,.2f}"
        for i, (cat, amt) in enumerate(data["by_category"].items())
    ) or "  No expenses this week 🎉"

    snapshot_lines = "\n".join(
        f"  ▪️ {s['accounts']['name']}: {s['accounts']['currency']} {s['total_value']:,.2f}"
        for s in data["snapshots"]
    ) or "  No snapshots found — update via bot"

    return f"""
📊 *Weekly Financial Update*
{data['week_start'].strftime('%d %b')} – {data['week_end'].strftime('%d %b %Y')}

💰 *Income & Expenses*
├ Income:    {currency} {data['income']:,.2f}
├ Spent:     {currency} {data['expenses']:,.2f}
├ Invested:  {currency} {data['invested']:,.2f}
├ Net:       {currency} {data['net']:+,.2f}
└ Savings:   {data['savings_rate']}%

🧾 *Spend by Category*
{cat_lines}

🏦 *Portfolio Snapshot*
{snapshot_lines}
└ Total: {currency} {data['total_assets']:,.2f}

_Next update: Sunday 8pm SGT_
""".strip()


async def send_weekly_report(bot):
    users = get_all_users()
    logger.info("send_weekly_report: building reports for %d user(s)", len(users))
    for user in users:
        try:
            data = get_weekly_data(user["id"], user.get("main_currency", DEFAULT_CURRENCY))
        except Exception:
            logger.exception("send_weekly_report: failed building data for user_id=%s", user["id"])
            continue
        msg = format_telegram_message(data)

        if user.get("telegram_chat_id"):
            try:
                await bot.send_message(chat_id=user["telegram_chat_id"], text=msg, parse_mode="Markdown")
                logger.info(
                    "send_weekly_report: telegram sent to user_id=%s — income=%.2f expenses=%.2f net=%.2f",
                    user["id"], data["income"], data["expenses"], data["net"],
                )
            except Exception:
                logger.exception("send_weekly_report: telegram send failed for user_id=%s", user["id"])

        if user.get("notify_email"):
            try:
                send_email(data, to_email=user["notify_email"], theme=user.get("theme", "green"))
            except Exception:
                logger.exception("send_weekly_report: email send failed for user_id=%s", user["id"])

    logger.info("send_weekly_report: complete")
