import os

from scheduler.emailer import send_email
from scheduler.report_builder import get_weekly_data
from utils.logger import get_logger

logger = get_logger(__name__)


def format_telegram_message(data: dict) -> str:
    cat_lines = "\n".join(
        f"  {'📍' if i == 0 else '▪️'} {cat}: SGD {amt:,.2f}"
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
├ Income:    SGD {data['income']:,.2f}
├ Spent:     SGD {data['expenses']:,.2f}
├ Net:       SGD {data['net']:+,.2f}
└ Savings:   {data['savings_rate']}%

🧾 *Spend by Category*
{cat_lines}

🏦 *Portfolio Snapshot*
{snapshot_lines}
└ Total: SGD {data['total_assets']:,.2f}

_Next update: Sunday 8pm SGT_
""".strip()


async def send_weekly_report(bot):
    logger.info("send_weekly_report: building report")
    data = get_weekly_data()
    msg = format_telegram_message(data)
    await bot.send_message(
        chat_id=int(os.getenv("YOUR_TELEGRAM_CHAT_ID")),
        text=msg,
        parse_mode="Markdown",
    )
    logger.info(
        "send_weekly_report: telegram sent — income=%.2f expenses=%.2f net=%.2f",
        data["income"], data["expenses"], data["net"],
    )
    try:
        send_email(data)
    except Exception:
        logger.exception("send_weekly_report: email send failed")
    logger.info("send_weekly_report: complete")
